import { requireThat } from './result.js';
import { exactKeys, object, text, type JsonValue } from './json.js';
declare const uuidBrand: unique symbol;
export type UUID = string & { readonly [uuidBrand]: true };
export type Realm = 'live' | 'evaluation';
export type WorldRef = Readonly<{ worldId: UUID; realm: Realm }>;
export function uuid(value: string): UUID {
  requireThat(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value), 'INVALID_UUID');
  return value.toLowerCase() as UUID;
}
export function realm(value: string): Realm {
  requireThat(value === 'live' || value === 'evaluation', 'INVALID_REALM'); return value;
}
export function worldRef(value: JsonValue): WorldRef {
  const v = object(value); exactKeys(v, ['worldId', 'realm']);
  return Object.freeze({ worldId: uuid(text(v['worldId'])), realm: realm(text(v['realm'])) });
}
export function sameWorld(a: WorldRef, b: WorldRef): boolean { return a.worldId === b.worldId && a.realm === b.realm; }
export function assertWorld(a: WorldRef, b: WorldRef): void { requireThat(sameWorld(a, b), 'CROSS_WORLD_OR_REALM'); }
export function counter(value: string): string {
  requireThat(/^(0|[1-9][0-9]{0,18})$/.test(value) && BigInt(value) <= 9223372036854775807n, 'INVALID_COUNTER'); return value;
}
export function nextCounter(value: string): string { return counter((BigInt(counter(value)) + 1n).toString()); }
export function semanticId(value: string): string {
  requireThat(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(value) && value.length <= 128, 'INVALID_SEMANTIC_ID'); return value;
}
export function digest(value: string): string { requireThat(/^[a-f0-9]{64}$/.test(value), 'INVALID_DIGEST'); return value; }
