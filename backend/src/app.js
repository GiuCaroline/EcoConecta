import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "node:crypto";
import { registerQuantumRoutes } from "./quantum.js";

const MASKED_ADDRESS = "Endereço completo disponível após aceitar a coleta";
const ROLES = ["resident", "driver", "point"];
const MATERIAL_IDS = new Set(["paper", "plastic", "glass", "metal", "electronic", "oil"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const str = (v) => (typeof v === "string" ? v.trim() : "");

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  phone: u.phone || "",
  address: u.address || "",
  vehicle: u.vehicle || "",
  plate: u.plate || "",
  online: u.online !== false,
});

const publicPoint = (row) => ({
  id: row.id,
  owner: row.owner_id,
  name: row.name,
  address: row.address,
  phone: row.phone,
  hours: row.hours,
  description: row.description,
  materials: row.materials || [],
  active: row.active,
  icon: row.icon || "leaf-outline",
});

function publicRequest(row, viewer) {
  const masked = row.status === 0 && viewer?.role === "driver";
  return {
    id: row.id,
    residentId: row.resident_id,
    residentName: row.resident_name,
    pointId: row.point_id,
    pointName: row.point_name || "",
    pointAddress: row.point_address || "",
    driverId: row.driver_id,
    driverName: row.driver_name || null,
    materials: row.materials || [],
    quantity: Number(row.quantity),
    date: /^\d{4}-\d{2}-\d{2}$/.test(row.date || "")
      ? row.date.split("-").reverse().join("/")
      : row.date,
    period: row.period,
    address: masked ? MASKED_ADDRESS : row.address,
    notes: masked ? "" : row.notes || "",
    status: row.status,
    cancelled: row.cancelled,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

function parsePage(req) {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  return { limit, offset };
}

function pageResult(rows, { limit, offset }, map) {
  const hasMore = rows.length > limit;
  return {
    items: rows.slice(0, limit).map(map),
    hasMore,
    nextOffset: hasMore ? offset + limit : null,
  };
}

// Aceita DD/MM/AAAA e YYYY-MM-DD; devolve YYYY-MM-DD ou null.
function normalizeDate(value) {
  const s = str(value);
  let y, m, d;
  let match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (match) [, d, m, y] = match;
  else if ((match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s))) [, y, m, d] = match;
  else return null;
  const dt = new Date(Date.UTC(+y, +m - 1, +d));
  if (dt.getUTCFullYear() !== +y || dt.getUTCMonth() !== +m - 1 || dt.getUTCDate() !== +d)
    return null;
  return `${y}-${m}-${d}`;
}

function todayIn(timeZone) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function createApp(pool, options = {}) {
  const rounds = options?.bcryptRounds || 10;
  const sessionDays = options?.sessionDays || 7;
  const timeZone = options?.timeZone || "America/Sao_Paulo";
  const app = express();

  if (options?.trustProxyHops > 0) app.set("trust proxy", options.trustProxyHops);
  app.disable("x-powered-by");
  if (Array.isArray(options?.corsOrigins))
    app.use(cors({ origin: options.corsOrigins.length ? options.corsOrigins : false }));
  else app.use(cors());
  app.use(express.json({ limit: "100kb" }));

  const q = (sql, values) => pool.query(sql, values);

  async function notify(userId, title, body) {
    if (!userId) return;
    await q("INSERT INTO notifications (id,user_id,title,body) VALUES ($1,$2,$3,$4)", [
      randomUUID(),
      userId,
      title,
      body,
    ]);
  }

  async function createSession(userId) {
    const token = randomBytes(32).toString("hex");
    await q(
      "INSERT INTO sessions (token,user_id,expires_at) VALUES ($1,$2,now() + make_interval(days => $3::int))",
      [token, userId, Number(sessionDays)],
    );
    return token;
  }

  const auth = wrap(async (req, _res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) throw new HttpError(401, "Entre na sua conta para continuar.");
    const { rows } = await q(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = $1 AND s.expires_at > now()`,
      [token],
    );
    if (!rows[0]) throw new HttpError(401, "Sessão inválida ou expirada.");
    req.user = rows[0];
    req.token = token;
    next();
  });

  const checkId = (req, _res, next) => {
    if (!UUID_RE.test(req.params.id)) return next(new HttpError(404, "Recurso não encontrado."));
    next();
  };

  app.get("/health", (_req, res) => res.json({ ok: true }));

  // ---------- Auth ----------
  app.post(
    "/api/auth/register",
    wrap(async (req, res) => {
      const name = str(req.body?.name);
      const email = str(req.body?.email).toLowerCase();
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      const role = req.body?.role;
      const fields = {};
      if (!name) fields.name = "Informe seu nome.";
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fields.email = "E-mail inválido.";
      if (password.length < 8) fields.password = "A senha deve ter ao menos 8 caracteres.";
      if (!ROLES.includes(role)) fields.role = "Perfil inválido.";
      if (Object.keys(fields).length)
        throw new HttpError(400, "Confira os dados informados.", fields);
      const dup = await q("SELECT 1 FROM users WHERE email=$1", [email]);
      if (dup.rows.length) throw new HttpError(409, "Este e-mail já está cadastrado.");
      const hash = await bcrypt.hash(password, rounds);
      const { rows } = await q(
        `INSERT INTO users (id,name,email,password_hash,role,phone,address,vehicle,plate)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [
          randomUUID(),
          name,
          email,
          hash,
          role,
          str(req.body?.phone),
          str(req.body?.address),
          str(req.body?.vehicle),
          str(req.body?.plate),
        ],
      );
      const token = await createSession(rows[0].id);
      res.status(201).json({ token, user: publicUser(rows[0]) });
    }),
  );

  app.post(
    "/api/auth/login",
    wrap(async (req, res) => {
      const email = str(req.body?.email).toLowerCase();
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      const { rows } = await q("SELECT * FROM users WHERE email=$1", [email]);
      const ok = rows[0] && (await bcrypt.compare(password, rows[0].password_hash));
      if (!ok) throw new HttpError(401, "E-mail ou senha incorretos.");
      const token = await createSession(rows[0].id);
      res.json({ token, user: publicUser(rows[0]) });
    }),
  );

  app.post(
    "/api/auth/logout",
    auth,
    wrap(async (req, res) => {
      await q("DELETE FROM sessions WHERE token=$1", [req.token]);
      res.status(204).end();
    }),
  );

  app.get("/api/auth/me", auth, (req, res) => res.json({ user: publicUser(req.user) }));

  // ---------- Users ----------
  app.patch(
    "/api/users/me",
    auth,
    wrap(async (req, res) => {
      const body = req.body || {};
      if ("role" in body) throw new HttpError(400, "O perfil da conta não pode ser alterado.");
      const sets = [];
      const values = [];
      for (const key of ["name", "phone", "address", "vehicle", "plate"]) {
        if (key in body) {
          if (typeof body[key] !== "string")
            throw new HttpError(400, "Dados inválidos.", { [key]: "Valor inválido." });
          if (key === "name" && !body[key].trim())
            throw new HttpError(400, "Dados inválidos.", { name: "Informe seu nome." });
          values.push(body[key].trim());
          sets.push(`${key}=$${values.length}`);
        }
      }
      if ("online" in body) {
        if (typeof body.online !== "boolean")
          throw new HttpError(400, "Dados inválidos.", { online: "Valor inválido." });
        values.push(body.online);
        sets.push(`online=$${values.length}`);
      }
      if (!sets.length) return res.json({ user: publicUser(req.user) });
      values.push(req.user.id);
      const { rows } = await q(
        `UPDATE users SET ${sets.join(",")} WHERE id=$${values.length} RETURNING *`,
        values,
      );
      res.json({ user: publicUser(rows[0]) });
    }),
  );

  // ---------- Points ----------
  const validMaterials = (m) =>
    Array.isArray(m) && m.length > 0 && m.every((x) => typeof x === "string" && MATERIAL_IDS.has(x));

  app.get(
    "/api/points",
    auth,
    wrap(async (req, res) => {
      const page = parsePage(req);
      const { rows } = await q(
        `SELECT * FROM points WHERE active = true OR owner_id = $1
         ORDER BY created_at, id LIMIT $2 OFFSET $3`,
        [req.user.id, page.limit + 1, page.offset],
      );
      res.json(pageResult(rows, page, publicPoint));
    }),
  );

  app.post(
    "/api/points",
    auth,
    wrap(async (req, res) => {
      if (req.user.role !== "point")
        throw new HttpError(403, "Apenas responsáveis por pontos podem cadastrar pontos.");
      const b = req.body || {};
      const fields = {};
      if (!str(b.name)) fields.name = "Informe o nome do ponto.";
      if (!str(b.address)) fields.address = "Informe o endereço.";
      if (!validMaterials(b.materials)) fields.materials = "Selecione ao menos um material.";
      if (Object.keys(fields).length)
        throw new HttpError(400, "Confira os dados informados.", fields);
      const { rows } = await q(
        `INSERT INTO points (id,owner_id,name,address,phone,hours,description,materials,active,icon)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [
          randomUUID(),
          req.user.id,
          str(b.name),
          str(b.address),
          str(b.phone),
          str(b.hours),
          str(b.description),
          JSON.stringify(b.materials),
          b.active !== false,
          str(b.icon) || "leaf-outline",
        ],
      );
      res.status(201).json({ point: publicPoint(rows[0]) });
    }),
  );

  app.patch(
    "/api/points/:id",
    auth,
    checkId,
    wrap(async (req, res) => {
      const found = await q("SELECT * FROM points WHERE id=$1", [req.params.id]);
      if (!found.rows[0]) throw new HttpError(404, "Ponto não encontrado.");
      if (found.rows[0].owner_id !== req.user.id)
        throw new HttpError(403, "Você não é responsável por este ponto.");
      const b = req.body || {};
      const sets = [];
      const values = [];
      for (const key of ["name", "address", "phone", "hours", "description", "icon"]) {
        if (key in b) {
          if (typeof b[key] !== "string")
            throw new HttpError(400, "Dados inválidos.", { [key]: "Valor inválido." });
          if ((key === "name" || key === "address") && !b[key].trim())
            throw new HttpError(400, "Dados inválidos.", { [key]: "Campo obrigatório." });
          values.push(b[key].trim());
          sets.push(`${key}=$${values.length}`);
        }
      }
      if ("materials" in b) {
        if (!validMaterials(b.materials))
          throw new HttpError(400, "Dados inválidos.", { materials: "Selecione ao menos um material." });
        values.push(JSON.stringify(b.materials));
        sets.push(`materials=$${values.length}`);
      }
      if ("active" in b) {
        if (typeof b.active !== "boolean")
          throw new HttpError(400, "Dados inválidos.", { active: "Valor inválido." });
        values.push(b.active);
        sets.push(`active=$${values.length}`);
      }
      if (!sets.length) return res.json({ point: publicPoint(found.rows[0]) });
      values.push(req.params.id);
      const { rows } = await q(
        `UPDATE points SET ${sets.join(",")} WHERE id=$${values.length} RETURNING *`,
        values,
      );
      res.json({ point: publicPoint(rows[0]) });
    }),
  );

  // ---------- Favorites ----------
  app.get(
    "/api/favorites",
    auth,
    wrap(async (req, res) => {
      const { rows } = await q("SELECT point_id FROM favorites WHERE user_id=$1", [req.user.id]);
      res.json({ items: rows.map((r) => r.point_id), hasMore: false, nextOffset: null });
    }),
  );

  app.put(
    "/api/favorites/:id",
    auth,
    checkId,
    wrap(async (req, res) => {
      const point = await q("SELECT 1 FROM points WHERE id=$1", [req.params.id]);
      if (!point.rows.length) throw new HttpError(404, "Ponto não encontrado.");
      await q(
        "INSERT INTO favorites (user_id,point_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
        [req.user.id, req.params.id],
      );
      res.status(204).end();
    }),
  );

  app.delete(
    "/api/favorites/:id",
    auth,
    checkId,
    wrap(async (req, res) => {
      await q("DELETE FROM favorites WHERE user_id=$1 AND point_id=$2", [
        req.user.id,
        req.params.id,
      ]);
      res.status(204).end();
    }),
  );

  // ---------- Notifications ----------
  app.get(
    "/api/notifications",
    auth,
    wrap(async (req, res) => {
      const { rows } = await q(
        "SELECT id,title,body,read FROM notifications WHERE user_id=$1 ORDER BY created_at DESC, id",
        [req.user.id],
      );
      res.json({
        items: rows.map((n) => ({ id: n.id, title: n.title, body: n.body, read: n.read })),
        hasMore: false,
        nextOffset: null,
      });
    }),
  );

  app.patch(
    "/api/notifications/read-all",
    auth,
    wrap(async (req, res) => {
      await q("UPDATE notifications SET read=true WHERE user_id=$1 AND read=false", [
        req.user.id,
      ]);
      res.json({ ok: true });
    }),
  );

  // ---------- Requests ----------
  const REQUEST_SELECT = `SELECT r.*, u.name AS resident_name, d.name AS driver_name,
      p.name AS point_name, p.address AS point_address, p.owner_id AS point_owner_id
    FROM requests r
    JOIN users u ON u.id = r.resident_id
    LEFT JOIN users d ON d.id = r.driver_id
    LEFT JOIN points p ON p.id = r.point_id`;

  async function getRequest(id) {
    const { rows } = await q(`${REQUEST_SELECT} WHERE r.id=$1`, [id]);
    return rows[0];
  }

  app.post(
    "/api/requests",
    auth,
    wrap(async (req, res) => {
      if (req.user.role !== "resident")
        throw new HttpError(403, "Apenas moradores podem solicitar coletas.");
      const b = req.body || {};
      const fields = {};
      const date = normalizeDate(b.date);
      if (!date) fields.date = "Data inválida. Use DD/MM/AAAA ou AAAA-MM-DD.";
      else if (date < todayIn(timeZone)) fields.date = "A data não pode estar no passado.";
      const quantity = Number(b.quantity);
      if (!(quantity > 0) || !Number.isFinite(quantity)) fields.quantity = "Informe a quantidade.";
      if (!validMaterials(b.materials)) fields.materials = "Selecione ao menos um material.";
      if (!str(b.period)) fields.period = "Informe o período.";
      const address = str(b.address) || str(req.user.address);
      if (!address) fields.address = "Informe o endereço.";
      if (typeof b.pointId !== "string" || !UUID_RE.test(b.pointId))
        fields.pointId = "Ponto inválido.";
      if (Object.keys(fields).length)
        throw new HttpError(400, "Confira os dados informados.", fields);
      const point = await q("SELECT id, materials FROM points WHERE id=$1 AND active=true", [b.pointId]);
      if (!point.rows.length)
        throw new HttpError(400, "Ponto indisponível.", { pointId: "Ponto indisponível." });
      const accepted = new Set(point.rows[0].materials || []);
      if (!b.materials.every((m) => accepted.has(m)))
        throw new HttpError(400, "O ponto selecionado não recebe todos os materiais.", {
          pointId: "Selecione um ponto que receba todos os materiais escolhidos.",
        });
      const id = randomUUID();
      await q(
        `INSERT INTO requests (id,resident_id,point_id,materials,quantity,date,period,address,notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          id,
          req.user.id,
          b.pointId,
          JSON.stringify(b.materials),
          quantity,
          date,
          str(b.period),
          address,
          str(b.notes),
        ],
      );
      await notify(req.user.id, "Coleta solicitada", "Sua solicitação foi criada e aguarda um motorista.");
      res.status(201).json({ request: publicRequest(await getRequest(id), req.user) });
    }),
  );

  app.get(
    "/api/requests/available",
    auth,
    wrap(async (req, res) => {
      if (req.user.role !== "driver")
        throw new HttpError(403, "Apenas motoristas podem ver coletas disponíveis.");
      const page = parsePage(req);
      const { rows } = await q(
        `${REQUEST_SELECT}
         WHERE r.status = 0 AND r.cancelled = false AND r.driver_id IS NULL
         ORDER BY r.created_at, r.id LIMIT $1 OFFSET $2`,
        [page.limit + 1, page.offset],
      );
      res.json(pageResult(rows, page, (r) => publicRequest(r, req.user)));
    }),
  );

  app.get(
    "/api/requests",
    auth,
    wrap(async (req, res) => {
      const page = parsePage(req);
      const { rows } = await q(
        `${REQUEST_SELECT}
         WHERE r.resident_id = $1 OR r.driver_id = $1 OR p.owner_id = $1
         ORDER BY r.created_at DESC, r.id LIMIT $2 OFFSET $3`,
        [req.user.id, page.limit + 1, page.offset],
      );
      res.json(pageResult(rows, page, (r) => publicRequest(r, req.user)));
    }),
  );

  const ACTIONS = {
    accept: { from: 0, to: 1, msg: "Um motorista aceitou sua coleta." },
    pickup: { from: 1, to: 2, msg: "Seus materiais foram retirados." },
    deliver: { from: 2, to: 3, msg: "Seus materiais foram entregues ao ponto." },
    receive: { from: 3, to: 4, msg: "O ponto confirmou o recebimento. Coleta concluída!" },
  };

  app.post(
    "/api/requests/:id/:action",
    auth,
    wrap(async (req, res) => {
      const { id, action } = req.params;
      if (!UUID_RE.test(id)) throw new HttpError(404, "Coleta não encontrada.");
      if (action !== "cancel" && !ACTIONS[action])
        throw new HttpError(404, "Ação inexistente.");
      const current = await getRequest(id);
      if (!current) throw new HttpError(404, "Coleta não encontrada.");
      const me = req.user;

      let updated;
      if (action === "cancel") {
        if (current.resident_id !== me.id)
          throw new HttpError(403, "Apenas o morador pode cancelar a coleta.");
        if (current.cancelled || current.status >= 3)
          throw new HttpError(409, "Esta coleta não pode mais ser cancelada.");
        updated = await q(
          `UPDATE requests SET cancelled=true
           WHERE id=$1 AND cancelled=false AND status < 3 RETURNING id`,
          [id],
        );
        if (!updated.rows.length) throw new HttpError(409, "Esta coleta não pode mais ser cancelada.");
        if (current.driver_id)
          await notify(current.driver_id, "Coleta cancelada", "O morador cancelou a coleta.");
        await notify(me.id, "Coleta cancelada", "Sua coleta foi cancelada.");
      } else {
        const step = ACTIONS[action];
        if (action === "accept") {
          if (me.role !== "driver")
            throw new HttpError(403, "Apenas motoristas podem aceitar coletas.");
          if (me.online === false)
            throw new HttpError(409, "Ative sua disponibilidade para aceitar coletas.");
        } else if (action === "receive") {
          if (current.point_owner_id !== me.id)
            throw new HttpError(403, "Apenas o responsável pelo ponto pode confirmar o recebimento.");
        } else if (current.driver_id !== me.id) {
          throw new HttpError(403, "Apenas o motorista da coleta pode avançar esta etapa.");
        }
        if (current.cancelled || current.status !== step.from)
          throw new HttpError(409, "A coleta não está na etapa esperada.");
        updated =
          action === "accept"
            ? await q(
                `UPDATE requests SET status=$2, driver_id=$3
                 WHERE id=$1 AND status=$4 AND cancelled=false AND driver_id IS NULL RETURNING id`,
                [id, step.to, me.id, step.from],
              )
            : await q(
                `UPDATE requests SET status=$2
                 WHERE id=$1 AND status=$3 AND cancelled=false RETURNING id`,
                [id, step.to, step.from],
              );
        if (!updated.rows.length)
          throw new HttpError(409, "A coleta não está na etapa esperada.");
        await notify(current.resident_id, "Atualização da coleta", step.msg);
        if (action === "deliver" && current.point_owner_id) {
          await notify(
            current.point_owner_id,
            "Entrega aguardando confirmação",
            "Um motorista entregou materiais no seu ponto. Confirme o recebimento.",
          );
        }
      }
      res.json({ request: publicRequest(await getRequest(id), me) });
    }),
  );

  // ---------- Quantum (PennyLane) ----------
  registerQuantumRoutes(app, pool, auth);

  // ---------- Erros ----------
  app.use((_req, _res, next) => next(new HttpError(404, "Rota não encontrada.")));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err?.type === "entity.parse.failed")
      return res.status(400).json({ error: { message: "JSON inválido." } });
    const status = err instanceof HttpError ? err.status : err?.status || 500;
    if (status >= 500) console.error(err);
    const fields = err.fields
      ? Array.isArray(err.fields)
        ? err.fields
        : Object.entries(err.fields).map(([path, message]) => ({ path, message }))
      : undefined;
    res.status(status).json({
      error: {
        message: status >= 500 ? "Erro interno do servidor." : err.message,
        ...(fields ? { fields } : {}),
      },
    });
  });

  return app;
}
