import { registerQuantumRoutes } from "./quantum.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { ApiError, fail } from "./errors.js";
import { authentication, issueSession, requireRole } from "./auth.js";
import {
  parse,
  registerSchema,
  loginSchema,
  profileSchema,
  pointSchema,
  pointPatchSchema,
  requestSchema,
  idSchema,
  paginationSchema,
  pickupDate,
  MATERIAL_IDS,
} from "./validation.js";
import { transaction } from "./db.js";
import {
  userModel,
  pointModel,
  requestModel,
  notificationModel,
  requestSelect,
} from "./models.js";
import {
  canView,
  getRequest,
  notifyParticipants,
  recordEvent,
  transitionRequest,
} from "./requests.js";

function sendPage(res, rows, map, limit, offset) {
  const hasMore = rows.length > limit;
  res.json({
    items: rows.slice(0, limit).map(map),
    hasMore,
    nextOffset: hasMore ? offset + limit : null,
  });
}
function page(req) {
  return parse(paginationSchema, req.query);
}
function id(req) {
  return parse(idSchema, req.params.id);
}

export function createApp(pool, config) {
  const app = express();
  app.disable("x-powered-by");
  if (config.trustProxyHops) app.set("trust proxy", config.trustProxyHops);
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.corsOrigins.includes(origin))
          callback(null, true);
        else
          callback(
            new ApiError(403, "CORS_FORBIDDEN", "Origem web não autorizada."),
          );
      },
    }),
  );
  app.use(express.json({ limit: "32kb" }));
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: {
        code: "RATE_LIMIT",
        message: "Muitas requisições. Aguarde um pouco.",
      },
    },
  });
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: {
        code: "AUTH_RATE_LIMIT",
        message: "Muitas tentativas. Tente novamente em alguns minutos.",
      },
    },
  });
  app.use("/api", limiter, (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  const auth = authentication(pool);
  const quantumLimiter = rateLimit({ windowMs: 60000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false, message: { error: { code: "QUANTUM_RATE_LIMIT", message: "Muitas simulações. Aguarde um minuto." } } });
  registerQuantumRoutes(app, pool, config, auth, quantumLimiter);
  // Comparação também para e-mails ausentes, sem revelar se uma conta existe.
  const dummyHash = bcrypt.hashSync("not-a-real-password", config.bcryptRounds);

  app.get("/health", async (req, res) => {
    await pool.query("SELECT 1");
    res.json({ status: "ok", service: "ecoconecta-api" });
  });
  app.get("/api/materials", async (req, res) => {
    const { rows } = await pool.query(
      "SELECT id,name,icon,tip FROM materials ORDER BY id",
    );
    res.json({ items: rows });
  });
  app.post("/api/auth/register", authLimiter, async (req, res) => {
    const input = parse(registerSchema, req.body);
    const hash = await bcrypt.hash(input.password, config.bcryptRounds);
    const result = await transaction(pool, async (db) => {
      const { rows } = await db.query(
        "INSERT INTO users(id,name,email,password_hash,role,phone,address) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
        [
          randomUUID(),
          input.name,
          input.email,
          hash,
          input.role,
          input.phone,
          input.address,
        ],
      );
      return {
        user: userModel(rows[0]),
        ...(await issueSession(db, rows[0].id, config.sessionDays)),
      };
    });
    res.status(201).json(result);
  });
  app.post("/api/auth/login", authLimiter, async (req, res) => {
    const input = parse(loginSchema, req.body);
    const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [
      input.email,
    ]);
    const valid = await bcrypt.compare(
      input.password,
      rows[0]?.password_hash || dummyHash,
    );
    if (!rows[0] || !valid)
      fail(401, "INVALID_CREDENTIALS", "E-mail ou senha incorretos.");
    res.json({
      user: userModel(rows[0]),
      ...(await issueSession(pool, rows[0].id, config.sessionDays)),
    });
  });
  app.post("/api/auth/logout", auth, async (req, res) => {
    await pool.query("DELETE FROM sessions WHERE token_hash = $1", [
      req.sessionHash,
    ]);
    res.status(204).end();
  });
  app.get("/api/auth/me", auth, (req, res) =>
    res.json({ user: userModel(req.user) }),
  );
  app.patch("/api/users/me", auth, async (req, res) => {
    const input = parse(profileSchema, req.body);
    if (
      req.user.role !== "driver" &&
      ["online", "vehicle", "plate"].some((k) => k in input)
    )
      fail(
        403,
        "FORBIDDEN",
        "Dados de veículo e disponibilidade são exclusivos do motorista.",
      );
    const keys = Object.keys(input);
    // Os nomes de coluna vêm de uma lista fixa validada, nunca do SQL enviado pelo usuário.
    const assignments = keys.map((key, i) => `${key} = $${i + 2}`).join(", ");
    const { rows } = await pool.query(
      `UPDATE users SET ${assignments}, updated_at = now() WHERE id = $1 RETURNING *`,
      [req.user.id, ...keys.map((k) => input[k])],
    );
    res.json({ user: userModel(rows[0]) });
  });

  app.get("/api/points/mine", auth, async (req, res) => {
    requireRole(req, "point");
    const { limit, offset } = page(req);
    const { rows } = await pool.query(
      "SELECT * FROM points WHERE owner_id = $1 ORDER BY created_at DESC, id LIMIT $2 OFFSET $3",
      [req.user.id, limit + 1, offset],
    );
    sendPage(res, rows, pointModel, limit, offset);
  });
  app.get("/api/points", auth, async (req, res) => {
    const { limit, offset } = page(req);
    const search =
      typeof req.query.search === "string"
        ? req.query.search.slice(0, 150)
        : "";
    const material =
      typeof req.query.material === "string" ? req.query.material : "";
    if (material && !MATERIAL_IDS.includes(material))
      fail(400, "INVALID_MATERIAL", "Material inválido.");
    if (req.query.active && !["true", "false"].includes(req.query.active))
      fail(400, "VALIDATION_ERROR", "active deve ser true ou false.");
    if (req.query.favorites && !["true", "false"].includes(req.query.favorites))
      fail(400, "VALIDATION_ERROR", "favorites deve ser true ou false.");
    // Posição dos parâmetros fixa; caracteres de busca não entram no SQL.
    const { rows } = await pool.query(
      `SELECT p.* FROM points p WHERE (p.name ILIKE $1 OR p.address ILIKE $1) AND ($2 = '' OR $2 = ANY(p.materials)) AND ($3::boolean IS NULL OR p.active = $3) AND (NOT $4::boolean OR EXISTS (SELECT 1 FROM favorites f WHERE f.point_id = p.id AND f.user_id = $5)) ORDER BY p.created_at DESC,p.id LIMIT $6 OFFSET $7`,
      [
        `%${search}%`,
        material,
        req.query.active === undefined ? null : req.query.active === "true",
        req.query.favorites === "true",
        req.user.id,
        limit + 1,
        offset,
      ],
    );
    sendPage(res, rows, pointModel, limit, offset);
  });
  app.get("/api/points/:id", auth, async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM points WHERE id = $1", [
      id(req),
    ]);
    if (!rows[0]) fail(404, "NOT_FOUND", "Ponto não encontrado.");
    res.json({ point: pointModel(rows[0]) });
  });
  app.post("/api/points", auth, async (req, res) => {
    requireRole(req, "point");
    const p = parse(pointSchema, req.body);
    const { rows } = await pool.query(
      "INSERT INTO points(id,owner_id,name,address,phone,hours,description,materials,active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
      [
        randomUUID(),
        req.user.id,
        p.name,
        p.address,
        p.phone,
        p.hours,
        p.description,
        p.materials,
        p.active,
      ],
    );
    res.status(201).json({ point: pointModel(rows[0]) });
  });
  app.patch("/api/points/:id", auth, async (req, res) => {
    requireRole(req, "point");
    const input = parse(pointPatchSchema, req.body);
    const keys = Object.keys(input);
    const assignments = keys.map((key, i) => `${key} = $${i + 3}`).join(", ");
    const { rows } = await pool.query(
      `UPDATE points SET ${assignments}, updated_at = now() WHERE id = $1 AND owner_id = $2 RETURNING *`,
      [id(req), req.user.id, ...keys.map((k) => input[k])],
    );
    if (!rows[0])
      fail(404, "NOT_FOUND", "Ponto não encontrado ou não pertence a você.");
    res.json({ point: pointModel(rows[0]) });
  });

  app.get("/api/favorites", auth, async (req, res) => {
    const { limit, offset } = page(req);
    const { rows } = await pool.query(
      "SELECT point_id FROM favorites WHERE user_id = $1 ORDER BY point_id LIMIT $2 OFFSET $3",
      [req.user.id, limit + 1, offset],
    );
    sendPage(res, rows, (r) => r.point_id, limit, offset);
  });
  app.put("/api/favorites/:id", auth, async (req, res) => {
    const pointId = id(req);
    const exists = await pool.query("SELECT id FROM points WHERE id = $1", [
      pointId,
    ]);
    if (!exists.rows[0]) fail(404, "NOT_FOUND", "Ponto não encontrado.");
    await pool.query(
      "INSERT INTO favorites(user_id,point_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [req.user.id, pointId],
    );
    res.status(204).end();
  });
  app.delete("/api/favorites/:id", auth, async (req, res) => {
    await pool.query(
      "DELETE FROM favorites WHERE user_id = $1 AND point_id = $2",
      [req.user.id, id(req)],
    );
    res.status(204).end();
  });

  app.post("/api/requests", auth, async (req, res) => {
    requireRole(req, "resident");
    const input = parse(requestSchema, req.body);
    const date = pickupDate(input.date, config.timeZone);
    const result = await transaction(pool, async (db) => {
      const { rows } = await db.query(
        "SELECT * FROM points WHERE id = $1 FOR UPDATE",
        [input.pointId],
      );
      const point = rows[0];
      if (!point) fail(404, "NOT_FOUND", "Ponto não encontrado.");
      if (
        !point.active ||
        !input.materials.every((m) => point.materials.includes(m))
      )
        fail(
          409,
          "POINT_UNAVAILABLE",
          "O ponto está pausado ou não recebe todos os materiais escolhidos.",
        );
      const requestId = randomUUID();
      await db.query(
        "INSERT INTO requests(id,resident_id,point_id,materials,quantity,pickup_date,period,address,notes,point_name,point_address) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
        [
          requestId,
          req.user.id,
          point.id,
          input.materials,
          input.quantity,
          date,
          input.period,
          input.address,
          input.notes,
          point.name,
          point.address,
        ],
      );
      await recordEvent(db, requestId, req.user.id, "created", null, 0);
      const row = await getRequest(db, requestId);
      await notifyParticipants(
        db,
        row,
        "Coleta solicitada",
        "Um novo pedido está aguardando motorista.",
      );
      return requestModel(row, req.user);
    });
    res.status(201).json({ request: result });
  });
  app.get("/api/requests/available", auth, async (req, res) => {
    requireRole(req, "driver");
    const { limit, offset } = page(req);
    const { rows } = await pool.query(
      `${requestSelect} WHERE r.status = 0 AND NOT r.cancelled ORDER BY r.created_at DESC,r.id LIMIT $1 OFFSET $2`,
      [limit + 1, offset],
    );
    sendPage(res, rows, (r) => requestModel(r, req.user), limit, offset);
  });
  app.get("/api/requests", auth, async (req, res) => {
    const { limit, offset } = page(req);
    const scope =
      req.user.role === "resident"
        ? "r.resident_id"
        : req.user.role === "driver"
          ? "r.driver_id"
          : "p.owner_id";
    const { rows } = await pool.query(
      `${requestSelect} WHERE ${scope} = $1 ORDER BY r.created_at DESC,r.id LIMIT $2 OFFSET $3`,
      [req.user.id, limit + 1, offset],
    );
    sendPage(res, rows, (r) => requestModel(r, req.user), limit, offset);
  });
  app.get("/api/requests/:id", auth, async (req, res) => {
    const row = await getRequest(pool, id(req));
    if (!canView(row, req.user))
      fail(404, "NOT_FOUND", "Coleta não encontrada.");
    res.json({ request: requestModel(row, req.user) });
  });
  app.get("/api/requests/:id/events", auth, async (req, res) => {
    const requestId = id(req);
    const row = await getRequest(pool, requestId);
    // Histórico é exclusivo dos envolvidos, não de motoristas ainda não atribuídos.
    if (![row.resident_id, row.driver_id, row.owner_id].includes(req.user.id))
      fail(404, "NOT_FOUND", "Coleta não encontrada.");
    const { rows } = await pool.query(
      'SELECT id,action,from_status AS "fromStatus",to_status AS "toStatus",created_at AS "createdAt" FROM request_events WHERE request_id = $1 ORDER BY created_at,id',
      [requestId],
    );
    res.json({ items: rows });
  });
  for (const action of ["accept", "pickup", "deliver", "receive", "cancel"])
    app.post(`/api/requests/:id/${action}`, auth, async (req, res) => {
      res.json({
        request: await transitionRequest(pool, id(req), req.user, action),
      });
    });

  app.get("/api/notifications", auth, async (req, res) => {
    const { limit, offset } = page(req);
    const { rows } = await pool.query(
      "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC,id LIMIT $2 OFFSET $3",
      [req.user.id, limit + 1, offset],
    );
    sendPage(res, rows, notificationModel, limit, offset);
  });
  app.patch("/api/notifications/read-all", auth, async (req, res) => {
    await pool.query(
      "UPDATE notifications SET read = true WHERE user_id = $1",
      [req.user.id],
    );
    res.status(204).end();
  });
  app.use((req, res) =>
    res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Rota não encontrada." } }),
  );
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof ApiError)
      return res
        .status(error.status)
        .json({
          error: {
            code: error.code,
            message: error.message,
            ...(error.fields ? { fields: error.fields } : {}),
          },
        });
    if (error.code === "23505")
      return res
        .status(409)
        .json({
          error: {
            code: "DUPLICATE",
            message: "Já existe uma conta com esse e-mail.",
          },
        });
    if (error.type === "entity.parse.failed")
      return res
        .status(400)
        .json({ error: { code: "INVALID_JSON", message: "JSON inválido." } });
    if (error.type === "entity.too.large")
      return res
        .status(413)
        .json({
          error: {
            code: "PAYLOAD_TOO_LARGE",
            message: "O corpo da requisição é muito grande.",
          },
        });
    // Não logar objetos de erro do banco: podem conter SQL e dados pessoais.
    console.error(
      `Falha interna em ${req.method}; código ${String(error.code || "UNKNOWN").slice(0, 30)}`,
    );
    res
      .status(500)
      .json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Não foi possível concluir a operação. Tente novamente.",
        },
      });
  });
  return app;
}
