import test from 'node:test';
import assert from 'node:assert/strict';
import { parseExpression, evaluate, fieldDependencies } from '../../.core-build/packages/ontology/src/definitions/expression.js';
import { parseMiniApp, miniAppReads } from '../../.core-build/packages/ontology/src/apps/manifest.js';
import { OPERATIONS } from '../../.core-build/packages/ontology/src/surfaces/registry.js';
const decimal = (value, unit = 'brl') => ({ kind: 'decimal', value, unit });
const literal = value => ({ op: 'literal', value });
const field = field => ({ op: 'field', field });
const expr = raw => parseExpression(raw);
const manifest = { schemaVersion: 1, appId: 'orders.week', label: 'Orders', renderer: 'trusted-declarative', expectedRelease: 'a'.repeat(64), components: [{ id: 'orders', kind: 'table', operation: 'Inspect', input: { subjectId: '00000000-0000-4000-8000-000000000001' }, fields: ['label'], label: 'Orders' }] };
test('IR/exact quantities never acquire floating point rounding', () => {
  const e = expr({ op: 'add', left: field('net'), right: literal(decimal('0.20')) });
  assert.deepEqual(evaluate(e, { net: decimal('0.1') }), { value: decimal('0.3'), dependencies: ['net'] });
});
test('IR/unknown data is not a zero and wrong units cannot be added', () => {
  const e = expr({ op: 'add', left: field('net'), right: literal(decimal('0.2')) });
  assert.equal(evaluate(e, {}).value.kind, 'missing');
  assert.throws(() => evaluate(e, { net: decimal('10', 'usd') }), e => e.code === 'UNIT_MISMATCH');
});
test('IR/multiplication requires explicit precision and cannot silently invent unit algebra', () => {
  const e = { op: 'multiply', left: literal(decimal('2.55')), right: literal(decimal('0.5', null)), scale: 2, rounding: 'half-even' };
  assert.deepEqual(evaluate(expr(e), {}).value, decimal('1.28'));
  assert.throws(() => expr({ ...e, rounding: undefined }));
  assert.throws(() => evaluate(expr({ ...e, right: literal(decimal('1', 'kilogram')) }), {}), e => e.code === 'EXPLICIT_UNIT_RULE_REQUIRED');
});
test('IR/no eval, code, SQL, URL or unknown operators enter definitions', () => {
  for (const op of ['eval', 'sql', 'fetch', 'loop', '__proto__', 'function']) assert.throws(() => expr({ op, value: 'any' }), e => e.tag === 'Unsupported');
  assert.throws(() => expr({ op: 'field', field: 'net', url: 'https://example.invalid' }));
});
test('IR/branches preserve static dependency closure but only read chosen values', () => {
  const e = expr({ op: 'if', condition: field('active'), yes: field('net'), no: field('gross') });
  assert.deepEqual(fieldDependencies(e), ['active', 'gross', 'net']);
  assert.deepEqual(evaluate(e, { active: { kind: 'boolean', value: true }, net: decimal('3') }), { value: decimal('3'), dependencies: ['active', 'net'] });
});
test('IR/limits bound recursive and broad expression graphs', () => {
  let e = literal({ kind: 'boolean', value: true }); for (let i = 0; i < 18; i++) e = { op: 'not', value: e };
  assert.throws(() => expr(e), e => e.code === 'EXPRESSION_LIMIT');
});
test('IR/inherited properties cannot become authorized fields', () => {
  assert.equal(evaluate(expr(field('secret')), Object.create({ secret: decimal('99') })).value.kind, 'missing');
});
test('apps/declarative components produce the existing operation without identity or authority', () => {
  const app = parseMiniApp(manifest, OPERATIONS); const reads = miniAppReads(app);
  assert.deepEqual(reads, [{ componentId: 'orders', operation: 'Inspect', input: manifest.components[0].input }]);
  assert.deepEqual(Object.keys(reads[0]).sort(), ['componentId', 'input', 'operation']);
});
test('apps/executable and unpublished operations cannot enter trusted renderer', () => {
  assert.throws(() => parseMiniApp({ ...manifest, renderer: 'executable' }, OPERATIONS), e => e.tag === 'Blocked');
  for (const operation of ['ExecuteSQL', 'AdmitClaim', 'CreatePersonalWorld']) assert.throws(() => parseMiniApp({ ...manifest, components: [{ ...manifest.components[0], operation }] }, OPERATIONS));
});
test('apps/duplicate components, fields and arbitrary executable properties reject', () => {
  assert.throws(() => parseMiniApp({ ...manifest, components: [...manifest.components, ...manifest.components] }, OPERATIONS));
  assert.throws(() => parseMiniApp({ ...manifest, components: [{ ...manifest.components[0], fields: ['label', 'label'] }] }, OPERATIONS));
  assert.throws(() => parseMiniApp({ ...manifest, javascript: 'return secret' }, OPERATIONS));
});
