import test from 'node:test';
import assert from 'node:assert/strict';
import { parseClaim, comparableGroups } from '../../.core-build/packages/ontology/src/interpretation/claims.js';
import { independentFamilies, interpretVisible } from '../../.core-build/packages/ontology/src/interpretation/reconcile.js';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const world = { worldId: id(1), realm: 'live' };
function claim(n, changes = {}) {
  return parseClaim({ id: id(n), world, subjectId: id(2), predicateId: 'invoice.amount', definitionDigest: 'a'.repeat(64), valueType: 'decimal', value: '100.00', unit: 'brl', scope: { basis: 'invoiced' }, validTime: { kind: 'date', from: '2026-01-01', until: '2026-02-01' }, knowledgeVersion: '1', sourceId: id(n + 100), familyId: id(n + 200), evidenceRefs: [id(n + 300)], derivedFrom: [], verification: 'unverified', ...changes });
}
const manual = { kind: 'manual-required' };
test('interpretation/no evidence means unknown, not zero or verified', () => {
  assert.deepEqual(interpretVisible([], manual), { status: 'unknown', verification: 'unverified', contested: false, selectedRefs: [], rivalRefs: [], values: [], familyCount: 0, dependencyRefs: [] });
});
test('interpretation/agreement is selected without upgrading verification', () => {
  const result = interpretVisible([claim(10), claim(11, { value: '100.0' })], manual);
  assert.equal(result.status, 'selected'); assert.equal(result.contested, false); assert.equal(result.verification, 'unverified'); assert.deepEqual(result.values, ['100']);
});
test('interpretation/divergence is preserved and an explicit precedence may select while contested', () => {
  const a = claim(10); const b = claim(11, { value: '120', verification: 'verified' });
  assert.equal(interpretVisible([a, b], manual).status, 'unresolved');
  const result = interpretVisible([a, b], { kind: 'source-precedence', sourceIds: [b.sourceId, a.sourceId] });
  assert.equal(result.status, 'selected'); assert.equal(result.contested, true); assert.equal(result.verification, 'verified'); assert.deepEqual(result.rivalRefs, [a.id]);
});
test('interpretation/fifty copied claims do not outvote a divergent independent source', () => {
  const first = claim(10); const copies = Array.from({ length: 50 }, (_, i) => claim(20 + i, { familyId: first.familyId, derivedFrom: [first.id] }));
  const rival = claim(90, { value: '120' }); const all = [first, ...copies, rival];
  const result = interpretVisible(all, manual); assert.equal(result.status, 'unresolved'); assert.equal(result.familyCount, 2); assert.equal(result.dependencyRefs.length, 52);
});
test('interpretation/dependent families collapse transitively but do not lose IDs', () => {
  const a = claim(10); const b = claim(11, { derivedFrom: [a.id] }); const c = claim(12, { derivedFrom: [b.id] });
  assert.deepEqual(independentFamilies([c, b, a]), [[a.id, b.id, c.id]]);
  assert.throws(() => independentFamilies([claim(10, { derivedFrom: [id(11)] }), claim(11, { derivedFrom: [id(10)] })]), e => e.code === 'GRAPH_CYCLE');
});
test('interpretation/conflict inside highest-ranked source is not resolved by arrival order', () => {
  const a = claim(10); const b = claim(11, { value: '120', sourceId: a.sourceId });
  assert.equal(interpretVisible([a, b], { kind: 'source-precedence', sourceIds: [a.sourceId] }).status, 'unresolved');
});
test('comparability/predicate, accounting basis, unit, time, definition and subject remain distinct', () => {
  const a = claim(10);
  for (const patch of [{ predicateId: 'cash.received' }, { scope: { basis: 'contracted' } }, { unit: 'usd' }, { validTime: { kind: 'date', from: '2026-02-01', until: '2026-03-01' } }, { definitionDigest: 'b'.repeat(64) }, { subjectId: id(99) }]) {
    const b = claim(11, patch); assert.equal(comparableGroups([a, b], world).length, 2); assert.throws(() => interpretVisible([a, b], manual), e => e.code === 'NONCOMPARABLE_CLAIMS');
  }
});
test('comparability/unknown dates do not become the upload date or imply comparability', () => {
  assert.equal(comparableGroups([claim(10, { validTime: { kind: 'unknown' } }), claim(11, { validTime: { kind: 'unknown' } })], world).length, 2);
});
test('comparability/another tenant or evaluation realm is rejected before interpretation', () => {
  assert.throws(() => comparableGroups([claim(10, { world: { ...world, realm: 'evaluation' } })], world), e => e.code === 'CROSS_WORLD_OR_REALM');
});
test('interpretation/permutation invariance preserves identical meaning', () => {
  const values = [claim(10), claim(11, { value: '120' }), claim(12, { familyId: id(210), derivedFrom: [id(10)] })];
  for (const rule of [manual, { kind: 'source-precedence', sourceIds: [values[0].sourceId] }, { kind: 'set-valued' }]) {
    const expected = interpretVisible(values, rule); assert.deepEqual(interpretVisible(values.slice().reverse(), rule), expected); assert.deepEqual(interpretVisible([values[1], values[2], values[0]], rule), expected);
  }
});
