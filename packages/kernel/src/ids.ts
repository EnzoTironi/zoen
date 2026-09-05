import { fail, ok, requireThat, toPublicFailure, type Result } from './result.js';
import { exactKeys, object, text, type JsonValue } from './json.js';

declare const uuidBrand: unique symbol;
declare const digestBrand: unique symbol;
declare const revisionBrand: unique symbol;
declare const semanticIdBrand: unique symbol;
declare const counterBrand: unique symbol;
declare const liveWorldBrand: unique symbol;
declare const evaluationWorldBrand: unique symbol;

export type UUID = string & { readonly [uuidBrand]: true };
export type Digest = string & { readonly [digestBrand]: true };
export type Revision = string & { readonly [revisionBrand]: true };
export type SemanticId = string & { readonly [semanticIdBrand]: true };
export type Counter = string & { readonly [counterBrand]: true };

/** Plain realm union — runtime-checked; WorldRef variants carry nominal realm brands. */
export type Realm = 'live' | 'evaluation';

export type WorldRef = Readonly<{ worldId: UUID; realm: Realm }>;
export type LiveWorldRef = WorldRef & { readonly [liveWorldBrand]: 'live' };
export type EvaluationWorldRef = WorldRef & { readonly [evaluationWorldBrand]: 'evaluation' };

/** Live-only Action input — TypeScript rejects EvaluationWorldRef at the worldRef field. */
export type LiveOnlyActionInput = Readonly<{
  worldRef: LiveWorldRef;
  operation: SemanticId;
  operationId: UUID;
}>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COUNTER_RE = /^(0|[1-9][0-9]{0,18})$/;
const DIGEST_RE = /^[a-f0-9]{64}$/;
const SEMANTIC_RE = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const MAX_COUNTER = 9223372036854775807n;

function catching<T>(fn: () => T): Result<T> {
  try {
    return ok(fn());
  } catch (error) {
    return toPublicFailure(error);
  }
}

export function uuid(value: string): UUID {
  requireThat(UUID_RE.test(value), 'INVALID_UUID');
  return value.toLowerCase() as UUID;
}

export function realm(value: string): Realm {
  requireThat(value === 'live' || value === 'evaluation', 'INVALID_REALM');
  return value;
}

export function worldRef(value: JsonValue): WorldRef {
  const v = object(value);
  exactKeys(v, ['worldId', 'realm']);
  return Object.freeze({ worldId: uuid(text(v['worldId'])), realm: realm(text(v['realm'])) });
}

export function liveWorldRef(value: JsonValue): LiveWorldRef {
  const ref = worldRef(value);
  requireThat(ref.realm === 'live', 'LIVE_REALM_REQUIRED');
  return Object.freeze({ worldId: ref.worldId, realm: 'live' as const }) as LiveWorldRef;
}

export function evaluationWorldRef(value: JsonValue): EvaluationWorldRef {
  const ref = worldRef(value);
  requireThat(ref.realm === 'evaluation', 'EVALUATION_REALM_REQUIRED');
  return Object.freeze({ worldId: ref.worldId, realm: 'evaluation' as const }) as EvaluationWorldRef;
}

export function sameWorld(a: WorldRef, b: WorldRef): boolean {
  return a.worldId === b.worldId && a.realm === b.realm;
}

export function assertWorld(a: WorldRef, b: WorldRef): void {
  requireThat(sameWorld(a, b), 'CROSS_WORLD_OR_REALM');
}

export function counter(value: string): Counter {
  requireThat(COUNTER_RE.test(value) && BigInt(value) <= MAX_COUNTER, 'INVALID_COUNTER');
  return value as Counter;
}

export function nextCounter(value: string): Counter {
  return counter((BigInt(counter(value)) + 1n).toString());
}

export function revision(value: string): Revision {
  requireThat(COUNTER_RE.test(value) && BigInt(value) <= MAX_COUNTER, 'INVALID_REVISION');
  return value as Revision;
}

export function semanticId(value: string): SemanticId {
  requireThat(SEMANTIC_RE.test(value) && value.length <= 128, 'INVALID_SEMANTIC_ID');
  return value as SemanticId;
}

export function digest(value: string): Digest {
  requireThat(DIGEST_RE.test(value), 'INVALID_DIGEST');
  return value as Digest;
}

export function liveOnlyActionInput(value: JsonValue): LiveOnlyActionInput {
  const v = object(value);
  exactKeys(v, ['worldRef', 'operation', 'operationId']);
  return Object.freeze({
    worldRef: liveWorldRef(v['worldRef'] as JsonValue),
    operation: semanticId(text(v['operation'], 128)),
    operationId: uuid(text(v['operationId'])),
  });
}

export function parseUuid(value: unknown): Result<UUID> {
  if (typeof value !== 'string') return fail('InvalidInput', 'INVALID_UUID');
  return catching(() => uuid(value));
}

export function parseRealm(value: unknown): Result<Realm> {
  if (typeof value !== 'string') return fail('InvalidInput', 'INVALID_REALM');
  return catching(() => realm(value));
}

export function parseWorldRef(value: unknown): Result<WorldRef> {
  return catching(() => worldRef(value as JsonValue));
}

export function parseLiveWorldRef(value: unknown): Result<LiveWorldRef> {
  return catching(() => liveWorldRef(value as JsonValue));
}

export function parseEvaluationWorldRef(value: unknown): Result<EvaluationWorldRef> {
  return catching(() => evaluationWorldRef(value as JsonValue));
}

export function parseDigest(value: unknown): Result<Digest> {
  if (typeof value !== 'string') return fail('InvalidInput', 'INVALID_DIGEST');
  return catching(() => digest(value));
}

export function parseRevision(value: unknown): Result<Revision> {
  if (typeof value !== 'string') return fail('InvalidInput', 'INVALID_REVISION');
  return catching(() => revision(value));
}

export function parseCounter(value: unknown): Result<Counter> {
  if (typeof value !== 'string') return fail('InvalidInput', 'INVALID_COUNTER');
  return catching(() => counter(value));
}

export function parseSemanticId(value: unknown): Result<SemanticId> {
  if (typeof value !== 'string') return fail('InvalidInput', 'INVALID_SEMANTIC_ID');
  return catching(() => semanticId(value));
}

/**
 * Runtime boundary parser for live-only Action input.
 * Rejects evaluation realm with InvalidInput before any repository call.
 */
export function parseLiveOnlyActionInput(value: unknown): Result<LiveOnlyActionInput> {
  return catching(() => liveOnlyActionInput(value as JsonValue));
}

/**
 * Compile-negative witness for evaluation/live confusion.
 * Typechecked with the kernel package; never invoked at runtime in production.
 */
export function __compileNegativeLiveEvalMix(
  evalWorld: EvaluationWorldRef,
  operation: SemanticId,
  operationId: UUID,
): void {
  // @ts-expect-error evaluation WorldRef cannot satisfy live-only Action worldRef
  const rejected: LiveOnlyActionInput = { worldRef: evalWorld, operation, operationId };
  void rejected;
}

/**
 * Compile-negative witness for cross-world LiveWorldRef vs EvaluationWorldRef assignment.
 */
export function __compileNegativeCrossWorldAssign(evalWorld: EvaluationWorldRef): LiveWorldRef {
  // @ts-expect-error EvaluationWorldRef is not assignable to LiveWorldRef
  return evalWorld;
}
