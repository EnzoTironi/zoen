/**
 * ZA-14 hosted erasable admission (H-01 / H-02 / G-OPS / G-STORAGE-FENCE).
 *
 * Full hosted Erased stays fail-closed. Local exact-image disposable proof may
 * exercise Closing/purge/restore-suppression under an explicitly authorized
 * target without advertising productAccepted or fullHostedErased.
 */
import {
  HostedErasableQualification,
  HostedErasableRefusalReason,
  HostedErasableTarget,
} from "@zoen/contracts/hosted/erasable/values";
import type {
  HostedErasableQualification as HostedErasableQualificationType,
  HostedErasableRefusalReason as HostedErasableRefusalReasonType,
  HostedErasableTarget as HostedErasableTargetType,
} from "@zoen/contracts/hosted/erasable/values";
import { Blocked, Unavailable } from "@zoen/contracts/worlds/errors";
import { Context, Effect, Layer, Schema } from "effect";

export {
  HostedErasableQualification,
  HostedErasableRefusalReason,
  HostedErasableTarget,
} from "@zoen/contracts/hosted/erasable/values";

/** Fly / install names that must never receive erasable rebind. */
export const LEGACY_FLY_APP = "zoen" as const;
/** Retained live bucket name — refuse same-name erasable conversion. */
export const RETAINED_BUCKET_NAME = "zoen" as const;

export const RETAINED_POLICY_PROFILE_IDS = [
  "worlds-hosted-retained-v1",
  "worlds-local-retained-v1",
] as const;

export type RetainedPolicyProfileId =
  (typeof RETAINED_POLICY_PROFILE_IDS)[number];

export interface HostedErasableCandidate {
  readonly appName: string;
  readonly bucketName: string;
  readonly imageDigest: string;
  readonly installId: string;
  readonly policyProfileId: string;
  readonly volumeName: string;
}

export type HostedErasableAdmissionDecision =
  | {
      readonly admitted: true;
      readonly mode: "local-exact-image-proof";
      readonly target: HostedErasableTargetType;
    }
  | {
      readonly admitted: false;
      readonly reason: HostedErasableRefusalReasonType;
      readonly status: "Blocked" | "Unknown";
    };

/** Current product posture — never invent Qualified or productAccepted. */
export const currentHostedErasableQualification =
  (): HostedErasableQualificationType => ({
    authorizedTarget: null,
    fullHostedErased: false,
    gOps: "Unknown",
    gStorageFence: "Blocked",
    h01: "Blocked",
    h02: "Blocked",
    localExactImageProofAdmitted: false,
    productAccepted: false,
    profileId: "worlds-hosted-erasable-v1",
    restoreAfterErasure: false,
    schemaVersion: "hosted.v1",
  });

/**
 * Local exact-image disposable proof qualification. Gates stay Blocked/Unknown
 * for product activation; only the disposable target is bound for the seam.
 */
export const localExactImageProofQualification = (
  target: HostedErasableTargetType
): HostedErasableQualificationType => ({
  ...currentHostedErasableQualification(),
  authorizedTarget: target,
  localExactImageProofAdmitted: true,
});

/**
 * Full hosted Erased requires every gate Qualified AND productAccepted.
 * productAccepted / fullHostedErased stay typed `false` today — always closed.
 */
export const gatesAdmitFullHostedErased = (
  qualification: HostedErasableQualificationType
): boolean => {
  if (
    qualification.h01 !== "Qualified" ||
    qualification.h02 !== "Qualified" ||
    qualification.gOps !== "Qualified" ||
    qualification.gStorageFence !== "Qualified"
  ) {
    return false;
  }
  // Literal productAccepted:false / fullHostedErased:false keep this closed.
  return false;
};

export const isRetainedPolicyProfileId = (
  profileId: string
): profileId is RetainedPolicyProfileId =>
  (RETAINED_POLICY_PROFILE_IDS as readonly string[]).includes(profileId);

/**
 * Refuse before purge/rebind/deletion when the candidate is legacy, retained,
 * or same-name retained bucket reuse.
 */
export type HostedErasableRefusal = Extract<
  HostedErasableAdmissionDecision,
  { readonly admitted: false }
>;

export const refuseProtectedResource = (
  candidate: HostedErasableCandidate
): HostedErasableRefusal | null => {
  if (candidate.appName === LEGACY_FLY_APP) {
    return {
      admitted: false,
      reason: "legacy-app-zoen",
      status: "Blocked",
    };
  }
  if (isRetainedPolicyProfileId(candidate.policyProfileId)) {
    return {
      admitted: false,
      reason: "retained-install-profile",
      status: "Blocked",
    };
  }
  // Never convert the retained live bucket by name into erasable (ticket out of scope).
  if (candidate.bucketName === RETAINED_BUCKET_NAME) {
    return {
      admitted: false,
      reason: "retained-bucket-name-reuse",
      status: "Blocked",
    };
  }
  return null;
};

export type HostedErasableAdmissionPurpose =
  | "closing"
  | "purge"
  | "full-erased";

export const evaluateHostedErasableAdmission = (input: {
  readonly candidate: HostedErasableCandidate;
  readonly catalogCoverage: "BoundedComplete" | "Incomplete" | "Unknown";
  readonly controllerAvailable: boolean;
  readonly heldObject: boolean;
  readonly purpose: HostedErasableAdmissionPurpose;
  readonly qualification: HostedErasableQualificationType;
}): HostedErasableAdmissionDecision => {
  const protectedDecision = refuseProtectedResource(input.candidate);
  if (protectedDecision !== null) {
    return protectedDecision;
  }

  // Purge / Full Erased require controller + catalog + no holds (ZA-14-03).
  if (input.purpose !== "closing") {
    if (input.heldObject) {
      return {
        admitted: false,
        reason: "held-object",
        status: "Blocked",
      };
    }
    if (!input.controllerAvailable) {
      return {
        admitted: false,
        reason: "controller-unavailable",
        status: "Unknown",
      };
    }
    if (
      input.catalogCoverage === "Incomplete" ||
      input.catalogCoverage === "Unknown"
    ) {
      return {
        admitted: false,
        reason: "incomplete-catalog",
        status: input.catalogCoverage === "Unknown" ? "Unknown" : "Blocked",
      };
    }
  }

  // Product Full hosted Erased never clears while gates stay Blocked/Unknown.
  if (input.purpose === "full-erased") {
    return {
      admitted: false,
      reason: "gates-incomplete",
      status: "Blocked",
    };
  }

  const authorized = input.qualification.authorizedTarget;
  const matchesAuthorized =
    authorized !== null &&
    authorized.appName === input.candidate.appName &&
    authorized.bucketName === input.candidate.bucketName &&
    authorized.installId === input.candidate.installId &&
    authorized.volumeName === input.candidate.volumeName &&
    authorized.imageDigest === input.candidate.imageDigest &&
    authorized.profileId === "worlds-hosted-erasable-v1";

  if (
    input.qualification.localExactImageProofAdmitted &&
    matchesAuthorized &&
    input.candidate.policyProfileId === "worlds-hosted-erasable-v1"
  ) {
    return {
      admitted: true,
      mode: "local-exact-image-proof",
      target: authorized,
    };
  }

  if (input.qualification.h02 !== "Qualified" || authorized === null) {
    return {
      admitted: false,
      reason: "target-not-authorized",
      status: "Blocked",
    };
  }

  return {
    admitted: false,
    reason: "gates-incomplete",
    status: "Blocked",
  };
};

export const decodeHostedErasableTarget =
  Schema.decodeEffect(HostedErasableTarget);
export const decodeHostedErasableQualification = Schema.decodeEffect(
  HostedErasableQualification
);

/**
 * Composition service: present when evaluating hosted erasable admission.
 * Default unqualified layer never admits Full hosted Erased.
 */
export class HostedErasableAdmission extends Context.Service<
  HostedErasableAdmission,
  {
    readonly evaluate: (input: {
      readonly candidate: HostedErasableCandidate;
      readonly catalogCoverage: "BoundedComplete" | "Incomplete" | "Unknown";
      readonly controllerAvailable: boolean;
      readonly heldObject: boolean;
      readonly purpose: HostedErasableAdmissionPurpose;
    }) => Effect.Effect<HostedErasableAdmissionDecision>;
    readonly qualification: Effect.Effect<HostedErasableQualificationType>;
    /**
     * Require admitted local-exact-image or (future) full hosted path before
     * destructive hosted erasable work. Fail closed otherwise.
     */
    readonly requireAdmitted: (input: {
      readonly candidate: HostedErasableCandidate;
      readonly catalogCoverage: "BoundedComplete" | "Incomplete" | "Unknown";
      readonly controllerAvailable: boolean;
      readonly heldObject: boolean;
      readonly purpose: HostedErasableAdmissionPurpose;
    }) => Effect.Effect<
      HostedErasableAdmissionDecision & { readonly admitted: true },
      Blocked | Unavailable
    >;
  }
>()("zoen/authority/hosted/erasable/HostedErasableAdmission") {
  static readonly unqualifiedLayer = Layer.succeed(
    HostedErasableAdmission,
    HostedErasableAdmission.of({
      evaluate: (input) =>
        Effect.succeed(
          evaluateHostedErasableAdmission({
            ...input,
            qualification: currentHostedErasableQualification(),
          })
        ),
      qualification: Effect.succeed(currentHostedErasableQualification()),
      requireAdmitted: (input) =>
        Effect.gen(function* require() {
          const decision = evaluateHostedErasableAdmission({
            ...input,
            qualification: currentHostedErasableQualification(),
          });
          if (!decision.admitted) {
            if (decision.status === "Unknown") {
              return yield* new Unavailable({ code: "UNAVAILABLE" });
            }
            return yield* new Blocked({ code: "PROFILE_BLOCKED" });
          }
          return decision;
        }),
    })
  );

  /** Test / local exact-image seam: bind one disposable authorized target. */
  static readonly localExactImageProofLayer = (
    target: HostedErasableTargetType
  ) => {
    const qualification = localExactImageProofQualification(target);
    return Layer.succeed(
      HostedErasableAdmission,
      HostedErasableAdmission.of({
        evaluate: (input) =>
          Effect.succeed(
            evaluateHostedErasableAdmission({
              ...input,
              qualification,
            })
          ),
        qualification: Effect.succeed(qualification),
        requireAdmitted: (input) =>
          Effect.gen(function* require() {
            const decision = evaluateHostedErasableAdmission({
              ...input,
              qualification,
            });
            if (!decision.admitted) {
              if (decision.status === "Unknown") {
                return yield* new Unavailable({ code: "UNAVAILABLE" });
              }
              return yield* new Blocked({ code: "PROFILE_BLOCKED" });
            }
            return decision;
          }),
      })
    );
  };
}

export const decodeRefusalReason = Schema.decodeEffect(
  HostedErasableRefusalReason
);
