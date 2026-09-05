/** REAL integration: PostgreSQL 18 + Cedar WASM + Better Auth + Hono HTTP + AWS S3.
 * Missing resources are errors, never skipped tests. Only synthetic input data is used.
 * Run tooling/real-tests.mjs against dedicated disposable resources, never production.
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID, randomBytes } from 'node:crypto';
import { Client } from 'pg';
import { serve } from '@hono/node-server';
import { preflight } from '../../tooling/preflight.mjs';
import { PgDatabase } from '../../dist/packages/adapters/src/pg.js';
import { CedarAuthorizer, FOUNDATION_POLICY } from '../../dist/packages/adapters/src/cedar.js';
import { S3EvidenceStore } from '../../dist/packages/adapters/src/s3.js';
import { WebCryptography } from '../../dist/packages/adapters/src/cryptography.js';
import { readConfig } from '../../dist/packages/adapters/src/config.js';
import { createDoor } from '../../dist/packages/door/src/door.js';
import { createEdge } from '../../dist/apps/edge/src/app.js';
import { Authority } from '../../dist/packages/ontology/src/authority/transaction.js';
import { OutboxQueue } from '../../dist/packages/ontology/src/authority/outbox.js';
import { SemanticExecutor } from '../../dist/packages/ontology/src/surfaces/dispatch.js';
import { FOUNDATION } from '../../dist/packages/ontology/src/surfaces/registry.js';
import { SemanticClient } from '../../dist/packages/clients/src/semantic-client.js';
const prerequisites=preflight({real:true});
if(prerequisites.blockers.length) throw new Error('Real integration prerequisites missing. Run tooling/preflight.mjs --real.');
const config=readConfig(process.env), crypto=new WebCryptography();
let database, doorDatabase, workerDatabase, store, admin, server;
const envelope=(worldRef, operation, input, operationId=randomUUID(), expectedBasis=null)=>({schemaVersion:1,operation,operationId,worldRef,purpose:'operations',expectedBasis,input});
async function signup() {
  const response=await fetch(`${config.publicOrigin}/api/auth/sign-up/email`,{method:'POST',headers:{'Content-Type':'application/json',Origin:config.publicOrigin},body:JSON.stringify({name:'Synthetic qualification user',email:`zoen-${randomUUID()}@example.invalid`,password:randomBytes(32).toString('base64url')})});
  assert.ok(response.ok,'Actual Better Auth signup must succeed');
  const body=await response.json(); const cookie=response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
  assert.ok(cookie.length>0,'Actual session cookie required');
  return {principal:body.user.id,cookie,client:new SemanticClient(config.publicOrigin,cookie)};
}
async function okCall(person, request) {const result=await person.client.invoke(request);assert.equal(result.tag,'Ok',`Operation ${request.operation} must succeed; got ${result.tag}`);return result.value;}
async function fixture({privateSecond=false}={}) {
  const person=await signup();
  const genesis=await okCall(person,envelope(null,'CreatePersonalWorld',{name:'Synthetic qualification World'}));const world=genesis.worldRef;
  const subject=(await okCall(person,envelope(world,'CreateSubject',{typeId:'record',label:'Synthetic invoice'}))).data.subjectId;
  const sources=[];
  for(const [name,visibility] of [['Ledger','shared'],['Statement',privateSecond?'owner-only':'shared']]) sources.push((await okCall(person,envelope(world,'RegisterSource',{name,visibility}))).data.sourceId);
  const evidence=[];
  for(let i=0;i<2;i++) evidence.push((await okCall(person,envelope(world,'StageEvidence',{sourceId:sources[i],mediaType:'application/json',content:JSON.stringify({synthetic:true,reportedAmount:i===0?'100.00':'120.00'})}))).data.evidenceId);
  const input=(i,value)=>({subjectId:subject,sourceId:sources[i],predicateId:'record.amount',value,unit:'brl',scope:{metric:'reported'},validTime:{kind:'date',from:'2026-09-01',until:'2026-10-01'},evidenceRefs:[evidence[i]]});
  const claims=[]; for(let i=0;i<2;i++) claims.push((await okCall(person,envelope(world,'AdmitClaim',input(i,i===0?'100.00':'120.00')))).data.claimId);
  return {person,world,subject,sources,evidence,claims,input};
}
before(async()=>{
  database=new PgDatabase({connectionString:config.authorityUrl});doorDatabase=new PgDatabase({connectionString:config.doorUrl,options:'-c search_path=door'});workerDatabase=new PgDatabase({connectionString:process.env.ZOEN_OUTBOX_DATABASE_URL});
  await database.verifyRuntimeRole('zoen_authority');await doorDatabase.verifyRuntimeRole('zoen_door');await workerDatabase.verifyRuntimeRole('zoen_outbox');
  store=new S3EvidenceStore(config.bucket,config.region,config.bucketOwner,crypto);await store.verifyBucket();
  admin=new Client({connectionString:process.env.ZOEN_MIGRATOR_DATABASE_URL});await admin.connect();
  const isSuper=(await admin.query('SELECT rolsuper FROM pg_roles WHERE rolname=current_user')).rows[0].rolsuper;
  assert.ok(isSuper,'These fault/role tests require a dedicated disposable PostgreSQL superuser, not production credentials');
  const release=await crypto.digest({foundation:FOUNDATION,policyDigest:await crypto.sha256(new TextEncoder().encode(FOUNDATION_POLICY))});
  const executor=new SemanticExecutor(new Authority(database,crypto,{now:()=>new Date().toISOString()},new CedarAuthorizer(),release),store,release);
  const app=createEdge(createDoor(doorDatabase.pool,config.publicOrigin,config.authSecret),executor,config.publicOrigin);
  server=serve({fetch:app.fetch,hostname:'127.0.0.1',port:config.port});if(!server.listening)await once(server,'listening');
});
after(async()=>{
  if(server)await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  await Promise.all([database?.close(),doorDatabase?.close(),workerDatabase?.close(),admin?.end()]);store?.close();
});
test('real/auth: a forged principal header and origin cannot replace a session',async()=>{
  const request=envelope(null,'CreatePersonalWorld',{name:'Forbidden'});
  const response=await fetch(`${config.publicOrigin}/api/semantic`,{method:'POST',headers:{'Content-Type':'application/json',Origin:config.publicOrigin,'X-Zoen-Principal':randomUUID()},body:JSON.stringify(request)});
  assert.equal(response.status,403);assert.equal((await response.json()).code,'AUTHENTICATION_REQUIRED');
  const csrf=await fetch(`${config.publicOrigin}/api/semantic`,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://wrong.example.invalid'},body:JSON.stringify(request)});assert.equal(csrf.status,403);
});
test('real/genesis: concurrent same-intent retries produce one World, receipt and outbox',async()=>{
  const person=await signup(),request=envelope(null,'CreatePersonalWorld',{name:'Concurrent World'});
  const results=await Promise.all([okCall(person,request),okCall(person,request)]);assert.deepEqual(results[0],results[1]);
  const count=(await admin.query('SELECT count(*)::int AS n FROM ontology.bootstrap_operations WHERE principal_id=$1 AND operation_id=$2',[person.principal,request.operationId])).rows[0].n;assert.equal(count,1);
  const changed=await person.client.invoke({...request,input:{name:'Different intent'}});assert.equal(changed.tag,'Conflict');
});
test('real/divergence: actual sources remain separate and no invented majority wins',async()=>{
  const f=await fixture();const frame=await okCall(f.person,envelope(f.world,'Inspect',{subjectId:f.subject}));
  assert.equal(frame.groups.length,1);assert.equal(frame.groups[0].interpretation.status,'unresolved');assert.equal(frame.groups[0].interpretation.contested,true);assert.equal(frame.groups[0].claims.length,2);
  assert.deepEqual(frame.groups[0].claims.map(c=>c.value).sort(),['100','120']);
  const original=await okCall(f.person,envelope(f.world,'OpenEvidence',{evidenceId:f.evidence[0]}));assert.equal(JSON.parse(original.content).reportedAmount,'100.00');
  const reopened=await okCall(f.person,envelope(f.world,'OpenFrame',{frameId:frame.frameId}));assert.deepEqual(reopened,frame);
});
test('real/correction: old evidence survives and an old Frame stays reproducible',async()=>{
  const f=await fixture();const old=await okCall(f.person,envelope(f.world,'Inspect',{subjectId:f.subject}));
  const correction=envelope(f.world,'CorrectClaim',{...f.input(1,'100.00'),targetClaimId:f.claims[1]},randomUUID(),old.basis);
  const result=await okCall(f.person,correction);const replay=await okCall(f.person,correction);assert.deepEqual(replay,result);
  const current=await okCall(f.person,envelope(f.world,'Inspect',{subjectId:f.subject}));assert.equal(current.groups[0].interpretation.status,'selected');assert.equal(current.groups[0].interpretation.contested,false);
  assert.deepEqual(await okCall(f.person,envelope(f.world,'OpenFrame',{frameId:old.frameId})),old);
  assert.equal((await admin.query('SELECT count(*)::int AS n FROM ontology.claims WHERE world_id=$1 AND subject_id=$2',[f.world.worldId,f.subject])).rows[0].n,3);
});
test('real/staleness: a new comparable claim prevents committing an old correction',async()=>{
  const f=await fixture();const old=await okCall(f.person,envelope(f.world,'Inspect',{subjectId:f.subject}));
  await okCall(f.person,envelope(f.world,'AdmitClaim',f.input(0,'110.00')));
  const request=envelope(f.world,'CorrectClaim',{...f.input(1,'100.00'),targetClaimId:f.claims[1]},randomUUID(),old.basis);
  const result=await f.person.client.invoke(request);assert.equal(result.tag,'Stale');
  assert.equal((await admin.query('SELECT count(*)::int AS n FROM ontology.operations WHERE world_id=$1 AND operation_id=$2',[f.world.worldId,request.operationId])).rows[0].n,0);
});
test('real/disclosure: hidden source is excluded before reconciliation and membership revocation takes effect',async()=>{
  const f=await fixture({privateSecond:true});const viewer=await signup();
  // Test setup uses a real administrator transaction; it is not a membership API or production bypass.
  await admin.query("INSERT INTO ontology.memberships(world_id,realm,principal_id,role,state) VALUES($1,$2,$3,'viewer','active')",[f.world.worldId,f.world.realm,viewer.principal]);
  const frame=await okCall(viewer,envelope(f.world,'Inspect',{subjectId:f.subject}));assert.equal(frame.groups[0].claims.length,1);assert.equal(frame.groups[0].interpretation.contested,false);
  const write=await viewer.client.invoke(envelope(f.world,'RegisterSource',{name:'Not allowed',visibility:'shared'}));assert.equal(write.tag,'NotFoundOrDenied');
  await admin.query("UPDATE ontology.memberships SET state='revoked' WHERE world_id=$1 AND principal_id=$2",[f.world.worldId,viewer.principal]);
  const revoked=await viewer.client.invoke(envelope(f.world,'OpenFrame',{frameId:frame.frameId}));assert.equal(revoked.tag,'NotFoundOrDenied');
});
test('real/role and RLS: unscoped authority sees no Worlds and cannot read Door or mutate evidence',async()=>{
  const connection=await database.connect();try {
    assert.equal((await connection.query('SELECT world_id FROM ontology.worlds')).length,0);
    for(const sql of ['SELECT * FROM door.session','UPDATE ontology.claims SET asserted_by=asserted_by','DELETE FROM ontology.receipts','CREATE TABLE ontology.illegal(id int)'])await assert.rejects(connection.query(sql),e=>e.code==='42501');
  } finally {connection.release();}
});
test('real/rollback and connection death: uncommitted rows never become visible',async()=>{
  const c=await database.pool.connect();const world=randomUUID();let killed=false;
  try {
    await c.query('BEGIN');await c.query("SELECT set_config('zoen.world_id',$1,true),set_config('zoen.realm','live',true)",[world]);
    await c.query("INSERT INTO ontology.worlds(world_id,realm,owner_id,name,release_digest,generation_id) VALUES($1,'live',$2,'Rollback probe',$3,$4)",[world,randomUUID(),'a'.repeat(64),randomUUID()]);
    const pid=(await c.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    c.on('error',()=>{});await admin.query('SELECT pg_terminate_backend($1)',[pid]);killed=true;
    await assert.rejects(c.query('COMMIT'));
    assert.equal((await admin.query('SELECT count(*)::int AS n FROM ontology.worlds WHERE world_id=$1',[world])).rows[0].n,0);
  } finally {if(!killed)try{await c.query('ROLLBACK');}catch{} c.release(true);}
});
test('real/outbox: concurrent workers get disjoint leases and stale fences cannot acknowledge',async()=>{
  const person=await signup();for(let i=0;i<4;i++)await okCall(person,envelope(null,'CreatePersonalWorld',{name:`Outbox ${i}`}));
  const queue=new OutboxQueue(workerDatabase);
  const [a,b]=await Promise.all([queue.claim(randomUUID(),'authority',2,30),queue.claim(randomUUID(),'authority',2,30)]);
  assert.equal(a.length,2);assert.equal(b.length,2);assert.equal(new Set([...a,...b].map(x=>x.outboxId)).size,4);
  await assert.rejects(queue.acknowledge({...a[0],fence:'0'}),e=>e.tag==='LostLease');await queue.acknowledge(a[0]);
  await assert.rejects(queue.acknowledge(a[0]),e=>e.tag==='LostLease');
});
test('real/S3: exact version round trip and duplicate immutable put',async()=>{
  const world={worldId:randomUUID(),realm:'evaluation'},ref=randomUUID(),bytes=new TextEncoder().encode('Synthetic retained evidence');
  const first=await store.putImmutable(world,ref,bytes,'text/plain');const repeat=await store.putImmutable(world,ref,bytes,'text/plain');
  assert.equal(first.versionId,repeat.versionId);assert.deepEqual(await store.readImmutable(first),bytes);
});
