import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEnvelope } from '../../.core-build/packages/contracts/src/semantic.js';
import { assertFresh, operationScope, isRetryableSql } from '../../.core-build/packages/ontology/src/authority/guards.js';
import { effectTransition, CASE_TRANSITIONS, caseTransition, RELEASE_TRANSITIONS, releaseTransition, assertLease } from '../../.core-build/packages/ontology/src/authority/states.js';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const enc = new TextEncoder();
const head = { releaseDigest: 'a'.repeat(64), generationId: id(1), cellEpoch: '1', securityRevision: '2' };
const basis = { head, cut: { 'claims.invoice': '3', sources: '4' }, readSetDigest: 'b'.repeat(64) };
const envelope = { schemaVersion: 1, operation: 'Inspect', operationId: id(2), worldRef: { worldId: id(3), realm: 'live' }, purpose: 'operations', expectedBasis: null, input: {} };
test('protocol/identity, roles and grants are never accepted in client JSON', () => {
  assert.equal(parseEnvelope(enc.encode(JSON.stringify(envelope))).operation, 'Inspect');
  for (const field of ['principalId', 'role', 'grant', 'assurance', 'actorId', 'appSessionId']) assert.throws(() => parseEnvelope(enc.encode(JSON.stringify({ ...envelope, [field]: 'owner' }))), e => e.code === 'OBJECT_KEYS');
});
test('protocol/unsupported versions and duplicate operation names fail', () => {
  assert.throws(() => parseEnvelope(enc.encode(JSON.stringify({ ...envelope, schemaVersion: 2 }))), e => e.code === 'SCHEMA_VERSION');
  const duplicate = JSON.stringify(envelope).replace('"operation":"Inspect"', '"operation":"Inspect","operation":"Commit"');
  assert.throws(() => parseEnvelope(enc.encode(duplicate)), e => e.code === 'JSON_DUPLICATE_KEY');
});
test('guards/absence predicates become stale when a matching set changes', () => {
  assertFresh(basis, head, basis.cut, ['claims.invoice', 'sources']);
  assert.throws(() => assertFresh(basis, head, { ...basis.cut, 'claims.invoice': '4' }, ['claims.invoice', 'sources']), e => e.tag === 'Stale');
});
test('guards/an unmentioned dependency cannot be silently treated as current', () => {
  assert.throws(() => assertFresh(basis, head, basis.cut, ['claims.invoice', 'missing']), e => e.code === 'INCOMPLETE_READ_GUARDS');
});
test('guards/unrelated domains do not invalidate a decision; security/epoch do', () => {
  assertFresh(basis, head, { ...basis.cut, unrelated: '999' }, ['claims.invoice']);
  assert.throws(() => assertFresh(basis, { ...head, cellEpoch: '2' }, basis.cut, ['claims.invoice']), e => e.code === 'HEAD_CHANGED');
  assert.throws(() => assertFresh(basis, { ...head, securityRevision: '3' }, basis.cut, ['claims.invoice']), e => e.code === 'HEAD_CHANGED');
});
test('idempotency/key has no transport or app namespace and distinguishes real identities', () => {
  const a = operationScope(id(1), 'live', id(2), 'CommitCase', id(3));
  assert.equal(a, operationScope(id(1), 'live', id(2), 'CommitCase', id(3)));
  assert.notEqual(a, operationScope(id(1), 'evaluation', id(2), 'CommitCase', id(3)));
  assert.notEqual(a, operationScope(id(1), 'live', id(2), 'CommitCase', id(4)));
});
test('retries/only serialization and deadlock errors are retryable', () => {
  assert.equal(isRetryableSql({ code: '40001' }), true); assert.equal(isRetryableSql({ code: '40P01' }), true);
  for (const e of [{ code: '23505' }, new Error('timeout'), null, { code: '08006' }]) assert.equal(isRetryableSql(e), false);
});
test('effects/lost provider response remains unknown and cannot be blindly retried or cancelled', () => {
  assert.equal(effectTransition(effectTransition('intent', 'start'), 'lost-response'), 'unknown');
  assert.throws(() => effectTransition('unknown', 'start')); assert.throws(() => effectTransition('unknown', 'cancel-before-start'));
  assert.equal(effectTransition('unknown', 'provider-accepted'), 'accepted');
});
test('case/release machines exercise all legal and illegal state pairs', () => {
  for (const [machine, transition] of [[CASE_TRANSITIONS, caseTransition], [RELEASE_TRANSITIONS, releaseTransition]]) for (const from of Object.keys(machine)) for (const to of Object.keys(machine)) {
    if (machine[from].includes(to)) assert.equal(transition(from, to), to); else assert.throws(() => transition(from, to));
  }
});
test('fencing/old owner, old fence or expired lease cannot finish a job', () => {
  const lease = { owner: 'a', fence: '2', until: '2026-09-04T12:00:00Z' }; assertLease(lease, lease, '2026-09-04T11:00:00Z');
  for (const token of [{ ...lease, fence: '1' }, { ...lease, owner: 'b' }, { ...lease, until: '2026-09-05T00:00:00Z' }]) assert.throws(() => assertLease(lease, token, '2026-09-04T11:00:00Z'), e => e.tag === 'LostLease');
  assert.throws(() => assertLease(lease, lease, lease.until), e => e.tag === 'LostLease');
});
test('release/unloaded active semantics cannot silently use the current application code', async () => {
  const { assertLoadedRelease } = await import('../../.core-build/packages/ontology/src/authority/guards.js');
  assert.doesNotThrow(() => assertLoadedRelease('a'.repeat(64), 'a'.repeat(64)));
  assert.throws(() => assertLoadedRelease('a'.repeat(64), 'b'.repeat(64)), e => e.tag === 'ContractChanged');
});
