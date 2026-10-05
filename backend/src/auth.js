import { createHash, randomBytes } from "node:crypto";
import { fail } from "./errors.js";

export const tokenHash = (token) =>
  createHash("sha256").update(token).digest("hex");
export async function issueSession(db, userId, days) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + days * 86400000);
  await db.query(
    "INSERT INTO sessions(token_hash, user_id, expires_at) VALUES ($1,$2,$3)",
    [tokenHash(token), userId, expiresAt],
  );
  return { token, expiresAt: expiresAt.toISOString() };
}
export function authentication(pool) {
  return async (req, res, next) => {
    const match = /^Bearer ([a-f0-9]{64})$/i.exec(
      req.headers.authorization || "",
    );
    if (!match) fail(401, "UNAUTHORIZED", "Entre na sua conta para continuar.");
    const hash = tokenHash(match[1]);
    const { rows } = await pool.query(
      "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()",
      [hash],
    );
    if (!rows[0])
      fail(401, "SESSION_EXPIRED", "Sua sessão expirou. Entre novamente.");
    req.user = rows[0];
    req.sessionHash = hash;
    next();
  };
}
export function requireRole(req, role) {
  if (req.user.role !== role)
    fail(403, "FORBIDDEN", "Seu perfil não pode realizar esta ação.");
}
