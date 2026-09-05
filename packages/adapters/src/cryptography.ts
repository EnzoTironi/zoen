import { canonicalJson, type JsonValue } from '../../kernel/src/json.js';
import { uuid, type UUID } from '../../kernel/src/ids.js';
import { requireThat } from '../../kernel/src/result.js';
import type { Cryptography } from '../../contracts/src/ports.js';
const encoder = new TextEncoder();
export function base64url(bytes: Uint8Array): string {
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
export function unbase64url(text: string, maximum = 4096): Uint8Array {
  requireThat(text.length <= maximum && /^[A-Za-z0-9_-]+$/.test(text), 'BASE64URL_SYNTAX');
  const padded = text.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - text.length % 4) % 4);
  let binary: string; try { binary = atob(padded); } catch { throw new Error('Invalid base64url'); }
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0)); requireThat(base64url(bytes) === text, 'BASE64URL_CANONICAL'); return bytes;
}
export class WebCryptography implements Cryptography {
  randomId(): UUID { return uuid(crypto.randomUUID()); }
  randomReference(): string { return base64url(crypto.getRandomValues(new Uint8Array(24))); }
  async sha256(bytes: Uint8Array): Promise<string> {
    const hash = await crypto.subtle.digest('SHA-256', bytes); return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  async digest(value: JsonValue): Promise<string> { return this.sha256(encoder.encode(canonicalJson(value))); }
}
export async function hmacKey(secret: Uint8Array): Promise<CryptoKey> {
  requireThat(secret.length >= 32, 'SECRET_TOO_SHORT'); return crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function signHmac(key: CryptoKey, value: JsonValue): Promise<string> {
  requireThat(key.algorithm.name === 'HMAC', 'KEY_ALGORITHM'); return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(canonicalJson(value)))));
}
export async function verifyHmac(key: CryptoKey, value: JsonValue, signature: string): Promise<boolean> {
  try { return await crypto.subtle.verify('HMAC', key, unbase64url(signature), encoder.encode(canonicalJson(value))); } catch { return false; }
}
/** Signature proves bytes/key identity, never permissions or publication. */
export async function signArtifact(privateKey: CryptoKey, manifest: JsonValue): Promise<string> {
  requireThat(privateKey.type === 'private' && privateKey.algorithm.name === 'Ed25519', 'KEY_ALGORITHM');
  return base64url(new Uint8Array(await crypto.subtle.sign('Ed25519', privateKey, encoder.encode(canonicalJson(manifest)))));
}
export async function verifyArtifact(publicKey: CryptoKey, manifest: JsonValue, signature: string): Promise<boolean> {
  requireThat(publicKey.type === 'public' && publicKey.algorithm.name === 'Ed25519', 'KEY_ALGORITHM');
  try { return await crypto.subtle.verify('Ed25519', publicKey, unbase64url(signature), encoder.encode(canonicalJson(manifest))); } catch { return false; }
}
