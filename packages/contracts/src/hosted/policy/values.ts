import { Schema } from "effect";

import { exact } from "../../worlds/values.js";

/**
 * Candidate hosted retained profile for NEW Worlds only (freeze H01).
 * Existing worlds-local-retained-v1 / d03-local-erasable-v1 Worlds are never rebound.
 */
export const HostedRetainedPolicyProfileId = Schema.Literal(
  "d04-hosted-retained-v1"
);
export type HostedRetainedPolicyProfileId =
  typeof HostedRetainedPolicyProfileId.Type;

/** Wire schema version for hosted policy DTOs (distinct from erasure.v1 / d01.v1). */
export const HostedSchemaVersion = Schema.Literal("hosted.v1");
export type HostedSchemaVersion = typeof HostedSchemaVersion.Type;

/**
 * Hosted retained policy (freeze H02): while-pinned, admitted-non-sensitive,
 * live realm, erasure false, restoreAfterErasure false.
 */
export const HostedRetainedDataPolicy = Schema.Struct({
  dataScope: Schema.Literal("admitted-non-sensitive"),
  enabledRealm: Schema.Literal("live"),
  erasure: Schema.Literal(false),
  legalHold: Schema.Literal(false),
  licensedExpiry: Schema.Literal(false),
  profileId: HostedRetainedPolicyProfileId,
  restoreAfterErasure: Schema.Literal(false),
  retention: Schema.Literal("while-pinned"),
}).annotate(exact);
export type HostedRetainedDataPolicy = typeof HostedRetainedDataPolicy.Type;
