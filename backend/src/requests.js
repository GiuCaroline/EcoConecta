import { randomUUID } from "node:crypto";
import { fail } from "./errors.js";
import { transaction } from "./db.js";
import { requestSelect, requestModel } from "./models.js";

export function canView(row, user) {
  return (
    row.resident_id === user.id ||
    row.driver_id === user.id ||
    row.owner_id === user.id ||
    (user.role === "driver" && row.status === 0 && !row.cancelled)
  );
}
export async function getRequest(db, id) {
  const { rows } = await db.query(`${requestSelect} WHERE r.id = $1`, [id]);
  if (!rows[0]) fail(404, "NOT_FOUND", "Coleta não encontrada.");
  return rows[0];
}
export async function recordEvent(db, requestId, actorId, action, from, to) {
  await db.query(
    "INSERT INTO request_events(id,request_id,actor_id,action,from_status,to_status) VALUES ($1,$2,$3,$4,$5,$6)",
    [randomUUID(), requestId, actorId, action, from, to],
  );
}
export async function notifyParticipants(db, row, title, body) {
  const people = [
    ...new Set([row.resident_id, row.driver_id, row.owner_id].filter(Boolean)),
  ];
  for (const userId of people)
    await db.query(
      "INSERT INTO notifications(id,user_id,request_id,title,body) VALUES ($1,$2,$3,$4,$5)",
      [randomUUID(), userId, row.id, title, body],
    );
}
// Etapas explícitas: duas chamadas de retirada nunca viram uma entrega.
const transitions = {
  accept: {
    role: "driver",
    from: 0,
    to: 1,
    event: "accepted",
    title: "Motorista a caminho",
  },
  pickup: {
    role: "driver",
    from: 1,
    to: 2,
    event: "picked_up",
    title: "Material coletado",
  },
  deliver: {
    role: "driver",
    from: 2,
    to: 3,
    event: "delivered",
    title: "Entregue ao ponto",
  },
  receive: {
    role: "point",
    from: 3,
    to: 4,
    event: "received",
    title: "Coleta concluída",
  },
  cancel: {
    role: "resident",
    from: 0,
    to: 0,
    event: "cancelled",
    title: "Coleta cancelada",
  },
};
export async function transitionRequest(pool, id, actor, action) {
  const rule = transitions[action];
  if (!rule || actor.role !== rule.role)
    fail(403, "FORBIDDEN", "Seu perfil não pode realizar esta etapa.");
  return transaction(pool, async (db) => {
    // O lock na coleta impede dois motoristas de aceitarem o mesmo pedido.
    const { rows } = await db.query(
      "SELECT * FROM requests WHERE id = $1 FOR UPDATE",
      [id],
    );
    const current = rows[0];
    if (!current) fail(404, "NOT_FOUND", "Coleta não encontrada.");
    const point = (
      await db.query("SELECT owner_id FROM points WHERE id = $1", [
        current.point_id,
      ])
    ).rows[0];
    if (action === "cancel" && current.resident_id !== actor.id)
      fail(404, "NOT_FOUND", "Coleta não encontrada.");
    if (action === "receive" && point.owner_id !== actor.id)
      fail(404, "NOT_FOUND", "Coleta não encontrada.");
    if (
      ["pickup", "deliver"].includes(action) &&
      current.driver_id !== actor.id
    )
      fail(404, "NOT_FOUND", "Coleta não encontrada.");
    if (current.cancelled || current.status !== rule.from)
      fail(
        409,
        "INVALID_STATE",
        "A coleta mudou de etapa. Atualize a lista antes de tentar novamente.",
      );
    if (action === "accept") {
      const driver = (
        await db.query("SELECT online FROM users WHERE id = $1 FOR UPDATE", [
          actor.id,
        ])
      ).rows[0];
      if (!driver.online)
        fail(
          409,
          "DRIVER_OFFLINE",
          "Ative sua disponibilidade para aceitar coletas.",
        );
    }
    await db.query(
      "UPDATE requests SET status = $2, cancelled = $3, driver_id = $4, updated_at = now() WHERE id = $1",
      [
        id,
        rule.to,
        action === "cancel",
        action === "accept" ? actor.id : current.driver_id,
      ],
    );
    await recordEvent(db, id, actor.id, rule.event, current.status, rule.to);
    const row = await getRequest(db, id);
    await notifyParticipants(
      db,
      row,
      rule.title,
      action === "receive"
        ? "O ponto confirmou o recebimento dos materiais."
        : "Uma etapa da sua coleta foi atualizada.",
    );
    return requestModel(row, actor);
  });
}
