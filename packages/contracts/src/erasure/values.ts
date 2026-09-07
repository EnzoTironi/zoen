import { Schema } from "effect";

import { exact } from "../worlds/values.js";

/** Candidate profile for NEW Worlds only; retained Worlds stay worlds-local-retained-v1. */
export const ErasurePolicyProfileId = Schema.Literal("d03-local-erasable-v1");
export type ErasurePolicyProfileId = typeof ErasurePolicyProfileId.Type;

export const ErasureSchemaVersion = Schema.Literal("erasure.v1");
export type ErasureSchemaVersion = typeof ErasureSchemaVersion.Type;

/** Local World lifecycle after an authorized Closing decision. */
export const WorldErasurePhase = Schema.Literals([
  "Active",
  "Closing",
  "Suppressed",
  "Purging",
  "Erased",
  "Blocked",
  "Unknown",
]);
export type WorldErasurePhase = typeof WorldErasurePhase.Type;

/** External attempt register terminality (outside app rollback). */
export const ErasureAttemptExternalState = Schema.Literals([
  "Registered",
  "Confirmed",
  "Aborted",
  "Unknown",
]);
export type ErasureAttemptExternalState =
  typeof ErasureAttemptExternalState.Type;

/**
 * Explicit product default from the freeze: restore-after-erasure stays closed
 * until a qualified controller + copy catalog exist.
 */
export const ErasureRestoreAfterErasure = Schema.Literal(false).annotate(exact);

/**
 * Opaque S3 version identity for purge (ER-R05).
 * Distinct cases: explicit non-null id, literal string "null", and delete markers.
 * Never normalize literal "null" away — EvidenceObjectStore.remove collapses it.
 */
export const ErasureObjectVersionId = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(1024)
);
export type ErasureObjectVersionId = typeof ErasureObjectVersionId.Type;

/** One ListObjectVersions entry under a World prefix. */
export const ErasureVersionEntry = Schema.Struct({
  deleteMarker: Schema.Boolean,
  isLatest: Schema.Boolean,
  key: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(1024)),
  versionId: ErasureObjectVersionId,
}).annotate(exact);
export type ErasureVersionEntry = typeof ErasureVersionEntry.Type;

/** Durable inventory page / full manifest of versions+markers. */
export const ErasureVersionManifest = Schema.Struct({
  entries: Schema.Array(ErasureVersionEntry),
  prefix: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(1024)),
}).annotate(exact);
export type ErasureVersionManifest = typeof ErasureVersionManifest.Type;

/** Hold/retention observation before a version delete (fail-closed). */
export const ErasureObjectHoldState = Schema.Literals([
  "Clear",
  "Retention",
  "LegalHold",
  "Unknown",
]);
export type ErasureObjectHoldState = typeof ErasureObjectHoldState.Type;

/** Per-version purge outcome — never fabricate success. */
export const ErasureVersionPurgeOutcome = Schema.Literals([
  "Removed",
  "AlreadyAbsent",
  "Blocked",
  "Unknown",
]);
export type ErasureVersionPurgeOutcome = typeof ErasureVersionPurgeOutcome.Type;

/**
 * Honest scope for local Erased: controlled SQL + object versions under the
 * World prefix only. Not backups, controller, or forensic media destruction.
 */
export const ErasureAttestationScope = Schema.Literal(
  "local-controlled-copies"
).annotate(exact);
export type ErasureAttestationScope = typeof ErasureAttestationScope.Type;
