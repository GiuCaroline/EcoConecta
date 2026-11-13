import test from "node:test";
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

const memory = () => {
  let token = null;
  return {
    get: async () => token,
    set: async (v) => {
      token = v;
    },
    clear: async () => {
      token = null;
    },
  };
};

test(
  "regressões: campos de erro, compatibilidade de materiais, nomes na coleta e motorista offline",
  {
    skip: !backend && "Instale o backend ao lado do frontend para executar a integração.",
  },
  async () => {
    const require = createRequire(backend + "/package.json");
    const { PGlite } = require("@electric-sql/pglite");
    const { createApp } = await import(pathToFileURL(backend + "/src/app.js"));
    const db = new PGlite();
    await db.exec(await readFile(backend + "/db/001_initial.sql", "utf8"));

    let tail = Promise.resolve();
    const lock = async () => {
      let release;
      const previous = tail;
      tail = new Promise((r) => (release = r));
      await previous;
      return release;
    };
    const pool = {
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

    const server = createApp(pool, {
      bcryptRounds: 4,
      sessionDays: 7,
      timeZone: "America/Sao_Paulo",
      corsOrigins: [],
      trustProxyHops: 0,
    }).listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const host = `http://127.0.0.1:${server.address().port}`;
    const client = () => createApiClient({ baseUrl: host, storage: memory() });

    try {
      // 1. error.fields vem como array [{ path, message }] compatível com Auth.js (.map)
      const invalid = client();
      await assert.rejects(
        () =>
          invalid.register({
            name: "",
            email: "invalido",
            password: "123",
            role: "resident",
          }),
        (err) => {
          assert.equal(err.status, 400);
          assert.ok(Array.isArray(err.fields));
          assert.ok(err.fields.every((f) => typeof f.path === "string" && typeof f.message === "string"));
          return true;
        },
      );

      const owner = client();
      const resident = client();
      const driver = client();
      await owner.register({ name: "Ponto", email: "p@ex.com", password: "SenhaTeste123", role: "point" });
      await resident.register({ name: "Morador", email: "m@ex.com", password: "SenhaTeste123", role: "resident" });
      await driver.register({ name: "Carlos Motorista", email: "d@ex.com", password: "SenhaTeste123", role: "driver" });

      const point = await owner.savePoint({
        name: "EcoPonto Teste",
        address: "Rua Central, 10 — Mauá",
        phone: "11999999999",
        hours: "08h às 17h",
        description: "Ponto de teste",
        materials: ["paper"],
        active: true,
      });

      // 2. Pedido com material não aceito pelo ponto deve retornar 400
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

      await assert.rejects(
        () =>
          resident.createRequest({
            pointId: point.id,
            materials: ["oil"],
            quantity: 3,
            date: today,
            period: "Manhã · 08h–12h",
            address: "Rua Origem, 50 — Mauá",
            notes: "",
          }),
        (err) => err.status === 400,
      );

      const req = await resident.createRequest({
        pointId: point.id,
        materials: ["paper"],
        quantity: 4,
        date: today,
        period: "Manhã · 08h–12h",
        address: "Rua Origem, 50 — Mauá",
        notes: "Portão verde",
      });

      // 3. Motorista offline não pode aceitar coleta
      await driver.updateUser({ online: false });
      await assert.rejects(() => driver.acceptRequest(req.id), (err) => err.status === 409);
      await driver.updateUser({ online: true });

      // 4. Após aceitar, driverName, pointName e pointAddress são retornados, e ponto recebe notificação no deliver
      const accepted = await driver.acceptRequest(req.id);
      assert.equal(accepted.driverName, "Carlos Motorista");
      assert.equal(accepted.pointName, "EcoPonto Teste");
      assert.equal(accepted.pointAddress, "Rua Central, 10 — Mauá");
      assert.equal(accepted.address, "Rua Origem, 50 — Mauá");

      await driver.pickupRequest(req.id);
      await driver.deliverRequest(req.id);

      const ownerData = await owner.loadAppData();
      assert.ok(ownerData.notifications.some((n) => n.title.includes("confirm")));
    } finally {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      await db.close();
    }
  },
);
