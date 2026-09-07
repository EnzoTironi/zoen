import {
  HostedCapabilityId,
  HostedChannelId,
  HostedRetainedAdmissionFlags,
  hostedRetainedAdmissionFlags,
  hostedAdmittedSurfaceIds,
} from "@zoen/contracts/hosted/admission/values";
import type {
  HostedCapabilityId as HostedCapabilityIdType,
  HostedChannelId as HostedChannelIdType,
  HostedDisabledReason,
  HostedRetainedAdmissionFlags as HostedRetainedAdmissionFlagsType,
} from "@zoen/contracts/hosted/admission/values";
import { Blocked } from "@zoen/contracts/worlds/errors";
import { Context, Effect, Schema } from "effect";

export {
  hostedRetainedAdmissionFlags,
  HostedRetainedAdmissionFlags,
} from "@zoen/contracts/hosted/admission/values";

/**
 * Optional composition service: present when the install DataPolicy is
 * worlds-hosted-retained-v1 (EX39 local hosted-retained bootstrap). Absent on
 * default local retained / erasable installs.
 */
export class HostedAdmissionFlags extends Context.Service<
  HostedAdmissionFlags,
  HostedRetainedAdmissionFlagsType
>()("zoen/authority/hosted/admission/HostedAdmissionFlags") {}

/**
 * Derived readiness — never uses a "healthy" status (ZN-0288).
 * Disabled / missing-provider paths are fail-closed Blocked reports.
 */
export type HostedCapabilityReadiness =
  | {
      readonly admitted: true;
      readonly capabilityId: HostedCapabilityIdType;
      readonly status: "ready";
    }
  | {
      readonly admitted: false;
      readonly blocked: true;
      readonly capabilityId: HostedCapabilityIdType;
      readonly reason: HostedDisabledReason;
      readonly status: "disabled";
    };

export const decodeHostedRetainedAdmissionFlags = Schema.decodeEffect(
  HostedRetainedAdmissionFlags
);

interface AdmissionFlagsView {
  readonly capabilities: readonly {
    readonly capabilityId: HostedCapabilityIdType;
    readonly state: "admitted" | "disabled";
  }[];
}

const lookup = (
  flags: AdmissionFlagsView,
  capabilityId: HostedCapabilityIdType
) => flags.capabilities.find((entry) => entry.capabilityId === capabilityId);

/** True when a readiness payload falsely claims healthy (must stay impossible). */
export const reportsFalseHealthy = (
  readiness: HostedCapabilityReadiness & { readonly healthy?: boolean }
): boolean => readiness.healthy === true;

export const readinessFor = (
  flags: AdmissionFlagsView,
  capabilityId: HostedCapabilityIdType
): HostedCapabilityReadiness => {
  const entry = lookup(flags, capabilityId);
  if (entry === undefined || entry.state !== "admitted") {
    return {
      admitted: false,
      blocked: true,
      capabilityId,
      reason: "not-admitted-in-profile",
      status: "disabled",
    };
  }
  return {
    admitted: true,
    capabilityId,
    status: "ready",
  };
};

/**
 * Channel readiness fails closed when the channel is not admitted OR the
 * provider is not provisioned. Even an admitted+provisioned channel stays
 * unqualified in this increment (no mock-healthy WhatsApp).
 */
export const evaluateChannelReadiness = (input: {
  readonly channelId: HostedChannelIdType;
  readonly flags: AdmissionFlagsView;
  readonly providerProvisioned: boolean;
}): HostedCapabilityReadiness => {
  const entry = lookup(input.flags, input.channelId);
  if (entry === undefined || entry.state !== "admitted") {
    return {
      admitted: false,
      blocked: true,
      capabilityId: input.channelId,
      reason: "not-admitted-in-profile",
      status: "disabled",
    };
  }
  if (!input.providerProvisioned) {
    return {
      admitted: false,
      blocked: true,
      capabilityId: input.channelId,
      reason: "provider-not-provisioned",
      status: "disabled",
    };
  }
  return {
    admitted: false,
    blocked: true,
    capabilityId: input.channelId,
    reason: "channel-not-qualified",
    status: "disabled",
  };
};

/** Surfaces admitted by the hosted retained profile (web/cli/file). */
export const admittedSurfaces = (
  flags: HostedRetainedAdmissionFlagsType = hostedRetainedAdmissionFlags
): readonly HostedCapabilityIdType[] =>
  flags.capabilities
    .filter((entry) => entry.state === "admitted")
    .map((entry) => entry.capabilityId);

export const disabledCapabilities = (
  flags: HostedRetainedAdmissionFlagsType = hostedRetainedAdmissionFlags
): readonly HostedCapabilityIdType[] =>
  flags.capabilities
    .filter((entry) => entry.state === "disabled")
    .map((entry) => entry.capabilityId);

/**
 * Enforce admission: disabled / unknown capabilities fail closed with Blocked.
 * Does not invent a healthy mock for missing providers.
 */
export const requireAdmittedCapability = Effect.fn(
  "hosted.admission.requireAdmittedCapability"
)(function* requireAdmittedCapability(
  capabilityId: HostedCapabilityIdType,
  flags: HostedRetainedAdmissionFlagsType = hostedRetainedAdmissionFlags
) {
  yield* Schema.decodeEffect(HostedCapabilityId)(capabilityId);
  yield* Schema.decodeEffect(HostedRetainedAdmissionFlags)(flags);
  const readiness = readinessFor(flags, capabilityId);
  if (readiness.status !== "ready") {
    return yield* new Blocked({ code: "PROFILE_BLOCKED" });
  }
  return readiness;
});

/**
 * Channel use requires profile admission and a provisioned provider, then still
 * stays unqualified on this increment. Absent provider never passes (ZN-0288).
 */
export const requireChannelReadiness = Effect.fn(
  "hosted.admission.requireChannelReadiness"
)(function* requireChannelReadiness(input: {
  readonly channelId: HostedChannelIdType;
  readonly flags?: HostedRetainedAdmissionFlagsType;
  readonly providerProvisioned: boolean;
}) {
  const channelId = yield* Schema.decodeEffect(HostedChannelId)(
    input.channelId
  );
  const flags = yield* Schema.decodeEffect(HostedRetainedAdmissionFlags)(
    input.flags ?? hostedRetainedAdmissionFlags
  );
  const readiness = evaluateChannelReadiness({
    channelId,
    flags,
    providerProvisioned: input.providerProvisioned,
  });
  if (readiness.status !== "ready") {
    return yield* new Blocked({ code: "PROFILE_BLOCKED" });
  }
  return readiness;
});

/** Core path check: only declared Worlds surfaces are ready on this profile. */
export const assertOnlyCoreSurfacesAdmitted = (
  flags: HostedRetainedAdmissionFlagsType = hostedRetainedAdmissionFlags
): boolean => {
  const admitted = admittedSurfaces(flags);
  if (admitted.length !== hostedAdmittedSurfaceIds.length) {
    return false;
  }
  return hostedAdmittedSurfaceIds.every((surface) =>
    admitted.includes(surface)
  );
};
