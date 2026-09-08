import { Schema } from "effect";

import { exact } from "../../worlds/values.js";
import {
  HostedErasablePolicyProfileId,
  HostedSchemaVersion,
} from "../policy/values.js";

/** Gate status for hosted erasable qualification (ZA-14). */
export const HostedErasableGateStatus = Schema.Literals([
  "Blocked",
  "Unknown",
  "Qualified",
]);
export type HostedErasableGateStatus = typeof HostedErasableGateStatus.Type;

/**
 * Exact hosted install identity eligible for erasable binding (H-02).
 * Legacy app `zoen` and retained bucket reuse by name are never valid here.
 */
export const HostedErasableTarget = Schema.Struct({
  appName: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(128)),
  bucketName: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(128)
  ),
  imageDigest: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(128)
  ),
  installId: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(128)
  ),
  profileId: HostedErasablePolicyProfileId,
  volumeName: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(128)
  ),
}).annotate(exact);
export type HostedErasableTarget = typeof HostedErasableTarget.Type;

/**
 * Honest product posture for full hosted Erased.
 * Literal productAccepted false until every work/qualification gate clears.
 */
export const HostedErasableQualification = Schema.Struct({
  authorizedTarget: Schema.NullOr(HostedErasableTarget),
  fullHostedErased: Schema.Literal(false),
  gOps: HostedErasableGateStatus,
  gStorageFence: HostedErasableGateStatus,
  h01: HostedErasableGateStatus,
  h02: HostedErasableGateStatus,
  /**
   * Local exact-image disposable proof may be admitted without flipping
   * productAccepted / fullHostedErased. Never substitutes for remote hosted.
   */
  localExactImageProofAdmitted: Schema.Boolean,
  productAccepted: Schema.Literal(false),
  profileId: HostedErasablePolicyProfileId,
  restoreAfterErasure: Schema.Literal(false),
  schemaVersion: HostedSchemaVersion,
}).annotate(exact);
export type HostedErasableQualification =
  typeof HostedErasableQualification.Type;

/** Why a candidate target was refused before purge/rebind/deletion. */
export const HostedErasableRefusalReason = Schema.Literals([
  "legacy-app-zoen",
  "retained-bucket-name-reuse",
  "retained-install-profile",
  "target-not-authorized",
  "gates-incomplete",
  "controller-unavailable",
  "held-object",
  "incomplete-catalog",
]);
export type HostedErasableRefusalReason =
  typeof HostedErasableRefusalReason.Type;
