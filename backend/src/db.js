import pg from "pg";

// DATE é data civil, sem conversão de fuso horário.
pg.types.setTypeParser(1082, (value) => value);

export function connectionOptions(connectionString) {
  const url = new URL(connectionString);
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(
    url.hostname,
  );
  // pg pode sobrescrever ssl ao ler sslmode da URL. Centralizamos a configuração.
  for (const key of [
    "sslmode",
    "sslcert",
    "sslkey",
    "sslrootcert",
    "channel_binding",
  ])
    url.searchParams.delete(key);
  return {
    connectionString: url.toString(),
    ssl: local ? false : { rejectUnauthorized: true },
    connectionTimeoutMillis: 15000,
  };
}
export function createPool(url) {
  const pool = new pg.Pool({
    ...connectionOptions(url),
    max: 10,
    idleTimeoutMillis: 30000,
  });
  pool.on("error", () =>
    console.error(
      "Falha em conexão ociosa do banco; verifique a disponibilidade.",
    ),
  );
  return pool;
}
export async function transaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
