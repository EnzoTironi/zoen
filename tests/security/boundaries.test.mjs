import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, createHash } from 'node:crypto';
import { WebCryptography, base64url, unbase64url, hmacKey, signHmac, verifyHmac, signArtifact, verifyArtifact } from '../../.core-build/packages/adapters/src/cryptography.js';
import { exactOrigin, localReturnPath, filteredGuestHeaders, readBoundedBody, requireJson, secureBaseUrl, PRIVATE_HEADERS } from '../../.core-build/packages/adapters/src/http-security.js';
import { assertLinkRestriction, assertAppSession, intersectCapabilities, requireInformationFlow } from '../../.core-build/packages/ontology/src/apps/session-constraints.js';
import { canonicalJson } from '../../.core-build/packages/kernel/src/json.js';
const now = '2026-09-04T12:00:00Z';
const world = { worldId: '00000000-0000-4000-8000-000000000001', realm: 'live' };
const link = { world, reference: 'opaque-not-a-grant', recipientId: 'alice', expiresAt: '2026-09-05T00:00:00Z', state: 'active', appId: 'orders', version: { kind: 'current' } };
const session = { id: 'app-session', principalId: 'alice', world, purpose: 'operations', linkReference: link.reference, appId: 'orders', manifestDigest: 'a'.repeat(64), securityRevision: '2', operations: ['Inspect'], issuedAt: '2026-09-04T11:00:00Z', idleExpiresAt: '2026-09-04T13:00:00Z', absoluteExpiresAt: '2026-09-04T14:00:00Z', state: 'active' };
const expected = { principalId: 'alice', world, purpose: 'operations', operation: 'Inspect', securityRevision: '2', manifestDigest: session.manifestDigest };
test('crypto/SHA-256 agrees with independent native implementation', async () => {
  const c = new WebCryptography();
  for (const text of ['', 'Zoen', 'avó', 'x'.repeat(50_000)]) assert.equal(await c.sha256(new TextEncoder().encode(text)), createHash('sha256').update(text).digest('hex'));
});
test('crypto/references have 192 random bits, distinct UUIDs and canonical encoding', () => {
  const c = new WebCryptography(), refs = new Set(), ids = new Set();
  for (let i = 0; i < 1000; i++) { const r = c.randomReference(); assert.equal(unbase64url(r).length, 24); assert.equal(r.length, 32); refs.add(r); ids.add(c.randomId()); }
  assert.equal(refs.size, 1000); assert.equal(ids.size, 1000);
  for (const invalid of ['a', 'Zh', '=Zg', 'Zg==', 'Z g', '../x']) assert.throws(() => unbase64url(invalid));
});
test('crypto/HMAC uses actual crypto, rejects changes and matches native HMAC', async () => {
  const secret = new Uint8Array(32).fill(9), key = await hmacKey(secret), value = { world: 'a', scope: ['Inspect'] };
  const signed = await signHmac(key, value);
  assert.equal(signed, createHmac('sha256', secret).update(canonicalJson(value)).digest('base64url'));
  assert.equal(await verifyHmac(key, value, signed), true);
  assert.equal(await verifyHmac(key, { ...value, world: 'b' }, signed), false);
  assert.equal(await verifyHmac(await hmacKey(new Uint8Array(32).fill(8)), value, signed), false);
  await assert.rejects(hmacKey(new Uint8Array(16)));
});
test('crypto/actual Ed25519 signature is byte-specific, not an authorization grant', async () => {
  const keys = await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']);
  const manifest = { app: 'orders', version: '1', capabilities: ['Inspect'] }; const signed = await signArtifact(keys.privateKey, manifest);
  assert.equal(await verifyArtifact(keys.publicKey, manifest, signed), true);
  assert.equal(await verifyArtifact(keys.publicKey, { ...manifest, capabilities: ['Transfer'] }, signed), false);
  assert.equal(await verifyArtifact(keys.publicKey, manifest, signed.slice(1)), false);
});
test('links/forwarded, revoked, expired and missing links reveal same neutral error', () => {
  assert.doesNotThrow(() => assertLinkRestriction(link, 'alice', now));
  for (const [record, person, time] of [[link, 'bob', now], [{ ...link, state: 'revoked' }, 'alice', now], [null, 'alice', now], [link, 'alice', link.expiresAt]]) assert.throws(() => assertLinkRestriction(record, person, time), e => e.tag === 'NotFoundOrDenied' && e.code === 'NOT_FOUND_OR_DENIED');
});
test('sessions/context, world, realm and operation never inherit publisher authority', () => {
  assert.doesNotThrow(() => assertAppSession(session, expected, now));
  for (const changed of [{ principalId: 'publisher' }, { world: { ...world, realm: 'evaluation' } }, { purpose: 'export' }, { operation: 'Transfer' }, { securityRevision: '3' }, { manifestDigest: 'b'.repeat(64) }]) assert.throws(() => assertAppSession(session, { ...expected, ...changed }, now));
});
test('sessions/idle and absolute expiration, pre-issuance and closed sessions fail', () => {
  for (const time of [session.idleExpiresAt, session.absoluteExpiresAt, '2026-09-04T10:00:00Z']) assert.throws(() => assertAppSession(session, expected, time), e => e.tag === 'Expired');
  assert.throws(() => assertAppSession({ ...session, state: 'closed' }, expected, now));
});
test('capabilities/intersection only narrows and empty permits cannot expand access', () => {
  assert.deepEqual(intersectCapabilities(['Inspect', 'Transfer'], ['Inspect'], ['Inspect', 'Export']), ['Inspect']);
  assert.deepEqual(intersectCapabilities(['Inspect'], []), []);
});
test('isolation/executable code cannot receive private data merely because it is signed', () => {
  assert.throws(() => requireInformationFlow({ renderer: 'executable', classifiedData: true, disclosureApproved: false, isolatedHostAdmitted: true }), e => e.tag === 'Blocked');
  assert.throws(() => requireInformationFlow({ renderer: 'executable', classifiedData: false, disclosureApproved: true, isolatedHostAdmitted: false }), e => e.tag === 'Blocked');
  assert.doesNotThrow(() => requireInformationFlow({ renderer: 'trusted-declarative', classifiedData: true, disclosureApproved: false, isolatedHostAdmitted: false }));
});
test('HTTP/exact origins reject suffixes, userinfo, subdomains and null', () => {
  exactOrigin('https://app.example.com', 'https://app.example.com');
  for (const actual of [null, 'null', 'https://app.example.com.attacker.test', 'https://app.example.com@attacker.test', 'https://other.example.com', 'https://app.example.com/']) assert.throws(() => exactOrigin(actual, 'https://app.example.com'));
});
test('HTTP/return paths have no redirect or encoded slash escape hatch', () => {
  assert.equal(localReturnPath('/world', ['/world']), '/world');
  for (const path of ['//evil.test', '/%2fevil', '/\\evil', '/world?next=x', '/world#x', '/world\n', 'https://evil.test']) assert.throws(() => localReturnPath(path, [path]));
});
test('HTTP/generated runtime never receives cookies, bearer tokens or forged identity headers', () => {
  const input = new Headers({ Cookie: 'private', Authorization: 'Bearer private', 'X-Zoen-Principal': 'admin', 'X-Forwarded-For': '127.0.0.1', 'Content-Type': 'application/json', Accept: 'application/json' });
  assert.deepEqual([...filteredGuestHeaders(input).keys()], ['accept', 'content-type']);
});
test('HTTP/body bounds apply to chunked streams, not just Content-Length', async () => {
  const req = new Request('http://localhost', { method: 'POST', body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(12)); controller.enqueue(new Uint8Array(12)); controller.close(); } }), duplex: 'half' });
  await assert.rejects(readBoundedBody(req, 20), e => e.code === 'BODY_LIMIT');
  assert.equal((await readBoundedBody(new Request('http://localhost', { method: 'POST', body: 'okay' }), 4)).length, 4);
});
test('HTTP/oversized lengths and compressed inputs reject before interpretation', async () => {
  for (const headers of [{ 'Content-Length': '9999999999999999999999' }, { 'Content-Encoding': 'gzip' }, { 'Content-Length': '-1' }]) await assert.rejects(readBoundedBody(new Request('http://localhost', { method: 'POST', headers, body: 'x' })));
  assert.throws(() => requireJson(new Request('http://localhost')));
});
test('HTTP/no-store and HTTPS requirements apply without a development login bypass', () => {
  assert.match(PRIVATE_HEADERS['Cache-Control'], /no-store/); assert.equal(PRIVATE_HEADERS['Referrer-Policy'], 'no-referrer');
  assert.equal(secureBaseUrl('http://127.0.0.1:3000').hostname, '127.0.0.1');
  for (const url of ['http://example.com', 'https://user:password@example.com', 'file:///tmp', 'http://localhost.evil.test']) assert.throws(() => secureBaseUrl(url));
});
test('canonical/array accessors cannot execute while signing authority bytes', () => {
  let invoked = false; const value = []; Object.defineProperty(value, '0', { enumerable: true, get() { invoked = true; return 'secret'; } });
  assert.throws(() => canonicalJson(value), e => e.code === 'JSON_ACCESSOR'); assert.equal(invoked, false);
});
test('config/missing real dependencies never selects a fallback implementation', async () => {
  const { readConfig } = await import('../../.core-build/packages/adapters/src/config.js');
  assert.throws(() => readConfig({}), e => e.tag === 'Blocked');
  for (const flag of ['MOCK_MODE','OFFLINE_MODE','SKIP_AUTH','DEV_USER','FAKE_PROVIDER','AWS_ENDPOINT_URL_S3']) assert.throws(() => readConfig({[flag]:'1'}), e => e.code === 'UNSUPPORTED_FALLBACK_CONFIGURATION');
});
