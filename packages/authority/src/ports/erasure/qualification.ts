/**
 * ZA-11 independent erasure-controller qualification (H-01 / G-OPS).
 *
 * H-01 is not approved: no paid/hosted independent failure-domain footprint.
 * G-OPS is not qualified for hosted inventory. Full erasure/restoreAfterErasure
 * therefore stay fail-closed. The admitted local narrow profile proves only
 * declared two-store rollback separation (separate PG containers/volumes +
 * file anchor), never whole-host or Fly all-in-one independence.
 */

export type ErasureControllerProfileId =
  | "erasure-controller-unqualified"
  | "erasure-controller-local-narrow-v1";

export interface ErasureControllerQualification {
  readonly profileId: ErasureControllerProfileId;
  /**
   * Hosted / full independent topology (H-01). Always false until Enzo approves
   * a concrete footprint and G-OPS rebinds live inventory.
   */
  readonly hostedIndependentQualified: false;
  /** Local two-container + external file-anchor experiment admitted. */
  readonly localNarrowRollbackSeparation: boolean;
  /** Product restoreAfterErasure remains closed (freeze F04). */
  readonly restoreAfterErasure: false;
  readonly h01Approved: false;
  readonly gOpsQualified: false;
}

/** Default until H-01/G-OPS qualify a real topology — never invent approval. */
export const unqualifiedControllerQualification =
  (): ErasureControllerQualification => ({
    gOpsQualified: false,
    h01Approved: false,
    hostedIndependentQualified: false,
    localNarrowRollbackSeparation: false,
    profileId: "erasure-controller-unqualified",
    restoreAfterErasure: false,
  });

/**
 * Local narrow profile: separately administered controller store + monotone
 * external file anchor. Claims only the declared rollback boundary.
 */
export const localNarrowControllerQualification =
  (): ErasureControllerQualification => ({
    gOpsQualified: false,
    h01Approved: false,
    hostedIndependentQualified: false,
    localNarrowRollbackSeparation: true,
    profileId: "erasure-controller-local-narrow-v1",
    restoreAfterErasure: false,
  });

/** Full/hosted activation stays closed until human + ops gates clear. */
export const isFullIndependentControllerAdmitted = (
  qualification: ErasureControllerQualification
): boolean =>
  qualification.h01Approved &&
  qualification.gOpsQualified &&
  qualification.hostedIndependentQualified;
