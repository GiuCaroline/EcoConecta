import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CIRCUIT_PATH = path.resolve(__dirname, "../quantum/circuit.py");

const STATES = ["00", "01", "10", "11"];
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function computeAnalytical(volumeA, volumeB, referenceKg) {
  const angleA = (volumeA / referenceKg) * Math.PI;
  const angleB = (volumeB / referenceKg) * Math.PI;

  const cosA = Math.cos(angleA / 2);
  const sinA = Math.sin(angleA / 2);
  const cosB = Math.cos(angleB / 2);
  const sinB = Math.sin(angleB / 2);

  return {
    states: STATES,
    probabilities: [
      (cosA * cosB) ** 2,
      (cosA * sinB) ** 2,
      (sinA * sinB) ** 2,
      (sinA * cosB) ** 2,
    ],
    angles: { A: angleA, B: angleB },
  };
}

async function runPythonCircuit(volumeA, volumeB, referenceKg) {
  const payload = JSON.stringify({ volumeA, volumeB, referenceKg });
  const bins = process.env.PYTHON_BIN
    ? [process.env.PYTHON_BIN]
    : process.platform === "win32"
      ? ["python", "python3"]
      : ["python3", "python"];

  for (const bin of bins) {
    try {
      const { stdout } = await execFileAsync(bin, [CIRCUIT_PATH, payload], {
        timeout: 20000,
      });
      const parsed = JSON.parse(stdout.trim());
      if (
        Array.isArray(parsed?.probabilities) &&
        parsed.probabilities.length === 4 &&
        parsed?.angles
      ) {
        return parsed;
      }
    } catch {
      // Try next Python binary or fall back to analytical JS calculation.
    }
  }

  return computeAnalytical(volumeA, volumeB, referenceKg);
}

function buildDecision(bestState, nameA, nameB, visitOrder) {
  if (bestState === "00") {
    return "Nenhum dos dois vizinhos foi selecionado pelo circuito.";
  }
  if (bestState === "01") {
    return `Priorizar visita ao vizinho ${nameB} (B).`;
  }
  if (bestState === "10") {
    return `Priorizar visita ao vizinho ${nameA} (A).`;
  }
  const first = visitOrder[0] === "A" ? `${nameA} (A)` : `${nameB} (B)`;
  return `Visitar ambos os vizinhos, começando por ${first} pelo maior volume estimado.`;
}

export async function evaluateQuantum(
  candidateA,
  candidateB,
  referenceKg = 20,
) {
  const refKg =
    Number.isFinite(Number(referenceKg)) && Number(referenceKg) > 0
      ? Number(referenceKg)
      : 20;

  const qtyA =
    typeof candidateA === "number"
      ? candidateA
      : Number(candidateA?.quantity ?? 0);
  const qtyB =
    typeof candidateB === "number"
      ? candidateB
      : Number(candidateB?.quantity ?? 0);

  const nameA =
    (typeof candidateA === "object" && candidateA?.name) || "Vizinho A";
  const nameB =
    (typeof candidateB === "object" && candidateB?.name) || "Vizinho B";

  const { probabilities, angles } = await runPythonCircuit(qtyA, qtyB, refKg);

  let bestIndex = 0;
  for (let i = 1; i < probabilities.length; i += 1) {
    if (probabilities[i] > probabilities[bestIndex]) {
      bestIndex = i;
    }
  }

  const bestState = STATES[bestIndex];
  let visitOrder = [];
  if (bestState === "01") {
    visitOrder = ["B"];
  } else if (bestState === "10") {
    visitOrder = ["A"];
  } else if (bestState === "11") {
    visitOrder = qtyA >= qtyB ? ["A", "B"] : ["B", "A"];
  }

  const decision = buildDecision(bestState, nameA, nameB, visitOrder);

  return {
    candidates: [
      { label: "A", name: nameA, quantity: qtyA },
      { label: "B", name: nameB, quantity: qtyB },
    ],
    states: STATES,
    probabilities,
    bestState,
    decision,
    visitOrder,
    inputs: { referenceKg: refKg },
    angles: { A: angles.A, B: angles.B },
  };
}

export function registerQuantumRoutes(app, pool, requireAuth) {
  app.post("/api/quantum/demo", async (req, res) => {
    try {
      const volumeA = Number(req.body?.volumeA);
      const volumeB = Number(req.body?.volumeB);
      const referenceKg =
        req.body?.referenceKg !== undefined ? Number(req.body.referenceKg) : 20;

      if (
        !Number.isFinite(volumeA) ||
        volumeA < 0 ||
        !Number.isFinite(volumeB) ||
        volumeB < 0 ||
        !Number.isFinite(referenceKg) ||
        referenceKg <= 0
      ) {
        return res
          .status(400)
          .json({ error: { message: "Informe volumeA e volumeB numéricos válidos." } });
      }

      const result = await evaluateQuantum(
        { label: "A", name: "Vizinho A", quantity: volumeA },
        { label: "B", name: "Vizinho B", quantity: volumeB },
        referenceKg,
      );
      return res.json(result);
    } catch (err) {
      return res
        .status(500)
        .json({ error: { message: err.message || "Erro ao executar circuito quântico." } });
    }
  });

  app.post("/api/quantum/recommendation", requireAuth, async (req, res) => {
    try {
      const requestIds = req.body?.requestIds;
      const referenceKg =
        req.body?.referenceKg !== undefined ? Number(req.body.referenceKg) : 20;

      if (
        !Array.isArray(requestIds) ||
        requestIds.length !== 2 ||
        requestIds[0] === requestIds[1] ||
        !requestIds.every((id) => typeof id === "string" && UUID_REGEX.test(id))
      ) {
        return res.status(400).json({ error: { message: "Selecione exatamente duas coletas distintas e válidas." } });
      }

      if (!Number.isFinite(referenceKg) || referenceKg <= 0) {
        return res
          .status(400)
          .json({ error: { message: "Referência em kg deve ser maior que zero." } });
      }

      const { rows } = await pool.query(
        `SELECT r.id, r.quantity, r.status, r.cancelled, r.driver_id, u.name AS resident_name
         FROM requests r
         LEFT JOIN users u ON u.id = r.resident_id
         WHERE r.id = ANY($1::uuid[])`,
        [requestIds],
      );

      if (rows.length !== 2) {
        return res
          .status(404)
          .json({ error: { message: "Uma ou mais coletas não foram encontradas." } });
      }

      const byId = new Map(rows.map((row) => [row.id, row]));
      const rowA = byId.get(requestIds[0]);
      const rowB = byId.get(requestIds[1]);
      const userId = req.user?.id;

      const isEligible = (row) =>
        !row.cancelled &&
        (row.status === 0 || (row.status === 1 && row.driver_id === userId));

      if (!isEligible(rowA) || !isEligible(rowB)) {
        return res.status(409).json({ error: { message: "As coletas selecionadas não estão mais disponíveis para simulação." } });
      }

      const result = await evaluateQuantum(
        {
          label: "A",
          name: rowA.resident_name || "Vizinho A",
          quantity: Number(rowA.quantity),
        },
        {
          label: "B",
          name: rowB.resident_name || "Vizinho B",
          quantity: Number(rowB.quantity),
        },
        referenceKg,
      );

      return res.json(result);
    } catch (err) {
      return res
        .status(500)
        .json({ error: { message: err.message || "Erro ao calcular sugestão quântica." } });
    }
  });
}
