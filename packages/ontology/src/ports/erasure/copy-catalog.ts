import { Unavailable } from "@zoen/contracts/worlds/errors";
import type { Conflict } from "@zoen/contracts/worlds/errors";
import { Digest, exact } from "@zoen/contracts/worlds/values";
import type { WorldRef } from "@zoen/contracts/worlds/values";
import { Context, Effect, Layer, Schema } from "effect";
import type { Effect as EffectType } from "effect";

/**
 * Controlled-copy catalog (ZA-12).
 * Registers creation/publication of backups and derived copies before they are
 * eligible for restore. Unknown coverage blocks Full Erased / restore admission.
 * Distinct from ErasureObjectInventory (object versions under a World prefix).
 */

/** Backing systems admitted into a bounded profile inventory. */
export const ControlledCopyBackingSystem = Schema.Literals([
  "sql-logical-dump",
  "object-version-set",
  "host-volume-snapshot",
  "temporary-output",
  "governed-log",
  "third-party-export",
]);
export type ControlledCopyBackingSystem =
  typeof ControlledCopyBackingSystem.Type;

/**
 * Disposition of one controlled copy at a catalog cut.
 * Unaccounted / Unknown are not empty-success stand-ins.
 */
export const ControlledCopyDisposition = Schema.Literals([
  "Erased",
  "RetainedUnderHold",
  "SuppressedOnRestore",
  "QuarantinedUnpublishable",
  "AccountedActive",
  "Unaccounted",
  "Unknown",
]);
export type ControlledCopyDisposition = typeof ControlledCopyDisposition.Type;

/**
 * Bounded profile coverage. Unknown (incl. G-OPS unread) fail-closes Full
 * Erased / restore admission. BoundedComplete is a cut-time proof, not eternal.
 */
export const ControlledCopyCoverageStatus = Schema.Literals([
  "BoundedComplete",
  "Incomplete",
  "Unknown",
]);
export type ControlledCopyCoverageStatus =
  typeof ControlledCopyCoverageStatus.Type;

export const ControlledCopyAdmissionPurpose = Schema.Literals([
  "full-erased",
  "restore",
]);
export type ControlledCopyAdmissionPurpose =
  typeof ControlledCopyAdmissionPurpose.Type;

export const ControlledCopyId = Schema.String.check(Schema.isUUID());
export type ControlledCopyId = typeof ControlledCopyId.Type;

/** Live World scope for catalog rows — UUID string, not branded LiveWorldRef. */
export const ControlledCopyWorldScope = Schema.Struct({
  realm: Schema.Literal("live"),
  worldId: Schema.String.check(Schema.isUUID()),
}).annotate(exact);
export type ControlledCopyWorldScope = typeof ControlledCopyWorldScope.Type;

export const ControlledCopyRecord = Schema.Struct({
  backingSystem: ControlledCopyBackingSystem,
  copyId: ControlledCopyId,
  disposition: ControlledCopyDisposition,
  generationId: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(256)
  ),
  /** Opaque operator/inspection evidence identity — not a download grant. */
  inspectionEvidence: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(512)
  ),
  integrityDigest: Digest,
  ownerPrincipalId: Schema.NullOr(Schema.String.check(Schema.isUUID())),
  /** Null until publish; unpublished copies are not restore-eligible. */
  publishedAt: Schema.NullOr(Schema.String),
  registeredAt: Schema.String,
  rightsRetention: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(128)
  ),
  scopeKind: Schema.Literals(["world", "installation", "host"]),
  worldRef: Schema.NullOr(ControlledCopyWorldScope),
}).annotate(exact);
export type ControlledCopyRecord = typeof ControlledCopyRecord.Type;

export const ControlledCopyRegistration = Schema.Struct({
  backingSystem: ControlledCopyBackingSystem,
  copyId: ControlledCopyId,
  generationId: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(256)
  ),
  inspectionEvidence: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(512)
  ),
  integrityDigest: Digest,
  ownerPrincipalId: Schema.NullOr(Schema.String.check(Schema.isUUID())),
  profileId: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(128)
  ),
  rightsRetention: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(128)
  ),
  scopeKind: Schema.Literals(["world", "installation", "host"]),
  worldRef: Schema.NullOr(ControlledCopyWorldScope),
}).annotate(exact);
export type ControlledCopyRegistration = typeof ControlledCopyRegistration.Type;

export const ControlledCopyCoverage = Schema.Struct({
  cutAt: Schema.String,
  evidenceRef: Schema.NullOr(
    Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(512))
  ),
  profileId: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(128)
  ),
  status: ControlledCopyCoverageStatus,
}).annotate(exact);
export type ControlledCopyCoverage = typeof ControlledCopyCoverage.Type;

export const ControlledCopyCatalogCut = Schema.Struct({
  copies: Schema.Array(ControlledCopyRecord),
  coverage: ControlledCopyCoverage,
}).annotate(exact);
export type ControlledCopyCatalogCut = typeof ControlledCopyCatalogCut.Type;

const failUnavailable = () =>
  Effect.fail(new Unavailable({ code: "UNAVAILABLE" }));

export class ErasureCopyCatalog extends Context.Service<
  ErasureCopyCatalog,
  {
    /**
     * Register a controlled copy before publication. Same copyId+payload
     * replays; conflicting payload Conflicts. Does not make restore-eligible.
     */
    readonly register: (
      registration: ControlledCopyRegistration
    ) => EffectType.Effect<ControlledCopyRecord, Conflict | Unavailable>;
    /**
     * Publish a registered copy (eligible for backup/restore ops).
     * Derives World Closing + registration order from durable DB state — never
     * from caller assertions. Fail-closed when Closing raced registration —
     * use quarantineUnpublishable instead.
     */
    readonly publish: (
      copyId: ControlledCopyId
    ) => EffectType.Effect<ControlledCopyRecord, Conflict | Unavailable>;
    /**
     * Mark an unpublished copy as quarantined/unpublishable (ZA-12-03 race).
     * Never becomes restore-eligible.
     */
    readonly quarantineUnpublishable: (
      copyId: ControlledCopyId,
      inspectionEvidence: string
    ) => EffectType.Effect<ControlledCopyRecord, Conflict | Unavailable>;
    /** Record disposition with inspection evidence. */
    readonly recordDisposition: (
      copyId: ControlledCopyId,
      disposition: ControlledCopyDisposition,
      inspectionEvidence: string
    ) => EffectType.Effect<ControlledCopyRecord, Conflict | Unavailable>;
    /** Current catalog cut for a profile (optionally scoped to one World). */
    readonly inspectCut: (
      profileId: string,
      worldRef?: WorldRef
    ) => EffectType.Effect<ControlledCopyCatalogCut, Unavailable>;
    /**
     * Set bounded coverage status for a profile. Hosted/G-OPS remains Unknown
     * until operator read-only verification supplies evidenceRef.
     */
    readonly setCoverage: (
      profileId: string,
      status: ControlledCopyCoverageStatus,
      evidenceRef: string | null
    ) => EffectType.Effect<ControlledCopyCoverage, Conflict | Unavailable>;
    /**
     * Fail-closed admission for Full Erased / restore. Unknown or Incomplete
     * coverage → Unavailable (never assume empty success).
     */
    readonly requireAdmission: (
      profileId: string,
      purpose: ControlledCopyAdmissionPurpose
    ) => EffectType.Effect<ControlledCopyCoverage, Unavailable>;
  }
>()("zoen/ontology/ports/erasure/CopyCatalog") {
  /** Unqualified until a profile adapter is composed. */
  static readonly unqualifiedLayer = Layer.succeed(
    ErasureCopyCatalog,
    ErasureCopyCatalog.of({
      inspectCut: () => failUnavailable(),
      publish: () => failUnavailable(),
      quarantineUnpublishable: () => failUnavailable(),
      recordDisposition: () => failUnavailable(),
      register: () => failUnavailable(),
      requireAdmission: () => failUnavailable(),
      setCoverage: () => failUnavailable(),
    })
  );
}
