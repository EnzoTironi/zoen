/**
 * ZA-14: before hosted erasable Closing/purge, require admitted target binding.
 * Retained neighbors and legacy resources stay refused. Full hosted Erased
 * remains unavailable while qualification gates are Blocked/Unknown.
 *
 * Candidate identity is observed independently (runtime install + release
 * digest), never copied from the authorization record under test.
 *
 * Uses serviceOption so local erasable installs do not require the hosted
 * admission service in their Effect environment.
 */
import { Blocked } from "@zoen/contracts/worlds/errors";
import type { WorldRef } from "@zoen/contracts/worlds/values";
import { Effect, Option } from "effect";

import { AuthorityInstallation } from "../../commit/configuration.js";
import {
  HostedErasableAdmission,
  gatesAdmitFullHostedErased,
} from "../../hosted/erasable/admission.js";
import type {
  HostedErasableAdmissionPurpose,
  HostedErasableCandidate,
} from "../../hosted/erasable/admission.js";
import { HostedErasableObservedIdentity } from "../../hosted/erasable/observed-identity.js";
import { ErasureCopyCatalog } from "../../ports/erasure/copy-catalog.js";
import { ErasureObjectInventory } from "../../ports/erasure/inventory.js";
import { ErasurePurgeStore } from "../../ports/erasure/purge.js";
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

/**
 * Build a candidate from independently observed runtime identity.
 * imageDigest always comes from AuthorityInstallation.releaseDigest — never
 * from the authorizedTarget being verified.
 */
export const candidateFromObservedRuntime = Effect.fn(
  "erasure.candidateFromObservedRuntime"
)(function* candidateFromObservedRuntime(policyProfileId: string) {
  const installation = yield* AuthorityInstallation;
  const maybe = yield* Effect.serviceOption(HostedErasableObservedIdentity);
  if (Option.isNone(maybe)) {
    return yield* new Blocked({ code: "PROFILE_BLOCKED" });
  }
  const fields = yield* maybe.value.observe;
  if (fields === null) {
    return yield* new Blocked({ code: "PROFILE_BLOCKED" });
  }
  return {
    appName: fields.appName,
    bucketName: fields.bucketName,
    imageDigest: installation.releaseDigest,
    installId: fields.installId,
    policyProfileId,
    volumeName: fields.volumeName,
  } satisfies HostedErasableCandidate;
});

/** @deprecated Prefer candidateFromObservedRuntime — kept name alias for clarity. */
export const candidateFromAdmission = candidateFromObservedRuntime;

/**
 * Observe whether any object version under the World is held/unknown.
 * Inventory or hold-inspection failure → Unavailable (fail closed).
 */
export const observeWorldHeldObject = Effect.fn(
  "erasure.observeWorldHeldObject"
)(function* observeWorldHeldObject(worldRef: WorldRef) {
  const inventory = yield* ErasureObjectInventory;
  const purgeStore = yield* ErasurePurgeStore;
  const manifest = yield* inventory.listWorldVersions(worldRef);
  for (const entry of manifest.entries) {
    const hold = yield* purgeStore.inspectHold({
      deleteMarker: entry.deleteMarker,
      key: entry.key,
      versionId: entry.versionId,
    });
    if (hold !== "Clear") {
      return true;
    }
  }
  return false;
});

export const requireHostedErasablePurgeAdmission = Effect.fn(
  "erasure.requireHostedErasablePurgeAdmission"
)(function* requireHostedErasablePurgeAdmission(input: {
  readonly policy: DataPolicySchema;
  readonly worldRef: WorldRef;
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
  const candidate = yield* candidateFromObservedRuntime(input.policy.profileId);

  const holdAttempt = yield* Effect.result(
    observeWorldHeldObject(input.worldRef)
  );
  if (holdAttempt._tag === "Failure") {
    // Cannot observe holds → refuse purge as Unavailable/Unknown posture.
    return yield* requireHostedErasableAdmissionForPolicy({
      candidate,
      catalogCoverage,
      controllerAvailable: false,
      heldObject: false,
      policy: input.policy,
      purpose: "purge",
    });
  }

  return yield* requireHostedErasableAdmissionForPolicy({
    candidate,
    catalogCoverage,
    controllerAvailable: true,
    heldObject: holdAttempt.success,
    policy: input.policy,
    purpose: "purge",
  });
});
