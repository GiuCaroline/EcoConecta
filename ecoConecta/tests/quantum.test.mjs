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
    set: async (value) => {
      token = value;
    },
    clear: async () => {
      token = null;
    },
  };
};

test(
  "rotas quânticas (demo e recomendação autenticada)",
  {
    skip:
      !backend &&
      "Instale o backend ao lado do frontend para executar a integração.",
  },
  async (t) => {
    const require = createRequire(backend + "/package.json");
    const { PGlite } = require("@electric-sql/pglite");
    const { createApp } = await import(pathToFileURL(backend + "/src/app.js"));
    const db = new PGlite();
    await db.exec(await readFile(backend + "/db/001_initial.sql", "utf8"));

    let tail = Promise.resolve();
    async function lock() {
      let release;
      const previous = tail;
      tail = new Promise((r) => (release = r));
      await previous;
      return release;
    }

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
      await t.test("POST /api/quantum/demo calcula circuito quântico", async () => {
        const res = await fetch(`${host}/api/quantum/demo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ volumeA: 5, volumeB: 20 }),
        });
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.deepEqual(body.states, ["00", "01", "10", "11"]);
        assert.equal(body.probabilities.length, 4);
        const sum = body.probabilities.reduce((acc, p) => acc + p, 0);
        assert.ok(Math.abs(sum - 1) < 1e-6);
        assert.ok(Math.abs(body.angles.A - Math.PI / 4) < 1e-6);
        assert.ok(Math.abs(body.angles.B - Math.PI) < 1e-6);
        assert.ok(body.states.includes(body.bestState));
        assert.equal(typeof body.decision, "string");
        assert.ok(body.decision.length > 0);
        assert.ok(Array.isArray(body.visitOrder));
        assert.equal(body.inputs.referenceKg, 20);
      });

      await t.test(
        "POST /api/quantum/recommendation autenticado compara 2 pedidos do banco",
        async () => {
          const owner = client();
          const resident = client();

          await owner.register({
            name: "Ponto Quântico",
            email: "quantum-point@example.com",
            password: "SenhaTeste123",
            role: "point",
          });
          await resident.register({
            name: "Morador Quântico",
            email: "quantum-resident@example.com",
            password: "SenhaTeste123",
            role: "resident",
          });

          const point = await owner.savePoint({
            name: "Ponto Central",
            address: "Rua Quântica 10, Centro, Mauá",
            phone: "11999999999",
            hours: "08h às 17h",
            description: "Ponto para teste quântico",
            materials: ["paper", "plastic"],
            active: true,
          });

          const date = new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Sao_Paulo",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date());

          const r1 = await resident.createRequest({
            pointId: point.id,
            materials: ["paper"],
            quantity: 5,
            date,
            period: "Manhã · 08h–12h",
            address: "Rua A 100, Centro, Mauá",
            notes: "",
          });

          const r2 = await resident.createRequest({
            pointId: point.id,
            materials: ["plastic"],
            quantity: 20,
            date,
            period: "Tarde · 13h–17h",
            address: "Rua B 200, Centro, Mauá",
            notes: "",
          });

          const token = await resident.getSessionToken();
          const res = await fetch(`${host}/api/quantum/recommendation`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ requestIds: [r1.id, r2.id] }),
          });

          assert.equal(res.status, 200);
          const body = await res.json();
          assert.deepEqual(body.states, ["00", "01", "10", "11"]);
          const sum = body.probabilities.reduce((acc, p) => acc + p, 0);
          assert.ok(Math.abs(sum - 1) < 1e-6);
          assert.ok(Math.abs(body.angles.A - Math.PI / 4) < 1e-6);
          assert.ok(Math.abs(body.angles.B - Math.PI) < 1e-6);
          assert.ok(body.states.includes(body.bestState));
          assert.equal(typeof body.decision, "string");
          assert.ok(Array.isArray(body.visitOrder));
          assert.equal(body.inputs.referenceKg, 20);
        },
      );
    } finally {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      await db.close();
    }
  },
);
