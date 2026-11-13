// backend/src/server.js
// Ponto de entrada standalone da API EcoConecta.
// - Com DATABASE_URL: usa PostgreSQL (ex.: Neon) via pg.Pool.
// - Sem DATABASE_URL: usa PGlite (PostgreSQL embutido). Os dados ficam em
//   backend/.pglite (ou em memória com PGLITE_DIR=memory).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { seedDatabase } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, "../db/001_initial.sql");

async function createPool() {
  if (process.env.DATABASE_URL) {
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
    });
    return { pool, label: "PostgreSQL (DATABASE_URL)", close: () => pool.end() };
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR || path.resolve(__dirname, "../.pglite");
  const db = dir === "memory" ? new PGlite() : new PGlite(dir);
  await db.waitReady;

  // Fila simples: PGlite executa uma consulta por vez.
  let tail = Promise.resolve();
  async function lock() {
    let release;
    const previous = tail;
    tail = new Promise((resolve) => (release = resolve));
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
    exec: (sql) => db.exec(sql),
  };
  return {
    pool,
    label: dir === "memory" ? "PGlite (memória)" : `PGlite (${dir})`,
    close: () => db.close(),
  };
}

async function main() {
  const { pool, label, close } = await createPool();
  const schema = await readFile(schemaPath, "utf8");
  if (pool.exec) await pool.exec(schema);
  else await pool.query(schema);

  if (process.env.SEED !== "false") await seedDatabase(pool);

  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined; // undefined = libera qualquer origem (Expo Web/dev)

  const app = createApp(pool, {
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 10,
    sessionDays: Number(process.env.SESSION_DAYS) || 7,
    timeZone: process.env.TZ_APP || "America/Sao_Paulo",
    corsOrigins,
    trustProxyHops: Number(process.env.TRUST_PROXY_HOPS) || 0,
  });

  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || "0.0.0.0";
  const server = app.listen(port, host, () => {
    console.log(`[EcoConecta] API em http://localhost:${port} — banco: ${label}`);
  });

  const shutdown = async () => {
    server.close();
    await close().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[EcoConecta] Falha ao iniciar:", err);
  process.exit(1);
});
