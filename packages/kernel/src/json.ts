import { KernelError, requireThat } from './result.js';
export type JsonPrimitive = null | boolean | string | number;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type JsonObject = { readonly [key: string]: JsonValue };
export const JSON_LIMITS = Object.freeze({ bytes: 1_048_576, depth: 32, entries: 10_000 });
export type JsonLimits = Readonly<{ bytes: number; depth: number; entries: number }>;
const encoder = new TextEncoder();

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
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw new KernelError('InvalidInput', 'JSON_INVALID_UTF8'); }
  let i = 0; let entries = 0;
  function invalid(code = 'JSON_SYNTAX'): never { throw new KernelError('InvalidInput', code); }
  function ws(): void { while (i < text.length && /[\x20\t\r\n]/.test(text[i]!)) i++; }
  function count(): void { if (++entries > limits.entries) invalid('JSON_ENTRY_LIMIT'); }
  function str(): string {
    const start = i++;
    let escaped = false;
    while (i < text.length) {
      const ch = text[i++]!;
      if (!escaped && ch === '"') {
        let result: unknown;
        try { result = JSON.parse(text.slice(start, i)); } catch { return invalid(); }
        if (typeof result !== 'string' || !validUnicode(result)) return invalid('JSON_INVALID_UNICODE');
        return result;
      }
      if (!escaped && ch.charCodeAt(0) < 32) return invalid();
      if (!escaped && ch === '\\') escaped = true; else escaped = false;
    }
    return invalid();
  }
  function value(depth: number): JsonValue {
    if (depth > limits.depth) invalid('JSON_DEPTH_LIMIT');
    count(); ws(); const ch = text[i];
    if (ch === '"') return str();
    if (ch === '{') {
      i++; ws(); const out: Record<string, JsonValue> = Object.create(null) as Record<string, JsonValue>;
      if (text[i] === '}') { i++; return Object.freeze(out); }
      while (true) {
        if (text[i] !== '"') return invalid();
        count(); const key = str();
        if (Object.hasOwn(out, key)) return invalid('JSON_DUPLICATE_KEY');
        ws(); if (text[i++] !== ':') return invalid();
        out[key] = value(depth + 1); ws();
        const separator = text[i++]; if (separator === '}') break;
        if (separator !== ',') return invalid(); ws();
      }
      return Object.freeze(out);
    }
    if (ch === '[') {
      i++; ws(); const out: JsonValue[] = [];
      if (text[i] === ']') { i++; return Object.freeze(out); }
      while (true) {
        out.push(value(depth + 1)); ws(); const separator = text[i++];
        if (separator === ']') break; if (separator !== ',') return invalid(); ws();
      }
      return Object.freeze(out);
    }
    for (const [literal, result] of [['true', true], ['false', false], ['null', null]] as const) {
      if (text.startsWith(literal, i)) { i += literal.length; return result; }
    }
    const number = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(text.slice(i));
    if (!number) return invalid();
    i += number[0].length;
    // Reject fractional/exponent spellings even if they round to a safe integer.
    if (!/^-?(?:0|[1-9][0-9]*)$/.test(number[0])) return invalid('JSON_NUMBERS_MUST_BE_INTEGERS');
    const n = Number(number[0]);
    if (!Number.isSafeInteger(n)) return invalid('JSON_UNSAFE_NUMBER');
    return Object.is(n, -0) ? 0 : n;
  }
  const parsed = value(0); ws(); if (i !== text.length) invalid();
  return parsed;
}
export function parseJsonText(text: string): JsonValue { requireThat(validUnicode(text), 'JSON_INVALID_UNICODE'); return parseJson(encoder.encode(text)); }
/** JCS-compatible serialization for the deliberately narrower authority-JSON domain. */
export function canonicalJson(value: JsonValue, limits: JsonLimits = JSON_LIMITS): string {
  const parts: string[] = []; const active = new Set<object>(); let size = 0; let entries = 0;
  function append(text: string): void {
    size += encoder.encode(text).byteLength;
    requireThat(size <= limits.bytes, 'JSON_BYTE_LIMIT'); parts.push(text);
  }
  function visit(item: JsonValue, depth: number): void {
    requireThat(depth <= limits.depth, 'JSON_DEPTH_LIMIT');
    requireThat(++entries <= limits.entries, 'JSON_ENTRY_LIMIT');
    if (item === null) { append('null'); return; }
    if (typeof item === 'boolean') { append(item ? 'true' : 'false'); return; }
    if (typeof item === 'number') { requireThat(Number.isSafeInteger(item), 'JSON_UNSAFE_NUMBER'); append(JSON.stringify(item)); return; }
    if (typeof item === 'string') { requireThat(validUnicode(item), 'JSON_INVALID_UNICODE'); append(JSON.stringify(item)); return; }
    requireThat(typeof item === 'object' && item !== null, 'JSON_VALUE_TYPE');
    requireThat(!active.has(item), 'JSON_CYCLE'); active.add(item);
    if (Array.isArray(item)) {
      requireThat(Object.keys(item).length === item.length && Object.getOwnPropertySymbols(item).length === 0, 'JSON_SPARSE_OR_EXTENDED_ARRAY'); append('[');
      for (let index = 0; index < item.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(item, String(index));
        requireThat(descriptor !== undefined && 'value' in descriptor, 'JSON_ACCESSOR');
        if (index > 0) append(','); visit(descriptor.value as JsonValue, depth + 1);
      }
      append(']');
    } else {
      requireThat(Object.getPrototypeOf(item) === Object.prototype || Object.getPrototypeOf(item) === null, 'JSON_NON_PLAIN_OBJECT');
      requireThat(Object.getOwnPropertySymbols(item).length === 0, 'JSON_SYMBOL_KEY');
      append('{'); const keys = Object.keys(item).sort();
      for (let index = 0; index < keys.length; index++) {
        const key = keys[index]!; const descriptor = Object.getOwnPropertyDescriptor(item, key);
        requireThat(descriptor !== undefined && 'value' in descriptor, 'JSON_ACCESSOR');
        requireThat(validUnicode(key), 'JSON_INVALID_UNICODE'); requireThat(++entries <= limits.entries, 'JSON_ENTRY_LIMIT');
        if (index > 0) append(','); append(JSON.stringify(key)); append(':');
        visit(descriptor.value as JsonValue, depth + 1);
      }
      append('}');
    }
    active.delete(item);
  }
  visit(value, 0); return parts.join('');
}
export function object(value: JsonValue, code = 'EXPECTED_OBJECT'): JsonObject {
  requireThat(value !== null && typeof value === 'object' && !Array.isArray(value), code); return value as JsonObject;
}
export function exactKeys(value: JsonObject, required: readonly string[], optional: readonly string[] = []): void {
  const allowed = new Set([...required, ...optional]);
  requireThat(required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => allowed.has(key)), 'OBJECT_KEYS');
}
export function text(value: JsonValue | undefined, max = 256, code = 'EXPECTED_STRING'): string {
  requireThat(typeof value === 'string' && value.length > 0 && value.length <= max && validUnicode(value), code); return value;
}
export function list(value: JsonValue | undefined, max = 1000): readonly JsonValue[] {
  requireThat(Array.isArray(value) && value.length <= max, 'EXPECTED_BOUNDED_ARRAY'); return value;
}
