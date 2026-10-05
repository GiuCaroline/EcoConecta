import { loadConfig } from "./config.js";
import { createPool } from "./db.js";
import { createApp } from "./app.js";
let pool;
try {
  const config = loadConfig();
  pool = createPool(config.databaseUrl);
  await pool.query("SELECT 1");
  const migration = await pool.query(
    "SELECT version FROM schema_migrations WHERE version = '001'",
  );
  if (!migration.rows.length) throw new Error("Migração inicial não aplicada.");
  const app = createApp(pool, config);
  const server = app.listen(config.port, config.host, () =>
    console.log(`EcoConecta API na porta ${config.port}`),
  );
  function stop() {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  }
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
} catch {
  console.error(
    "Não foi possível iniciar. Confira .env, disponibilidade do banco e npm run db:migrate.",
  );
  if (pool) await pool.end();
  process.exitCode = 1;
}
