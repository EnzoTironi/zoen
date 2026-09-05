import { KernelError, ok, requireThat, toPublicFailure, type Result } from './result.js';

export type JsonPrimitive = null | boolean | string | number;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type JsonObject = { readonly [key: string]: JsonValue };
export const JSON_LIMITS = Object.freeze({ bytes: 1_048_576, depth: 32, entries: 10_000 });
export type JsonLimits = Readonly<{ bytes: number; depth: number; entries: number }>;
const encoder = new TextEncoder();


/** Pure SHA-256 (FIPS 180-4) over UTF-8 bytes — no host/network I/O. */
function sha256Hex(bytes: Uint8Array): string {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const bitLen = BigInt(bytes.length) * 8n;
  const withPad = bytes.length + 1 + 8;
  const blockCount = Math.ceil(withPad / 64);
  const buf = new Uint8Array(blockCount * 64);
  buf.set(bytes);
  buf[bytes.length] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(buf.length - 4, Number(bitLen & 0xffffffffn));
  view.setUint32(buf.length - 8, Number((bitLen >> 32n) & 0xffffffffn));
  const W = new Uint32Array(64);
  const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));
  for (let i = 0; i < buf.length; i += 64) {
    for (let t = 0; t < 16; t++) W[t] = view.getUint32(i + t * 4);
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(W[t - 15]!, 7) ^ rotr(W[t - 15]!, 18) ^ (W[t - 15]! >>> 3);
      const s1 = rotr(W[t - 2]!, 17) ^ rotr(W[t - 2]!, 19) ^ (W[t - 2]! >>> 10);
      W[t] = (W[t - 16]! + s0 + W[t - 7]! + s1) >>> 0;
    }
    let a = H[0]!, b = H[1]!, c = H[2]!, d = H[3]!, e = H[4]!, f = H[5]!, g = H[6]!, h = H[7]!;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t]! + W[t]!) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    H[0] = (H[0]! + a) >>> 0; H[1] = (H[1]! + b) >>> 0; H[2] = (H[2]! + c) >>> 0; H[3] = (H[3]! + d) >>> 0;
    H[4] = (H[4]! + e) >>> 0; H[5] = (H[5]! + f) >>> 0; H[6] = (H[6]! + g) >>> 0; H[7] = (H[7]! + h) >>> 0;
  }
  return [...H].map((x) => x.toString(16).padStart(8, '0')).join('');
}


function catchingJson<T>(fn: () => T): Result<T> {
  try {
    return ok(fn());
  } catch (error) {
    return toPublicFailure(error);
  }
}

export function validUnicode(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return true;
}

/** Duplicate-aware, UTF-8-strict parser for authority JSON. Financial numbers are strings. */
export function parseJson(bytes: Uint8Array, limits: JsonLimits = JSON_LIMITS): JsonValue {
  requireThat(bytes.byteLength <= limits.bytes, 'JSON_BYTE_LIMIT');
  requireThat(Number.isSafeInteger(limits.bytes) && limits.bytes > 0 && limits.bytes <= JSON_LIMITS.bytes, 'JSON_LIMIT_CONFIG');
  requireThat(limits.depth > 0 && limits.depth <= 32 && limits.entries > 0 && limits.entries <= 10_000, 'JSON_LIMIT_CONFIG');
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new KernelError('InvalidInput', 'JSON_INVALID_UTF8');
  }
  let i = 0;
  let entries = 0;
  function invalid(code = 'JSON_SYNTAX'): never {
    throw new KernelError('InvalidInput', code);
  }
  function ws(): void {
    while (i < text.length && /[\x20\t\r\n]/.test(text[i]!)) i++;
  }
  function count(): void {
    if (++entries > limits.entries) invalid('JSON_ENTRY_LIMIT');
  }
  function str(): string {
    const start = i++;
    let escaped = false;
    while (i < text.length) {
      const ch = text[i++]!;
      if (!escaped && ch === '"') {
        let result: unknown;
        try {
          result = JSON.parse(text.slice(start, i));
        } catch {
          return invalid();
        }
        if (typeof result !== 'string' || !validUnicode(result)) return invalid('JSON_INVALID_UNICODE');
        return result;
      }
      if (!escaped && ch.charCodeAt(0) < 32) return invalid();
      if (!escaped && ch === '\\') escaped = true;
      else escaped = false;
    }
    return invalid();
  }
  function value(depth: number): JsonValue {
    if (depth > limits.depth) invalid('JSON_DEPTH_LIMIT');
    count();
    ws();
    const ch = text[i];
    if (ch === '"') return str();
    if (ch === '{') {
      i++;
      ws();
      const out: Record<string, JsonValue> = Object.create(null) as Record<string, JsonValue>;
      if (text[i] === '}') {
        i++;
        return Object.freeze(out);
      }
      while (true) {
        if (text[i] !== '"') return invalid();
        count();
        const key = str();
        if (Object.hasOwn(out, key)) return invalid('JSON_DUPLICATE_KEY');
        ws();
        if (text[i++] !== ':') return invalid();
        out[key] = value(depth + 1);
        ws();
        const separator = text[i++];
        if (separator === '}') break;
        if (separator !== ',') return invalid();
        ws();
      }
      return Object.freeze(out);
    }
    if (ch === '[') {
      i++;
      ws();
      const out: JsonValue[] = [];
      if (text[i] === ']') {
        i++;
        return Object.freeze(out);
      }
      while (true) {
        out.push(value(depth + 1));
        ws();
        const separator = text[i++];
        if (separator === ']') break;
        if (separator !== ',') return invalid();
        ws();
      }
      return Object.freeze(out);
    }
    for (const [literal, result] of [
      ['true', true],
      ['false', false],
      ['null', null],
    ] as const) {
      if (text.startsWith(literal, i)) {
        i += literal.length;
        return result;
      }
    }
    const number = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(text.slice(i));
    if (!number) return invalid();
    i += number[0].length;
    if (!/^-?(?:0|[1-9][0-9]*)$/.test(number[0])) return invalid('JSON_NUMBERS_MUST_BE_INTEGERS');
    const n = Number(number[0]);
    if (!Number.isSafeInteger(n)) return invalid('JSON_UNSAFE_NUMBER');
    return Object.is(n, -0) ? 0 : n;
  }
  const parsed = value(0);
  ws();
  if (i !== text.length) invalid();
  return parsed;
}

export function parseJsonText(text: string): JsonValue {
  requireThat(validUnicode(text), 'JSON_INVALID_UNICODE');
  return parseJson(encoder.encode(text));
}

/** JCS-compatible serialization for the deliberately narrower authority-JSON domain (RFC 8785 subset). */
export function canonicalJson(value: JsonValue, limits: JsonLimits = JSON_LIMITS): string {
  const parts: string[] = [];
  const active = new Set<object>();
  let size = 0;
  let entries = 0;
  function append(text: string): void {
    size += encoder.encode(text).byteLength;
    requireThat(size <= limits.bytes, 'JSON_BYTE_LIMIT');
    parts.push(text);
  }
  function visit(item: JsonValue, depth: number): void {
    requireThat(depth <= limits.depth, 'JSON_DEPTH_LIMIT');
    requireThat(++entries <= limits.entries, 'JSON_ENTRY_LIMIT');
    if (item === null) {
      append('null');
      return;
    }
    if (typeof item === 'boolean') {
      append(item ? 'true' : 'false');
      return;
    }
    if (typeof item === 'number') {
      requireThat(Number.isSafeInteger(item), 'JSON_UNSAFE_NUMBER');
      append(JSON.stringify(item));
      return;
    }
    if (typeof item === 'string') {
      requireThat(validUnicode(item), 'JSON_INVALID_UNICODE');
      append(JSON.stringify(item));
      return;
    }
    requireThat(typeof item === 'object' && item !== null, 'JSON_VALUE_TYPE');
    requireThat(!active.has(item), 'JSON_CYCLE');
    active.add(item);
    if (Array.isArray(item)) {
      requireThat(Object.keys(item).length === item.length && Object.getOwnPropertySymbols(item).length === 0, 'JSON_SPARSE_OR_EXTENDED_ARRAY');
      append('[');
      for (let index = 0; index < item.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(item, String(index));
        requireThat(descriptor !== undefined && 'value' in descriptor, 'JSON_ACCESSOR');
        if (index > 0) append(',');
        visit(descriptor.value as JsonValue, depth + 1);
      }
      append(']');
    } else {
      requireThat(Object.getPrototypeOf(item) === Object.prototype || Object.getPrototypeOf(item) === null, 'JSON_NON_PLAIN_OBJECT');
      requireThat(Object.getOwnPropertySymbols(item).length === 0, 'JSON_SYMBOL_KEY');
      append('{');
      const keys = Object.keys(item).sort();
      for (let index = 0; index < keys.length; index++) {
        const key = keys[index]!;
        const descriptor = Object.getOwnPropertyDescriptor(item, key);
        requireThat(descriptor !== undefined && 'value' in descriptor, 'JSON_ACCESSOR');
        requireThat(validUnicode(key), 'JSON_INVALID_UNICODE');
        requireThat(++entries <= limits.entries, 'JSON_ENTRY_LIMIT');
        if (index > 0) append(',');
        append(JSON.stringify(key));
        append(':');
        visit(descriptor.value as JsonValue, depth + 1);
      }
      append('}');
    }
    active.delete(item);
  }
  visit(value, 0);
  return parts.join('');
}

export function object(value: JsonValue, code = 'EXPECTED_OBJECT'): JsonObject {
  requireThat(value !== null && typeof value === 'object' && !Array.isArray(value), code);
  return value as JsonObject;
}

export function exactKeys(value: JsonObject, required: readonly string[], optional: readonly string[] = []): void {
  const allowed = new Set([...required, ...optional]);
  requireThat(required.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => allowed.has(key)), 'OBJECT_KEYS');
}

export function text(value: JsonValue | undefined, max = 256, code = 'EXPECTED_STRING'): string {
  requireThat(typeof value === 'string' && value.length > 0 && value.length <= max && validUnicode(value), code);
  return value;
}

export function list(value: JsonValue | undefined, max = 1000): readonly JsonValue[] {
  requireThat(Array.isArray(value) && value.length <= max, 'EXPECTED_BOUNDED_ARRAY');
  return value;
}

/** Reject remote schema/document references in authority JSON. */
export function assertNoRemoteReferences(value: JsonValue, depth = 0): void {
  requireThat(depth <= JSON_LIMITS.depth, 'JSON_DEPTH_LIMIT');
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) assertNoRemoteReferences(item, depth + 1);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if ((key === '$ref' || key === '$schema' || key === '$id') && typeof child === 'string') {
      requireThat(!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(child), 'JSON_REMOTE_REFERENCE');
    }
    assertNoRemoteReferences(child, depth + 1);
  }
}

export type DigestHex = string;

/** Spec: canonicalDigest(value) -> sha256 of RFC 8785-compatible canonical bytes. */
export function canonicalDigest(value: JsonValue, limits: JsonLimits = JSON_LIMITS): DigestHex {
  assertNoRemoteReferences(value);
  const canonical = canonicalJson(value, limits);
  return sha256Hex(encoder.encode(canonical));
}

export function parseJsonSafe(bytes: Uint8Array, limits: JsonLimits = JSON_LIMITS): Result<JsonValue> {
  return catchingJson(() => {
    const value = parseJson(bytes, limits);
    assertNoRemoteReferences(value);
    return value;
  });
}

export function parseJsonTextSafe(textValue: string, limits?: JsonLimits): Result<JsonValue> {
  return catchingJson(() => {
    const value = limits ? parseJson(encoder.encode(textValue), limits) : parseJsonText(textValue);
    assertNoRemoteReferences(value);
    return value;
  });
}

export type ValidEnvelope = Readonly<{
  schemaVersion: string;
  operation: string;
  operationId: string;
  worldRef: JsonObject;
  purpose: string;
  input: JsonValue;
  expectedBasis?: JsonValue;
}>;

const ENVELOPE_REQUIRED = ['schemaVersion', 'operation', 'operationId', 'worldRef', 'purpose', 'input'] as const;

/** Spec: parseEnvelope(bytes) -> ValidEnvelope | InvalidInput */
export function parseEnvelope(bytes: Uint8Array, limits: JsonLimits = JSON_LIMITS): Result<ValidEnvelope> {
  return catchingJson(() => {
    const value = parseJson(bytes, limits);
    assertNoRemoteReferences(value);
    const obj = object(value, 'ENVELOPE_OBJECT');
    exactKeys(obj, ENVELOPE_REQUIRED, ['expectedBasis']);
    const schemaVersion = text(obj['schemaVersion'], 32, 'ENVELOPE_SCHEMA_VERSION');
    requireThat(/^v?\d+(?:\.\d+){0,2}$/.test(schemaVersion), 'ENVELOPE_UNSUPPORTED_VERSION');
    const operation = text(obj['operation'], 128, 'ENVELOPE_OPERATION');
    requireThat(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(operation), 'ENVELOPE_OPERATION');
    const operationId = text(obj['operationId'], 64, 'ENVELOPE_OPERATION_ID');
    requireThat(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId),
      'ENVELOPE_OPERATION_ID',
    );
    const worldRefValue = object(obj['worldRef'] as JsonValue, 'ENVELOPE_WORLD_REF');
    exactKeys(worldRefValue, ['worldId', 'realm']);
    const purpose = text(obj['purpose'], 128, 'ENVELOPE_PURPOSE');
    const input = obj['input'] as JsonValue;
    requireThat(input !== undefined, 'ENVELOPE_INPUT');
    return Object.freeze({
      schemaVersion,
      operation,
      operationId: operationId.toLowerCase(),
      worldRef: worldRefValue,
      purpose,
      input,
      ...(Object.hasOwn(obj, 'expectedBasis') ? { expectedBasis: obj['expectedBasis'] as JsonValue } : {}),
    });
  });
}

