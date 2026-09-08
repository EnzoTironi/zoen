/**
 * ZA-14: before hosted erasable Closing/purge, require admitted target binding.
 * Retained neighbors and legacy resources stay refused. Full hosted Erased
 * remains unavailable while qualification gates are Blocked/Unknown.
 *
 * Uses serviceOption so local erasable installs do not require the hosted
 * admission service in their Effect environment.
 */
import { Blocked } from "@zoen/contracts/worlds/errors";
import { Effect, Option } from "effect";

import {
  HostedErasableAdmission,
  gatesAdmitFullHostedErased,
} from "../../hosted/erasable/admission.js";
import type {
  HostedErasableAdmissionPurpose,
  HostedErasableCandidate,
} from "../../hosted/erasable/admission.js";
import { ErasureCopyCatalog } from "../../ports/erasure/copy-catalog.js";
import type { DataPolicySchema } from "../../ports/worlds/context.js";
import { isHostedErasablePolicy } from "./policy.js";

export const requireHostedErasableAdmissionForPolicy = Effect.fn(
  "erasure.requireHostedErasableAdmissionForPolicy"
)(function* requireHostedErasableAdmissionForPolicy(input: {
  readonly catalogCoverage: "BoundedComplete" | "Incomplete" | "Unknown";
  readonly controllerAvailable: boolean;
  readonly heldObject: boolean;
  readonly candidate: HostedErasableCandidate;
  readonly policy: DataPolicySchema;
  readonly purpose: HostedErasableAdmissionPurpose;
}) {
  if (!isHostedErasablePolicy(input.policy)) {
    return { mode: "local-erasable" as const };
  }
  const maybe = yield* Effect.serviceOption(HostedErasableAdmission);
  if (Option.isNone(maybe)) {
    return yield* new Blocked({ code: "PROFILE_BLOCKED" });
  }
  const admission = maybe.value;
  const qualification = yield* admission.qualification;
  if (gatesAdmitFullHostedErased(qualification)) {
    return yield* new Blocked({ code: "PROFILE_BLOCKED" });
  }
  return yield* admission.requireAdmitted({
    candidate: input.candidate,
    catalogCoverage: input.catalogCoverage,
    controllerAvailable: input.controllerAvailable,
    heldObject: input.heldObject,
    purpose: input.purpose,
  });
});

export const reportFullHostedErasedUnavailable = Effect.fn(
  "erasure.reportFullHostedErasedUnavailable"
)(function* reportFullHostedErasedUnavailable() {
  const maybe = yield* Effect.serviceOption(HostedErasableAdmission);
  if (Option.isNone(maybe)) {
    return {
      fullHostedErased: false as const,
      gOps: "Unknown" as const,
      gStorageFence: "Blocked" as const,
      h01: "Blocked" as const,
      h02: "Blocked" as const,
      productAccepted: false as const,
      status: "Blocked" as const,
    };
  }
  const qualification = yield* maybe.value.qualification;
  return {
    fullHostedErased: false as const,
    gOps: qualification.gOps,
    gStorageFence: qualification.gStorageFence,
    h01: qualification.h01,
    h02: qualification.h02,
    productAccepted: false as const,
    status: "Blocked" as const,
  };
});

export const candidateFromAdmission = Effect.fn(
  "erasure.candidateFromAdmission"
)(function* candidateFromAdmission(policyProfileId: string) {
  const maybe = yield* Effect.serviceOption(HostedErasableAdmission);
  if (Option.isNone(maybe)) {
    return yield* new Blocked({ code: "PROFILE_BLOCKED" });
  }
  const qualification = yield* maybe.value.qualification;
  const target = qualification.authorizedTarget;
  if (target === null) {
    return yield* new Blocked({ code: "PROFILE_BLOCKED" });
  }
  return {
    appName: target.appName,
    bucketName: target.bucketName,
    imageDigest: target.imageDigest,
    installId: target.installId,
    policyProfileId,
    volumeName: target.volumeName,
  } satisfies HostedErasableCandidate;
});

export const requireHostedErasablePurgeAdmission = Effect.fn(
  "erasure.requireHostedErasablePurgeAdmission"
)(function* requireHostedErasablePurgeAdmission(input: {
  readonly policy: DataPolicySchema;
}) {
  if (!isHostedErasablePolicy(input.policy)) {
    return { mode: "local-erasable" as const };
  }
  const copyCatalog = yield* ErasureCopyCatalog;
  const coverageAttempt = yield* Effect.result(
    copyCatalog.requireAdmission(input.policy.profileId, "full-erased")
  );
  const catalogCoverage =
    coverageAttempt._tag === "Success"
      ? ("BoundedComplete" as const)
      : ("Unknown" as const);
  const candidate = yield* candidateFromAdmission(input.policy.profileId);
  return yield* requireHostedErasableAdmissionForPolicy({
    candidate,
    catalogCoverage,
    controllerAvailable: true,
    heldObject: false,
    policy: input.policy,
    purpose: "purge",
  });
});
