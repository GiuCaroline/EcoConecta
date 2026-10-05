import { z } from 'zod';
import { fail } from './errors.js';
import { parse, idSchema } from './validation.js';
import { requireRole } from './auth.js';
import { getRequest } from './requests.js';
import { requestModel } from './models.js';

const volume = z.number().finite().positive().max(100000);
const demoInput = z.object({ volumeA: volume, volumeB: volume }).strict();
const requestInput = z.object({ requestIds: z.array(idSchema).length(2).refine(ids => ids[0] !== ids[1], 'Escolha duas coletas diferentes.') }).strict();
const quantumResult = z.object({
  states: z.tuple([z.literal('00'), z.literal('01'), z.literal('10'), z.literal('11')]),
  probabilities: z.array(z.number().finite().min(0).max(1.000000001)).length(4).refine(p => Math.abs(p.reduce((a,b)=>a+b,0)-1) < 0.000001),
  bestIndex: z.number().int().min(0).max(3),
  bestState: z.enum(['00','01','10','11']),
  decision: z.string().max(200),
  visitOrder: z.array(z.enum(['A','B'])).max(2),
  angles: z.object({ A: z.number().finite().min(0).max(Math.PI), B: z.number().finite().min(0).max(Math.PI) }),
  engine: z.literal('PennyLane/default.qubit'),
  qubits: z.literal(2), simulated: z.literal(true), educational: z.literal(true),
  inputs: z.object({ volumeA: volume, volumeB: volume, referenceKg: volume }),
  normalization: z.literal('angle = min(quantityKg / referenceKg, 1) * pi'),
});

export async function evaluateQuantum(config, volumeA, volumeB) {
  if (!config.quantumApiUrl || !config.quantumApiKey) fail(503,'QUANTUM_UNAVAILABLE','O serviço PennyLane não está configurado. Confira QUANTUM.md.');
  let data;
  try {
    const response = await fetch(`${config.quantumApiUrl.replace(/\/$/,'')}/evaluate`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(config.quantumTimeoutMs || 10000),
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': config.quantumApiKey },
      body: JSON.stringify({ volumeA, volumeB, referenceKg: config.quantumReferenceKg || 20 }),
    });
    if (!response.ok) throw new Error('Quantum service rejected request');
    data = await response.json();
  } catch {
    fail(503,'QUANTUM_UNAVAILABLE','Não foi possível executar o circuito. Confira se o serviço Python está ativo.');
  }
  const validated = quantumResult.safeParse(data);
  if (!validated.success) fail(502,'QUANTUM_INVALID_RESPONSE','O serviço quântico retornou uma resposta inválida.');
  const result = validated.data;
  if (result.bestState !== result.states[result.bestIndex] || result.probabilities[result.bestIndex] < Math.max(...result.probabilities) - 1e-12 || result.inputs.volumeA !== volumeA || result.inputs.volumeB !== volumeB || result.inputs.referenceKg !== (config.quantumReferenceKg || 20)) fail(502,'QUANTUM_INVALID_RESPONSE','O resultado do circuito é inconsistente.');
  return { ...result, limitation: 'Simulação acadêmica de seleção entre dois candidatos. Não calcula menor percurso, distância ou vantagem quântica. A ordem do estado 11 é uma regra clássica por urgência.' };
}

export function registerQuantumRoutes(app, pool, config, auth, limiter) {
  // Dados locais para apresentar o circuito original sem conta/banco de produção.
  app.post('/api/quantum/demo',limiter,async(req,res) => {
    const input = parse(demoInput,req.body);
    const result = await evaluateQuantum(config,input.volumeA,input.volumeB);
    res.json({ ...result, source: 'demo', generatedAt: new Date().toISOString() });
  });
  app.post('/api/quantum/recommendation',limiter,auth,async(req,res) => {
    requireRole(req,'driver');
    const {requestIds} = parse(requestInput,req.body);
    const rows = [];
    for (const id of requestIds) {
      const row = await getRequest(pool,id);
      const available = row.status === 0 && !row.cancelled;
      const mineBeforePickup = row.driver_id === req.user.id && row.status === 1 && !row.cancelled;
      if (!available && !mineBeforePickup) fail(404,'NOT_FOUND','Uma coleta não está mais disponível para comparação. Atualize a lista.');
      rows.push(row);
    }
    // Nunca aceitar pesos arbitrários do cliente no fluxo conectado.
    const result = await evaluateQuantum(config,Number(rows[0].quantity),Number(rows[1].quantity));
    const candidates = rows.map((row,i) => {
      const safe = requestModel(row,req.user);
      return { label: i === 0 ? 'A' : 'B', requestId: safe.id, name: safe.residentName, quantity: safe.quantity, status: safe.status };
    });
    res.json({ ...result, source: 'database', candidates, suggestedRequestIds: result.visitOrder.map(label => candidates.find(c => c.label === label).requestId), generatedAt: new Date().toISOString() });
  });
}
