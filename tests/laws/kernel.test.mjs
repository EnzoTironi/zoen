import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJson, parseJsonText, canonicalJson, validUnicode } from '../../.core-build/packages/kernel/src/json.js';
import { uuid, worldRef, assertWorld, counter, nextCounter } from '../../.core-build/packages/kernel/src/ids.js';
import * as D from '../../.core-build/packages/kernel/src/decimal.js';
import * as T from '../../.core-build/packages/kernel/src/time.js';
import { topological, descendants } from '../../.core-build/packages/kernel/src/graph.js';
import { failureTags, fail, httpStatus, toPublicFailure } from '../../.core-build/packages/kernel/src/result.js';
const err = code => e => e.code === code;
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const d = D.parseDecimal;
function random(seed) { let s = seed >>> 0; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return s >>> 0; }; }

test('boundary/UUID validates before branding and rejects nil and arbitrary IDs', () => {
  assert.equal(uuid(id(1).toUpperCase()), id(1));
  for (const bad of ['root', '', '00000000-0000-0000-0000-000000000000', id(1) + 'x']) assert.throws(() => uuid(bad), err('INVALID_UUID'));
});
test('boundary/world and evaluation realm are non-interchangeable at runtime', () => {
  const live = worldRef({ worldId: id(1), realm: 'live' });
  assert.throws(() => assertWorld(live, worldRef({ worldId: id(1), realm: 'evaluation' })), err('CROSS_WORLD_OR_REALM'));
  assert.throws(() => worldRef({ worldId: id(1), realm: 'offline' }), err('INVALID_REALM'));
  assert.throws(() => worldRef({ worldId: id(1), realm: 'live', permit: 'owner' }), err('OBJECT_KEYS'));
});
test('boundary/bigint counters remain exact across the JS safe-integer boundary', () => {
  assert.equal(nextCounter('9007199254740992'), '9007199254740993');
  assert.equal(counter('9223372036854775807'), '9223372036854775807');
  for (const bad of ['01', '-1', '1e3', '9223372036854775808']) assert.throws(() => counter(bad), err('INVALID_COUNTER'));
  assert.throws(() => nextCounter('9223372036854775807'), err('INVALID_COUNTER'));
});
test('json/reject duplicate keys even when differently escaped', () => {
  for (const input of ['{"a":1,"a":2}', '{"a":1,"\\u0061":2}', '{"x":{"k":1,"k":2}}']) assert.throws(() => parseJsonText(input), err('JSON_DUPLICATE_KEY'));
});
test('json/reject malformed, fractional, oversized and imprecise authority numbers', () => {
  for (const input of ['1.0', '1e0', '9007199254740993', 'NaN', 'Infinity', '[1,]', '{"a":1,}', '01', 'true false']) assert.throws(() => parseJsonText(input));
  assert.equal(parseJsonText('-0'), 0);
  assert.equal(parseJsonText('9007199254740991'), Number.MAX_SAFE_INTEGER);
});
test('json/invalid UTF-8, BOM and lone surrogates fail rather than being repaired', () => {
  assert.throws(() => parseJson(new Uint8Array([0xc0, 0x80])), err('JSON_INVALID_UTF8'));
  assert.throws(() => parseJson(new Uint8Array([0xef, 0xbb, 0xbf, 0x31])));
  for (const input of ['"\\ud800"', '"\\udfff"', '{"\\ud800":1}']) assert.throws(() => parseJsonText(input), err('JSON_INVALID_UNICODE'));
  assert.equal(parseJsonText('"\\ud83d\\ude00"'), '😀'); assert.equal(validUnicode('😀'), true);
});
test('json/bounded depth, bytes and entries are enforced', () => {
  assert.throws(() => parseJsonText('['.repeat(34) + '0' + ']'.repeat(34)), err('JSON_DEPTH_LIMIT'));
  assert.throws(() => parseJson(new Uint8Array(1_048_577)), err('JSON_BYTE_LIMIT'));
  assert.throws(() => parseJsonText('[' + Array(10_001).fill('0').join(',') + ']'), err('JSON_ENTRY_LIMIT'));
});
test('json/canonical bytes are stable across member ordering and safe prototype keys', () => {
  const a = parseJsonText('{"z":3,"__proto__":{"polluted":true},"a":[false,null,"α"]}');
  const b = parseJsonText('{"a":[false,null,"α"],"__proto__":{"polluted":true},"z":3}');
  assert.equal(canonicalJson(a), canonicalJson(b)); assert.equal({}.polluted, undefined);
  assert.equal(canonicalJson({ '\r': 'r', '1': 1, '€': 'e', '😀': 'g' }), '{"\\r":"r","1":1,"€":"e","😀":"g"}');
});
test('json/reject getters, circular inputs, foreign prototypes and sparse arrays', () => {
  let called = false; const getter = { get a() { called = true; return 1; } };
  assert.throws(() => canonicalJson(getter), err('JSON_ACCESSOR')); assert.equal(called, false);
  const cyclic = {}; cyclic.x = cyclic; assert.throws(() => canonicalJson(cyclic), err('JSON_CYCLE'));
  assert.throws(() => canonicalJson(new Date()), err('JSON_NON_PLAIN_OBJECT'));
  assert.throws(() => canonicalJson(new Array(3)), err('JSON_SPARSE_OR_EXTENDED_ARRAY'));
});
test('json/property canonicalization is idempotent (seed 43117, 2000 examples)', () => {
  const rnd = random(43117);
  for (let n = 0; n < 2000; n++) {
    const input = { ['k' + rnd()]: rnd(), a: [rnd() % 2 === 0, null, String(rnd()), { nested: rnd() }] };
    const first = canonicalJson(input); assert.equal(canonicalJson(parseJsonText(first)), first);
  }
});
test('decimal/no float arithmetic for exact large and small quantities', () => {
  assert.equal(D.formatDecimal(D.add(d('9007199254740993.01'), d('0.09'))), '9007199254740993.10');
  assert.equal(D.formatDecimal(D.subtract(d('1.00'), d('0.99'))), '0.01');
  assert.equal(D.canonicalDecimal(d('-0.000')), '0');
  assert.equal(D.canonicalDecimal(d('123.4500')), '123.45');
});
test('decimal/NUMERIC(38,18) boundaries and invalid syntax', () => {
  assert.equal(D.formatDecimal(d('99999999999999999999.999999999999999999')), '99999999999999999999.999999999999999999');
  for (const bad of ['1e2', ' 1', '+1', '.1', '1.', '01', '1,50', '100000000000000000000', '0.0000000000000000001']) assert.throws(() => d(bad));
  assert.throws(() => D.add(d('99999999999999999999'), d('1')), err('DECIMAL_OVERFLOW'));
});
test('decimal/rounding is explicit, signed and half-even', () => {
  assert.throws(() => D.quantize(d('2.345'), 2, 'reject'), err('ROUNDING_REQUIRED'));
  for (const [input, mode, output] of [['2.345', 'half-even', '2.34'], ['2.355', 'half-even', '2.36'], ['-2.345', 'half-even', '-2.34'], ['-2.355', 'half-even', '-2.36'], ['-2.341', 'floor', '-2.35'], ['-2.349', 'ceil', '-2.34'], ['2.341', 'ceil', '2.35'], ['-2.349', 'toward-zero', '-2.34']]) assert.equal(D.formatDecimal(D.quantize(d(input), 2, mode)), output);
});
test('decimal/multiply/divide have exact scale and zero-denominator errors', () => {
  assert.equal(D.formatDecimal(D.multiply(d('12.50'), d('2'), 2, 'reject')), '25.00');
  assert.equal(D.formatDecimal(D.divide(d('1'), d('8'), 3, 'reject')), '0.125');
  assert.equal(D.formatDecimal(D.divide(d('-1'), d('-8'), 2, 'half-even')), '0.12');
  assert.throws(() => D.divide(d('1'), d('3'), 18, 'reject'), err('ROUNDING_REQUIRED'));
  assert.throws(() => D.divide(d('1'), d('0'), 2, 'reject'), err('DIVISION_BY_ZERO'));
});
test('money/currencies never implicitly mix', () => {
  assert.throws(() => D.addMoney(D.money('1', 'BRL'), D.money('1', 'USD')), err('CURRENCY_MISMATCH'));
  assert.equal(D.formatDecimal(D.addMoney(D.money('0.1', 'BRL'), D.money('0.2', 'BRL')).amount), '0.3');
});
test('decimal/property addition inverse and allocation conservation (seed 71023, 4000 examples)', () => {
  const rnd = random(71023);
  for (let n = 0; n < 4000; n++) {
    const a = D.decimal(BigInt(rnd()) - 2_000_000_000n, rnd() % 7);
    const b = D.decimal(BigInt(rnd()) - 2_000_000_000n, rnd() % 7);
    assert.equal(D.compare(D.subtract(D.add(a, b), b), a), 0);
    const total = D.decimal(BigInt(rnd() % 100_000) * (n % 2 ? -1n : 1n), 2);
    const weights = [{ id: 'a', weight: D.decimal(BigInt(rnd() % 100 + 1), 2) }, { id: 'b', weight: d('1') }, { id: 'c', weight: d('0.3') }];
    const allocation = D.allocate(total, weights);
    assert.equal(Object.values(allocation).reduce((sum, p) => sum + p.coefficient, 0n), total.coefficient);
    assert.deepEqual(D.allocate(total, weights.slice().reverse()), allocation);
  }
});
test('allocation/ties are stable and duplicate/zero/negative weights fail', () => {
  const pieces = D.allocate(d('0.01'), [{ id: 'b', weight: d('1') }, { id: 'a', weight: d('1') }]);
  assert.equal(D.formatDecimal(pieces.a), '0.01'); assert.equal(D.formatDecimal(pieces.b), '0.00');
  assert.throws(() => D.allocate(d('1'), [{ id: 'a', weight: d('0') }]), err('ZERO_TOTAL_WEIGHT'));
  assert.throws(() => D.allocate(d('1'), [{ id: 'a', weight: d('-1') }]), err('NEGATIVE_WEIGHT'));
  assert.throws(() => D.allocate(d('1'), [{ id: 'a', weight: d('1') }, { id: 'a', weight: d('1') }]));
});
test('time/calendar rejects rollovers and distinguishes dates from instants', () => {
  for (const bad of ['2025-02-29', '1900-02-29', '2026-04-31', '0000-01-01', '2026-13-01', '2026-00-01']) assert.throws(() => T.localDate(bad));
  assert.equal(T.localDate('2000-02-29').iso, '2000-02-29'); assert.equal(T.localDate('1970-01-01').day, 0);
  assert.throws(() => T.compareTime(T.localDate('2026-01-01'), T.instant('2026-01-01T00:00:00Z')), err('TIME_KIND_MISMATCH'));
});
test('time/nanoseconds, pre-epoch values and invalid UTC encodings', () => {
  assert.equal(T.instant('1969-12-31T23:59:59.999999999Z').nanoseconds, -1n);
  assert.equal(T.instant('1970-01-01T00:00:00.000000001Z').nanoseconds, 1n);
  for (const bad of ['2026-01-01T24:00:00Z', '2026-01-01T00:00:60Z', '2026-01-01T00:00:00-03:00', '2026-01-01', '2026-01-01T00:00:00.1234567890Z']) assert.throws(() => T.instant(bad));
});
test('time/half-open adjacent intervals never overlap', () => {
  const a = T.interval(T.localDate('2026-01-01'), T.localDate('2026-02-01'));
  const b = T.interval(T.localDate('2026-02-01'), T.localDate('2026-03-01'));
  assert.equal(T.overlaps(a, b), false); assert.equal(T.contains(a, T.localDate('2026-02-01')), false);
  assert.equal(T.contains(a, T.localDate('2026-01-01')), true);
  assert.equal(T.sameInterval({ kind: 'unknown' }, { kind: 'unknown' }), false);
  assert.throws(() => T.interval(T.localDate('2026-02-01'), T.localDate('2026-02-01')));
});
test('time/calendar arithmetic matches native UTC for 2000 recorded dates', () => {
  const rnd = random(8451);
  for (let n = 0; n < 2000; n++) { const y = 100 + rnd() % 9899; const m = 1 + rnd() % 12; const day = 1 + rnd() % 28; const iso = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`; assert.equal(T.localDate(iso).day * 86400_000, Date.parse(iso + 'T00:00:00Z')); }
});
test('graph/stable order, dependent propagation and cycle/missing-node rejection', () => {
  const edges = [{ from: 'b', to: 'c' }, { from: 'a', to: 'c' }, { from: 'c', to: 'd' }];
  assert.deepEqual(topological(['d', 'c', 'b', 'a'], edges), ['a', 'b', 'c', 'd']);
  assert.deepEqual(descendants(['a', 'b', 'c', 'd'], edges, ['a']), ['a', 'c', 'd']);
  assert.throws(() => topological(['a', 'b'], [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }]), err('GRAPH_CYCLE'));
  assert.throws(() => topological(['a'], [{ from: 'a', to: 'missing' }]), err('GRAPH_MISSING_NODE'));
});
test('public outcomes/unknown is not a fabricated external failure; internal details stay private', () => {
  for (const tag of failureTags) assert.equal(typeof httpStatus(fail(tag, 'CHECK')), 'number');
  assert.equal(httpStatus(fail('Unknown', 'PROVIDER_UNKNOWN')), 200);
  assert.deepEqual(toPublicFailure(new Error('postgres://secret@host:5432/db')), { tag: 'Unavailable', code: 'INTERNAL_FAILURE' });
});
test('JSON/text input does not silently replace an invalid raw surrogate', () => {
  assert.throws(() => parseJsonText('"\ud800"'), e => e.code === 'JSON_INVALID_UNICODE');
});
