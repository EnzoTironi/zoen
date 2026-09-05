import { KernelError, requireThat } from '../../kernel/src/result.js';
import { JSON_LIMITS } from '../../kernel/src/json.js';
export const PRIVATE_HEADERS = Object.freeze({
  'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  Vary: 'Cookie, Authorization',
});
export function exactOrigin(actual: string | null, expected: string): void {
  let trusted: URL; try { trusted = new URL(expected); } catch { throw new KernelError('Blocked', 'INVALID_PUBLIC_ORIGIN'); }
  requireThat(expected === trusted.origin && trusted.username === '' && trusted.password === '', 'ORIGIN_CONFIG');
  if (actual !== expected) throw new KernelError('Denied', 'ORIGIN_MISMATCH');
}
export function localReturnPath(value: string, registered: readonly string[]): string {
  requireThat(value.startsWith('/') && !value.startsWith('//') && !/[\\\x00-\x20%?#]/.test(value) && registered.includes(value), 'UNREGISTERED_RETURN_PATH'); return value;
}
export function filteredGuestHeaders(headers: Headers): Headers {
  const clean = new Headers();
  for (const allowed of ['content-type', 'accept', 'accept-language']) { const value = headers.get(allowed); if (value !== null) clean.set(allowed, value); }
  return clean;
}
export async function readBoundedBody(request: Request, max = JSON_LIMITS.bytes): Promise<Uint8Array> {
  const encoding = request.headers.get('content-encoding'); requireThat(encoding === null || encoding === 'identity', 'UNSUPPORTED_CONTENT_ENCODING');
  const length = request.headers.get('content-length');
  if (length !== null) { requireThat(/^(0|[1-9][0-9]*)$/.test(length), 'CONTENT_LENGTH'); if (BigInt(length) > BigInt(max)) throw new KernelError('QuotaExceeded', 'BODY_LIMIT'); }
  if (request.body === null) return new Uint8Array();
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break; total += value.byteLength;
      if (total > max) { await reader.cancel(); throw new KernelError('QuotaExceeded', 'BODY_LIMIT'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; } return result;
}
export function requireJson(request: Request): void {
  requireThat((request.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase() === 'application/json', 'CONTENT_TYPE');
}
export function secureBaseUrl(value: string): URL {
  const url = new URL(value); requireThat(url.username === '' && url.password === '' && url.search === '' && url.hash === '', 'BASE_URL');
  const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  requireThat(url.protocol === 'https:' || (loopback && url.protocol === 'http:'), 'HTTPS_REQUIRED'); return url;
}
