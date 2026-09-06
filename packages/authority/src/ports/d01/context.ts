import type { Unauthenticated, Unavailable } from "@zoen/contracts/d01/errors";
import { Instant, Purpose, Realm, exact } from "@zoen/contracts/d01/values";
import type { Effect, Redacted } from "effect";
import { Context, Schema } from "effect";

export const PrincipalId = Schema.String.check(Schema.isUUID()).pipe(
  Schema.brand("zoen/PrincipalId")
);
export const SessionId = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(256)
).pipe(Schema.brand("zoen/SessionId"));
export const VerifiedPresence = Schema.Struct({
  authenticatedAt: Instant,
  expiresAt: Instant,
  principalId: PrincipalId,
  realm: Realm,
  sessionId: SessionId,
})
  .check(Schema.makeFilter((value) => value.authenticatedAt < value.expiresAt))
  .annotate(exact);
export type VerifiedPresence = typeof VerifiedPresence.Type;
export const VerifiedRequestContext = Schema.Struct({
  deadline: Instant,
  presence: VerifiedPresence,
  purpose: Purpose,
}).annotate(exact);
export type VerifiedRequestContext = typeof VerifiedRequestContext.Type;

export class Presence extends Context.Service<
  Presence,
  {
    readonly verify: (
      credential: Redacted.Redacted
    ) => Effect.Effect<VerifiedPresence, Unauthenticated | Unavailable>;
  }
>()("zoen/authority/ports/d01/Presence") {}

/** Retained Worlds: no erasure, no restore-after-erasure. */
export const RetainedDataPolicySchema = Schema.Struct({
  dataScope: Schema.Literal("admitted-non-sensitive"),
  enabledRealm: Schema.Literal("live"),
  erasure: Schema.Literal(false),
  legalHold: Schema.Literal(false),
  licensedExpiry: Schema.Literal(false),
  profileId: Schema.Literal("d01-local-retained-v1"),
  restoreAfterErasure: Schema.Literal(false),
  retention: Schema.Literal("while-pinned"),
}).annotate(exact);
export type RetainedDataPolicySchema = typeof RetainedDataPolicySchema.Type;

/**
 * Candidate erasable profile for NEW Worlds only (freeze F02).
 * restoreAfterErasure stays false until a qualified controller exists (F04).
 */
export const ErasableDataPolicySchema = Schema.Struct({
  dataScope: Schema.Literal("admitted-non-sensitive"),
  enabledRealm: Schema.Literal("live"),
  erasure: Schema.Literal(true),
  legalHold: Schema.Literal(false),
  licensedExpiry: Schema.Literal(false),
  profileId: Schema.Literal("d03-local-erasable-v1"),
  restoreAfterErasure: Schema.Literal(false),
  retention: Schema.Literal("while-pinned"),
}).annotate(exact);
export type ErasableDataPolicySchema = typeof ErasableDataPolicySchema.Type;

export const DataPolicySchema = Schema.Union([
  RetainedDataPolicySchema,
  ErasableDataPolicySchema,
]);
export type DataPolicySchema = typeof DataPolicySchema.Type;
export class DataPolicy extends Context.Service<DataPolicy, DataPolicySchema>()(
  "zoen/authority/ports/d01/DataPolicy"
) {}
