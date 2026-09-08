import { Schema } from "effect";

import { exact } from "../../worlds/values.js";

/**
 * Candidate hosted retained profile for NEW Worlds only (freeze H01).
 * Existing worlds-local-retained-v1 / worlds-local-erasable-v1 Worlds are never rebound.
 */
export const HostedRetainedPolicyProfileId = Schema.Literal(
  "worlds-hosted-retained-v1"
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

/**
 * Candidate hosted erasable profile for NEW Worlds only (ZA-14 / H-02).
 * Never rebound onto retained installs, legacy app zoen, or worlds-hosted-retained-v1.
 */
export const HostedErasablePolicyProfileId = Schema.Literal(
  "worlds-hosted-erasable-v1"
);
export type HostedErasablePolicyProfileId =
  typeof HostedErasablePolicyProfileId.Type;

/**
 * Hosted erasable policy: erasure true for authorized NEW targets only.
 * restoreAfterErasure stays false until controller + catalog + fence qualify.
 * Full hosted Erased product activation is gated separately (H-01/H-02/G-OPS/G-STORAGE-FENCE).
 */
export const HostedErasableDataPolicy = Schema.Struct({
  dataScope: Schema.Literal("admitted-non-sensitive"),
  enabledRealm: Schema.Literal("live"),
  erasure: Schema.Literal(true),
  legalHold: Schema.Literal(false),
  licensedExpiry: Schema.Literal(false),
  profileId: HostedErasablePolicyProfileId,
  restoreAfterErasure: Schema.Literal(false),
  retention: Schema.Literal("while-pinned"),
}).annotate(exact);
export type HostedErasableDataPolicy = typeof HostedErasableDataPolicy.Type;
