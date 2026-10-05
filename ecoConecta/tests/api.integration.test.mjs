import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createApiClient } from "../src/services/apiClient.js";
const candidates = [
  process.env.ECOCONECTA_BACKEND_DIR,
  fileURLToPath(new URL("../../EcoConecta-Backend/", import.meta.url)),
  fileURLToPath(new URL("../../backend/", import.meta.url)),
].filter(Boolean);
const backend = candidates.find(
  (p) =>
    existsSync(p + "/src/app.js") &&
    existsSync(p + "/node_modules/@electric-sql/pglite"),
);
let server, db, pool, host, point, request, resident, driver, owner;
const memory = () => {
  let token = null;
  return {
    get: async () => token,
    set: async (value) => {
      token = value;
    },
    clear: async () => {
      token = null;
    },
  };
};
const client = () => createApiClient({ baseUrl: host, storage: memory() });
test(
  "cliente real do frontend → API → PostgreSQL",
  {
    skip:
      !backend &&
      "Instale o backend ao lado do frontend para executar a integração.",
  },
  async (t) => {
    const require = createRequire(backend + "/package.json");
    const { PGlite } = require("@electric-sql/pglite");
    const { createApp } = await import(pathToFileURL(backend + "/src/app.js"));
    db = new PGlite();
    await db.exec(await readFile(backend + "/db/001_initial.sql", "utf8"));
    let tail = Promise.resolve();
    async function lock() {
      let release;
      const previous = tail;
      tail = new Promise((r) => (release = r));
      await previous;
      return release;
    }
    pool = {
      async query(sql, values) {
        const release = await lock();
        try {
          return await db.query(sql, values);
        } finally {
          release();
        }
      },
      async connect() {
        const release = await lock();
        return { query: (sql, values) => db.query(sql, values), release };
      },
    };
    server = createApp(pool, {
      bcryptRounds: 4,
      sessionDays: 7,
      timeZone: "America/Sao_Paulo",
      corsOrigins: [],
      trustProxyHops: 0,
    }).listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    host = `http://127.0.0.1:${server.address().port}`;
    try {
      await t.test("cadastro/login têm senha real e perfil fixo", async () => {
        owner = client();
        resident = client();
        driver = client();
        await owner.register({
          name: "Responsável",
          email: "owner@example.com",
          password: "SenhaTeste123",
          role: "point",
        });
        await resident.register({
          name: "Morador",
          email: "resident@example.com",
          password: "SenhaTeste123",
          role: "resident",
        });
        await driver.register({
          name: "Motorista",
          email: "driver@example.com",
          password: "SenhaTeste123",
          role: "driver",
        });
        await assert.rejects(
          () => resident.updateUser({ role: "driver" }),
          (e) => e.status === 400,
        );
        const bad = client();
        await assert.rejects(
          () => bad.login("resident@example.com", "incorreta"),
          (e) => e.status === 401,
        );
        assert.equal(await bad.getSessionToken(), null);
        const rows = await db.query("SELECT role,password_hash FROM users");
        assert.equal(rows.rows.length, 3);
        assert.ok(rows.rows.every((r) => r.password_hash !== "SenhaTeste123"));
      });
      await t.test(
        "pontos, favoritos e perfil são gravados e carregados",
        async () => {
          point = await owner.savePoint({
            name: "Ponto Banco",
            address: "Rua Destino 100, Centro, Mauá",
            phone: "11999999999",
            hours: "08h às 17h",
            description: "Ponto real de integração",
            materials: ["paper"],
            active: true,
          });
          await owner.savePoint({ active: false }, point.id);
          await owner.savePoint({ active: true }, point.id);
          await resident.setFavorite(point.id, true);
          await resident.updateUser({
            name: "Morador Atualizado",
            address: "Rua Origem 200, Centro, Mauá",
          });
          const data = await resident.loadAppData();
          assert.equal(data.user.name, "Morador Atualizado");
          assert.deepEqual(data.favorites, [point.id]);
          assert.equal(data.points[0].id, point.id);
          assert.deepEqual(data.requests, []);
          await resident.setFavorite(point.id, false);
          assert.deepEqual((await resident.loadAppData()).favorites, []);
        },
      );
      await t.test(
        "três contas distintas completam coleta e notificações",
        async () => {
          const now = new Date();
          const date = new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Sao_Paulo",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(now);
          request = await resident.createRequest({
            pointId: point.id,
            materials: ["paper"],
            quantity: 5,
            date,
            period: "Manhã · 08h–12h",
            address: "Rua Origem 200, Centro, Mauá",
            notes: "",
          });
          assert.match(request.id, /^[0-9a-f-]{36}$/);
          assert.equal(request.status, 0);
          const before = await driver.loadAppData();
          assert.equal(before.requests.length, 1);
          assert.match(before.requests[0].address, /após aceitar/);
          await assert.rejects(
            () => resident.acceptRequest(request.id),
            (e) => e.status === 403,
          );
          assert.equal((await driver.acceptRequest(request.id)).status, 1);
          assert.equal((await driver.pickupRequest(request.id)).status, 2);
          assert.equal((await driver.deliverRequest(request.id)).status, 3);
          assert.equal((await owner.receiveRequest(request.id)).status, 4);
          const final = await resident.loadAppData();
          assert.equal(final.requests[0].status, 4);
          assert.ok(final.notifications.length > 0);
          await resident.markNotificationsRead();
          assert.ok(
            (await resident.loadAppData()).notifications.every((n) => n.read),
          );
          assert.equal(
            (
              await db.query("SELECT status FROM requests WHERE id=$1", [
                request.id,
              ])
            ).rows[0].status,
            4,
          );
        },
      );
      await t.test(
        "logout revoga token e outra conta não herda dados privados",
        async () => {
          const token = await resident.getSessionToken();
          await resident.logout();
          assert.equal(await resident.getSessionToken(), null);
          const response = await fetch(host + "/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          assert.equal(response.status, 401);
          await resident.register({
            name: "Outro Morador",
            email: "other@example.com",
            password: "SenhaTeste123",
            role: "resident",
          });
          const data = await resident.loadAppData();
          assert.deepEqual(data.requests, []);
          assert.deepEqual(data.favorites, []);
          assert.deepEqual(data.notifications, []);
        },
      );
      await t.test(
        "401 remove sessão; indisponibilidade não vira autenticação fictícia",
        async () => {
          let expired = false;
          resident.setSessionExpiredHandler(() => {
            expired = true;
          });
          await db.query(
            "UPDATE sessions SET expires_at=now()-interval '1 day'",
          );
          await assert.rejects(
            () => resident.loadAppData(),
            (e) => e.status === 401,
          );
          assert.ok(expired);
          assert.equal(await resident.getSessionToken(), null);
          const unavailable = createApiClient({
            baseUrl: host,
            storage: memory(),
            fetcher: async () => {
              throw new TypeError("fetch failed");
            },
          });
          await assert.rejects(
            () => unavailable.login("x@example.com", "SenhaTeste123"),
            /Não foi possível conectar/,
          );
          assert.equal(await unavailable.getSessionToken(), null);
        },
      );
    } finally {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      await db.close();
    }
  },
);
