import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { createServer as httpServer } from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { evaluateQuantum } from '../src/quantum.js';
import { todayIn } from '../src/validation.js';

const root = fileURLToPath(new URL('../',import.meta.url));
const python = root + (process.platform === 'win32' ? '.venv-quantum/Scripts/python.exe' : '.venv-quantum/bin/python');
const key = 'quantum-integration-test-' + 'x'.repeat(40);
async function freePort() { const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port; }
const baseConfig={bcryptRounds:4,sessionDays:7,timeZone:'America/Sao_Paulo',corsOrigins:['http://localhost:8081'],trustProxyHops:0};

test('indisponibilidade explícita sem substituir PennyLane por resultado falso',async()=>{
  const app=createApp({},baseConfig);
  const response=await request(app).post('/api/quantum/demo').send({volumeA:5,volumeB:20}).expect(503);
  assert.equal(response.body.error.code,'QUANTUM_UNAVAILABLE');
});

test('timeout e resposta inconsistente são rejeitados',async()=>{
  const server=httpServer((req,res)=>{if(req.url==='/invalid/evaluate'){res.setHeader('Content-Type','application/json');res.end('{"probabilities":[1,0,0,0]}');}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const host=`http://127.0.0.1:${server.address().port}`;
  try {
    await assert.rejects(()=>evaluateQuantum({quantumApiUrl:host,quantumApiKey:key,quantumTimeoutMs:50,quantumReferenceKg:20},5,20),e=>e.code==='QUANTUM_UNAVAILABLE');
    await assert.rejects(()=>evaluateQuantum({quantumApiUrl:host+'/invalid',quantumApiKey:key,quantumTimeoutMs:1000,quantumReferenceKg:20},5,20),e=>e.code==='QUANTUM_INVALID_RESPONSE');
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

describe('Node → serviço PennyLane real → PostgreSQL', {skip: !existsSync(python)},()=>{
  let service,db,app,driver,owner,resident,otherDriver,point,idA,idB,url;
  const call=(method,path,user)=>{const r=request(app)[method](path);return user?r.set('Authorization',`Bearer ${user.token}`):r;};
  before(async()=>{
    const port=await freePort();url=`http://127.0.0.1:${port}`;
    service=spawn(python,['-m','uvicorn','quantum_service.api:app','--host','127.0.0.1','--port',String(port),'--log-level','error'],{cwd:root,env:{...process.env,QUANTUM_API_KEY:key},stdio:'ignore'});
    let healthy=false;
    for(let i=0;i<100;i++){
      try{const r=await fetch(`${url}/health`,{headers:{'X-Api-Key':key}});if(r.ok){healthy=true;break;}}catch{}
      if(service.exitCode!==null)break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.ok(healthy,'Serviço Python deve iniciar com as dependências instaladas.');
    db=new PGlite();await db.exec(await readFile(new URL('../db/001_initial.sql',import.meta.url),'utf8'));
    let tail=Promise.resolve();const lock=async()=>{let release;const prev=tail;tail=new Promise(resolve=>release=resolve);await prev;return release;};
    const pool={async query(sql,values){const release=await lock();try{return await db.query(sql,values);}finally{release();}},async connect(){const release=await lock();return{query:(sql,values)=>db.query(sql,values),release};}};
    app=createApp(pool,{...baseConfig,quantumApiUrl:url,quantumApiKey:key,quantumReferenceKg:20,quantumTimeoutMs:10000});
    const register=async(name,role)=>{const {body}=await call('post','/api/auth/register').send({name,email:`${role}${name.length}@example.com`,password:'Teste123!X',role}).expect(201);return body;};
    resident=await register('Morador','resident');owner=await register('Responsável','point');driver=await register('Motorista','driver');otherDriver=await register('Outro Motorista','driver');
    const p=await call('post','/api/points',owner).send({name:'Ponto quântico',address:'Rua Exemplo 100, Centro, Mauá',phone:'11999999999',hours:'08h às 17h',description:'Ponto de teste',materials:['paper']}).expect(201);point=p.body.point;
    const create=async quantity=>(await call('post','/api/requests',resident).send({pointId:point.id,materials:['paper'],quantity,date:todayIn('America/Sao_Paulo'),period:'Manhã · 08h–12h',address:'Rua Origem 100, Centro, Mauá'}).expect(201)).body.request.id;
    idA=await create(5);idB=await create(20);
  });
  after(async()=>{if(service){service.kill();await new Promise(resolve=>{if(service.exitCode!==null)resolve();else service.once('exit',resolve);});}if(db)await db.close();});
  test('exemplo público executa RX/CNOT e reproduz 85,36% para B',async()=>{
    const r=await call('post','/api/quantum/demo').send({volumeA:5,volumeB:20}).expect(200);
    assert.equal(r.body.bestState,'01');assert.equal(r.body.engine,'PennyLane/default.qubit');assert.equal(r.body.qubits,2);assert.equal(r.body.source,'demo');assert.ok(Math.abs(r.body.probabilities[1]-.8535533905932737)<1e-12);
    await call('post','/api/quantum/demo').send({volumeA:-1,volumeB:20}).expect(400);
  });
  test('pedido real usa peso do banco, exige motorista e não altera status',async()=>{
    await call('post','/api/quantum/recommendation').send({requestIds:[idA,idB]}).expect(401);
    await call('post','/api/quantum/recommendation',resident).send({requestIds:[idA,idB]}).expect(403);
    const r=await call('post','/api/quantum/recommendation',driver).send({requestIds:[idA,idB]}).expect(200);
    assert.equal(r.body.inputs.volumeA,5);assert.equal(r.body.inputs.volumeB,20);assert.deepEqual(r.body.suggestedRequestIds,[idB]);assert.equal(r.body.source,'database');
    const rows=await db.query('SELECT status FROM requests');assert.ok(rows.rows.every(r=>r.status===0));
    await call('post','/api/quantum/recommendation',driver).send({requestIds:[idA,idA]}).expect(400);
    await call('post','/api/quantum/recommendation',driver).send({requestIds:[idA,idB],volumeA:999}).expect(400);
  });
  test('coleta de outro motorista ou já retirada é rejeitada',async()=>{
    await call('post',`/api/requests/${idB}/accept`,otherDriver).expect(200);
    await call('post','/api/quantum/recommendation',driver).send({requestIds:[idA,idB]}).expect(404);
    await call('post','/api/quantum/recommendation',otherDriver).send({requestIds:[idA,idB]}).expect(200);
    await call('post',`/api/requests/${idB}/pickup`,otherDriver).expect(200);
    await call('post','/api/quantum/recommendation',otherDriver).send({requestIds:[idA,idB]}).expect(404);
  });
});
