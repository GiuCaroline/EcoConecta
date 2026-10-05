import "dotenv/config";
import { z } from "zod";

export function loadConfig(env = process.env) {
  const data = z
    .object({
      NODE_ENV: z
        .enum(["development", "production", "test"])
        .default("development"),
      DATABASE_URL: z.string().url(),
      DIRECT_DATABASE_URL: z.string().url().optional().or(z.literal("")),
      PORT: z.coerce.number().int().min(1).max(65535).default(3000),
      HOST: z.string().default("0.0.0.0"),
      APP_TIMEZONE: z.string().default("America/Sao_Paulo"),
      SESSION_DAYS: z.coerce.number().int().min(1).max(30).default(7),
      BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
      CORS_ORIGINS: z.string().default("http://localhost:8081"),
      TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
      QUANTUM_API_URL: z.string().url().refine(v => ["http:", "https:"].includes(new URL(v).protocol)).optional().or(z.literal("")),
      QUANTUM_API_KEY: z.string().min(32).max(256).optional().or(z.literal("")),
      QUANTUM_REFERENCE_KG: z.coerce.number().positive().max(100000).default(20),
      QUANTUM_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(10000),
    })
    .safeParse(env);
  if (!data.success)
    throw new Error(
      "Configuração inválida. Confira os nomes e valores em .env (nenhuma credencial é exibida).",
    );
  const c = data.data;
  new Intl.DateTimeFormat("en-CA", { timeZone: c.APP_TIMEZONE });
  return {
    databaseUrl: c.DATABASE_URL,
    directDatabaseUrl: c.DIRECT_DATABASE_URL || c.DATABASE_URL,
    port: c.PORT,
    host: c.HOST,
    timeZone: c.APP_TIMEZONE,
    sessionDays: c.SESSION_DAYS,
    bcryptRounds: c.BCRYPT_ROUNDS,
    corsOrigins: c.CORS_ORIGINS.split(",")
      .map((v) => v.trim())
      .filter(Boolean),
    trustProxyHops: c.TRUST_PROXY_HOPS,
    production: c.NODE_ENV === "production",
    quantumApiUrl: c.QUANTUM_API_URL || "",
    quantumApiKey: c.QUANTUM_API_KEY || "",
    quantumReferenceKg: c.QUANTUM_REFERENCE_KG,
    quantumTimeoutMs: c.QUANTUM_TIMEOUT_MS,
  };
}
