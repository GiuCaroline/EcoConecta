import pg from "pg";
import { readFile } from "node:fs/promises";
import { loadConfig } from "../src/config.js";
import { connectionOptions } from "../src/db.js";
const config = loadConfig();
const client = new pg.Client(connectionOptions(config.directDatabaseUrl));
try {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(84729103)");
  const existing = await client.query(
    "SELECT to_regclass('public.schema_migrations') AS name",
  );
  if (existing.rows[0].name) {
    const applied = await client.query(
      "SELECT version FROM schema_migrations WHERE version='001'",
    );
    if (applied.rows.length) {
      await client.query("COMMIT");
      console.log("Migração 001 já aplicada; nenhuma alteração.");
    } else throw new Error("Banco contém esquema desconhecido.");
  } else {
    const sql = await readFile(
      new URL("../db/001_initial.sql", import.meta.url),
      "utf8",
    );
    await client.query(sql);
    await client.query("COMMIT");
    console.log(
      "Migração 001 aplicada. Tabelas e catálogo de materiais criados.",
    );
  }
} catch {
  await client.query("ROLLBACK").catch(() => {});
  console.error(
    "Migração não aplicada. Confira a URL direta e use um banco novo ou com a migração 001 deste projeto.",
  );
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
