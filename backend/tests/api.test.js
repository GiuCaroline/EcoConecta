import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import request from "supertest";
import { createApp } from "../src/app.js";
import { connectionOptions } from "../src/db.js";
import {
  parse,
  pointPatchSchema,
  pickupDate,
  todayIn,
} from "../src/validation.js";

let db, app, resident, stranger, driver1, driver2, owner, otherOwner, point;
// PGlite é PostgreSQL real em WASM; o adapter só fornece a interface Pool.
// Um cliente mantém exclusividade durante a transação para não misturar queries.
function embeddedPool(database) {
  let tail = Promise.resolve();
  async function acquire() {
    let release;
    const previous = tail;
    tail = new Promise((resolve) => (release = resolve));
    await previous;
    return release;
  }
  return {
    async query(sql, values) {
      const release = await acquire();
      try {
        return await database.query(sql, values);
      } finally {
        release();
      }
    },
    async connect() {
      const release = await acquire();
      return { query: (sql, values) => database.query(sql, values), release };
    },
  };
}
const call = (method, path, user) => {
  const r = request(app)[method](path);
  return user ? r.set("Authorization", `Bearer ${user.token}`) : r;
};
async function register(name, email, role) {
  const { body } = await call("post", "/api/auth/register")
    .send({ name, email, password: "Teste123!X", role, phone: "11999999999" })
    .expect(201);
  assert.equal(body.user.password_hash, undefined);
  assert.equal(body.user.password, undefined);
  return body;
}
const newColeta = (overrides) => ({
  pointId: point.id,
  materials: ["paper", "plastic"],
  quantity: "4,5",
  date: todayIn("America/Sao_Paulo"),
  period: "Manhã · 08h–12h",
  address: "Rua Teste 100, Centro, Mauá",
  notes: "Interfone 12",
  ...overrides,
});

before(async () => {
  db = new PGlite();
  await db.exec(
    await readFile(new URL("../db/001_initial.sql", import.meta.url), "utf8"),
  );
  app = createApp(embeddedPool(db), {
    bcryptRounds: 4,
    sessionDays: 7,
    timeZone: "America/Sao_Paulo",
    corsOrigins: ["http://localhost:8081"],
    trustProxyHops: 0,
  });
  resident = await register("Giulia Teste", "giulia@example.com", "resident");
  stranger = await register("Outro Usuário", "outro@example.com", "resident");
  driver1 = await register("Motorista Um", "motorista1@example.com", "driver");
  driver2 = await register(
    "Motorista Dois",
    "motorista2@example.com",
    "driver",
  );
  owner = await register("Ponto Um", "ponto@example.com", "point");
  otherOwner = await register("Outro Ponto", "outroponto@example.com", "point");
  const result = await call("post", "/api/points", owner)
    .send({
      name: "Cooperativa Teste",
      address: "Rua Destino 200, Centro, Mauá",
      phone: "11999999999",
      hours: "Seg a sex, 08h às 17h",
      description: "Ponto de teste",
      materials: ["paper", "plastic", "metal"],
      active: true,
    })
    .expect(201);
  point = result.body.point;
});
after(async () => {
  await db.close();
});

test("configuração Neon usa TLS verificado e preserva credenciais sem log", () => {
  const options = connectionOptions(
    "postgresql://user:fake@ep-example-pooler.us-east-2.aws.neon.tech/db?sslmode=require&channel_binding=require",
  );
  assert.deepEqual(options.ssl, { rejectUnauthorized: true });
  assert.ok(!options.connectionString.includes("sslmode"));
  assert.equal(
    connectionOptions("postgresql://user:fake@localhost/db").ssl,
    false,
  );
});
test("datas civis e PATCH parcial não reativam ponto automaticamente", () => {
  assert.throws(() => pickupDate("31/02/2099", "America/Sao_Paulo"));
  assert.throws(() => pickupDate("01/01/2000", "America/Sao_Paulo"));
  assert.equal(pickupDate("01/01/2099", "America/Sao_Paulo"), "2099-01-01");
  assert.deepEqual(parse(pointPatchSchema, { name: "Novo nome" }), {
    name: "Novo nome",
  });
  assert.equal(
    todayIn("America/Sao_Paulo", new Date("2026-10-06T01:00:00Z")),
    "2026-10-05",
  );
});
test("autenticação real, e-mail normalizado, revogação e conta duplicada", async () => {
  await call("get", "/api/auth/me").expect(401);
  await call("post", "/api/auth/login")
    .send({ email: "giulia@example.com", password: "errada" })
    .expect(401);
  const login = await call("post", "/api/auth/login")
    .send({ email: "GIULIA@example.com", password: "Teste123!X" })
    .expect(200);
  assert.equal(login.body.user.id, resident.user.id);
  await call("post", "/api/auth/register")
    .send({
      name: "Duplicada",
      email: "GIULIA@example.com",
      password: "Teste123!X",
      role: "resident",
    })
    .expect(409);
  await call("post", "/api/auth/logout", login.body).expect(204);
  await call("get", "/api/auth/me", login.body).expect(401);
  const hashes = await db.query("SELECT token_hash FROM sessions");
  assert.ok(hashes.rows.every((r) => r.token_hash !== resident.token));
});
test("conta não troca permissões e ponto só pode ser editado pelo dono", async () => {
  await call("patch", "/api/users/me", resident)
    .send({ role: "driver" })
    .expect(400);
  await call("patch", "/api/users/me", resident)
    .send({ online: false })
    .expect(403);
  await call("post", "/api/points", resident).send({}).expect(403);
  await call("patch", `/api/points/${point.id}`, otherOwner)
    .send({ name: "Tentativa" })
    .expect(404);
  const favorites = await call(
    "put",
    `/api/favorites/${point.id}`,
    resident,
  ).expect(204);
  await call("put", `/api/favorites/${point.id}`, resident).expect(204);
  const list = await call("get", "/api/favorites", resident).expect(200);
  assert.deepEqual(list.body.items, [point.id]);
  const search = await call(
    "get",
    "/api/points?material=paper&favorites=true",
    resident,
  ).expect(200);
  assert.equal(search.body.items.length, 1);
});
test("validação do pedido rejeita peso, data e materiais inválidos", async () => {
  for (const changes of [
    { quantity: 0 },
    { quantity: -1 },
    { quantity: "abc" },
    { quantity: 1.001 },
    { materials: [] },
    { materials: ["paper", "paper"] },
    { materials: ["unknown"] },
    { date: "31/02/2099" },
    { date: "01/01/2000" },
    { residentId: stranger.user.id },
  ])
    await call("post", "/api/requests", resident)
      .send(newColeta(changes))
      .expect(400);
  await call("post", "/api/requests", resident)
    .send(newColeta({ materials: ["glass"] }))
    .expect(409);
  await call("patch", `/api/points/${point.id}`, owner)
    .send({ active: false })
    .expect(200);
  await call("patch", `/api/points/${point.id}`, owner)
    .send({ name: "Nome atualizado" })
    .expect(200);
  const paused = await call("get", `/api/points/${point.id}`, resident).expect(
    200,
  );
  assert.equal(paused.body.point.active, false);
  await call("post", "/api/requests", resident).send(newColeta()).expect(409);
  await call("patch", `/api/points/${point.id}`, owner)
    .send({ active: true })
    .expect(200);
});
test("ciclo completo, sigilo antes do aceite, disputa entre motoristas e auditoria", async () => {
  const created = await call("post", "/api/requests", resident)
    .send(newColeta())
    .expect(201);
  const id = created.body.request.id;
  assert.equal(created.body.request.quantity, 4.5);
  await call("get", `/api/requests/${id}`, stranger).expect(404);
  const hidden = await call("get", `/api/requests/${id}`, driver1).expect(200);
  assert.ok(!hidden.body.request.address.includes("Rua Teste"));
  assert.equal(hidden.body.request.notes, "");
  await call("get", `/api/requests/${id}/events`, driver1).expect(404);
  await call("patch", "/api/users/me", driver1)
    .send({ online: false })
    .expect(200);
  await call("post", `/api/requests/${id}/accept`, driver1).expect(409);
  await call("patch", "/api/users/me", driver1)
    .send({ online: true })
    .expect(200);
  const attempts = await Promise.all([
    call("post", `/api/requests/${id}/accept`, driver1),
    call("post", `/api/requests/${id}/accept`, driver2),
  ]);
  assert.deepEqual(attempts.map((r) => r.status).sort(), [200, 409]);
  const winner = attempts[0].status === 200 ? driver1 : driver2;
  const loser = winner === driver1 ? driver2 : driver1;
  const accepted = attempts.find((r) => r.status === 200).body.request;
  assert.equal(accepted.address, "Rua Teste 100, Centro, Mauá");
  await call("post", `/api/requests/${id}/pickup`, loser).expect(404);
  await call("post", `/api/requests/${id}/cancel`, resident).expect(409);
  await call("post", `/api/requests/${id}/deliver`, winner).expect(409);
  await call("post", `/api/requests/${id}/pickup`, winner).expect(200);
  await call("post", `/api/requests/${id}/pickup`, winner).expect(409);
  await call("post", `/api/requests/${id}/receive`, owner).expect(409);
  await call("post", `/api/requests/${id}/deliver`, winner).expect(200);
  await call("post", `/api/requests/${id}/receive`, otherOwner).expect(404);
  await call("post", `/api/requests/${id}/receive`, winner).expect(403);
  const received = await call(
    "post",
    `/api/requests/${id}/receive`,
    owner,
  ).expect(200);
  assert.equal(received.body.request.status, 4);
  const events = await call(
    "get",
    `/api/requests/${id}/events`,
    resident,
  ).expect(200);
  assert.deepEqual(
    events.body.items.map((e) => e.action),
    ["created", "accepted", "picked_up", "delivered", "received"],
  );
  const notifications = await call(
    "get",
    "/api/notifications",
    resident,
  ).expect(200);
  assert.equal(notifications.body.items.length, 5);
  const otherNotifications = await call(
    "get",
    "/api/notifications",
    stranger,
  ).expect(200);
  assert.equal(otherNotifications.body.items.length, 0);
  await call("patch", "/api/notifications/read-all", resident).expect(204);
  const read = await call("get", "/api/notifications", resident).expect(200);
  assert.ok(read.body.items.every((n) => n.read));
});
test("cancelamento só pelo solicitante e bloqueio de aceite após cancelar", async () => {
  const r = await call("post", "/api/requests", resident)
    .send(newColeta())
    .expect(201);
  const id = r.body.request.id;
  await call("post", `/api/requests/${id}/cancel`, stranger).expect(404);
  await call("post", `/api/requests/${id}/cancel`, resident).expect(200);
  await call("post", `/api/requests/${id}/accept`, driver1).expect(409);
  const count = await db.query(
    "SELECT count(*)::int AS count FROM request_events WHERE request_id=$1",
    [id],
  );
  assert.equal(count.rows[0].count, 2);
});
test("paginação e sessão expirada", async () => {
  const list = await call("get", "/api/requests?limit=1", resident).expect(200);
  assert.equal(list.body.items.length, 1);
  assert.equal(list.body.hasMore, true);
  assert.equal(list.body.nextOffset, 1);
  await call("get", "/api/requests?limit=10000", resident).expect(400);
  await db.query(
    "UPDATE sessions SET expires_at = now() - interval '1 day' WHERE user_id=$1",
    [stranger.user.id],
  );
  await call("get", "/api/auth/me", stranger).expect(401);
});
