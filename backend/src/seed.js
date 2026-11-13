// backend/src/seed.js
// Popula o banco com dados de demonstração do ABC Paulista (apenas se estiver vazio).
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

export const DEMO_PASSWORD = "EcoConecta123";

function todayPlus(days, timeZone = "America/Sao_Paulo") {
  const d = new Date(Date.now() + days * 86400000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export async function seedDatabase(pool, { bcryptRounds = 10 } = {}) {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM users");
  if (Number(rows[0].count) > 0) {
    console.log("[seed] Banco já possui dados — seed ignorado.");
    return false;
  }

  const hash = await bcrypt.hash(DEMO_PASSWORD, bcryptRounds);
  const resident = randomUUID();
  const neighbor = randomUUID();
  const driver = randomUUID();
  const owner = randomUUID();

  const users = [
    [resident, "Giulia", "giulia@ecoconecta.com", "resident", "(11) 99999-0001", "Rua das Flores, 80 — Centro, Mauá", "", ""],
    [neighbor, "Marina", "marina@ecoconecta.com", "resident", "(11) 99999-0004", "Rua Primavera, 25 — Centro, Santo André", "", ""],
    [driver, "Carlos Motorista", "motorista@ecoconecta.com", "driver", "(11) 99999-0002", "", "Fiorino Branca", "ECO1A23"],
    [owner, "Responsável EcoPonto", "ponto@ecoconecta.com", "point", "(11) 99999-0003", "", "", ""],
  ];
  for (const [id, name, email, role, phone, address, vehicle, plate] of users) {
    await pool.query(
      `INSERT INTO users (id,name,email,password_hash,role,phone,address,vehicle,plate,online)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)`,
      [id, name, email, hash, role, phone, address, vehicle, plate],
    );
  }

  const points = [
    {
      id: randomUUID(),
      name: "Cooperativa Raiz Verde",
      address: "Rua das Palmeiras, 120 — Centro, Mauá",
      description: "Cooperativa comunitária de materiais recicláveis.",
      materials: ["paper", "plastic", "glass", "metal"],
      hours: "Seg a sex, 08h às 17h",
      phone: "(11) 90000-0001",
      icon: "leaf-outline",
    },
    {
      id: randomUUID(),
      name: "Estação Circular",
      address: "Av. Portugal, 350 — Centro, Santo André",
      description: "Recebemos eletrônicos e metais para encaminhamento à reciclagem.",
      materials: ["electronic", "metal"],
      hours: "Seg a sáb, 09h às 18h",
      phone: "(11) 90000-0002",
      icon: "laptop-outline",
    },
    {
      id: randomUUID(),
      name: "Projeto Gota Limpa",
      address: "Rua do Parque, 45 — Vila Assis, Mauá",
      description: "Coleta comunitária de óleo usado e embalagens plásticas.",
      materials: ["oil", "plastic"],
      hours: "Ter a sáb, 09h às 16h",
      phone: "(11) 90000-0003",
      icon: "water-outline",
    },
  ];
  for (const p of points) {
    await pool.query(
      `INSERT INTO points (id,owner_id,name,address,phone,hours,description,materials,active,icon)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9)`,
      [p.id, owner, p.name, p.address, p.phone, p.hours, p.description, JSON.stringify(p.materials), p.icon],
    );
  }

  // Duas coletas pendentes (5 kg e 20 kg) de vizinhos diferentes: permitem testar
  // a lista do motorista e reproduzem o exemplo do grupo na tela Quantum (A=π/4, B=π).
  const requests = [
    [resident, points[0].id, ["paper", "plastic"], 5, "Manhã · 08h–12h", users[0][5], "Caixas desmontadas e garrafas em sacolas."],
    [neighbor, points[1].id, ["electronic"], 20, "Tarde · 13h–18h", users[1][5], "Um computador antigo, sem bateria."],
  ];
  for (const [residentId, pointId, materials, quantity, period, address, notes] of requests) {
    await pool.query(
      `INSERT INTO requests (id,resident_id,point_id,materials,quantity,date,period,address,notes,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0)`,
      [randomUUID(), residentId, pointId, JSON.stringify(materials), quantity, todayPlus(1), period, address, notes],
    );
  }

  console.log("[seed] Dados de demonstração criados (senha das contas: " + DEMO_PASSWORD + ").");
  return true;
}
