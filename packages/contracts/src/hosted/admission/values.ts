import { Schema } from "effect";

import { exact } from "../../worlds/values.js";
import {
  HostedRetainedPolicyProfileId,
  HostedSchemaVersion,
} from "../policy/values.js";

/**
 * Worlds core surfaces admitted on worlds-hosted-retained-v1 (freeze H06).
 * Acceptance emphasizes web/file; CLI remains the third Worlds surface.
 */
export const HostedAdmittedSurfaceId = Schema.Literals(["web", "cli", "file"]);
export type HostedAdmittedSurfaceId = typeof HostedAdmittedSurfaceId.Type;

/**
 * Channels / providers / compute not admitted in this increment (ZN-0288 / H06).
 * Stay explicitly disabled — never mock-healthy.
 */
export const HostedDisabledCapabilityId = Schema.Literals([
  "whatsapp",
  "telegram",
  "oauth",
  "model",
  "feed",
  "gpu",
  "broker",
  "custodian",
]);
export type HostedDisabledCapabilityId = typeof HostedDisabledCapabilityId.Type;

export const HostedCapabilityId = Schema.Union([
  HostedAdmittedSurfaceId,
  HostedDisabledCapabilityId,
]);
export type HostedCapabilityId = typeof HostedCapabilityId.Type;

export const HostedCapabilityKind = Schema.Literals([
  "surface",
  "channel",
  "provider",
  "compute",
  "connector",
]);
export type HostedCapabilityKind = typeof HostedCapabilityKind.Type;

/** Flag wire state — no "healthy" literal exists on purpose (ZN-0288). */
export const HostedAdmissionState = Schema.Literals(["admitted", "disabled"]);
export type HostedAdmissionState = typeof HostedAdmissionState.Type;

export const HostedDisabledReason = Schema.Literals([
  "not-admitted-in-profile",
  "provider-not-provisioned",
  "channel-not-qualified",
]);
export type HostedDisabledReason = typeof HostedDisabledReason.Type;

export const HostedCapabilityAdmission = Schema.Struct({
  capabilityId: HostedCapabilityId,
  kind: HostedCapabilityKind,
  state: HostedAdmissionState,
}).annotate(exact);
export type HostedCapabilityAdmission = typeof HostedCapabilityAdmission.Type;

const ADMITTED_SURFACES: readonly HostedAdmittedSurfaceId[] = [
  "web",
  "cli",
  "file",
];

const DISABLED_CAPABILITIES: readonly HostedDisabledCapabilityId[] = [
  "whatsapp",
  "telegram",
  "oauth",
  "model",
  "feed",
  "gpu",
  "broker",
  "custodian",
];

const KIND_BY_ID: Record<HostedCapabilityId, HostedCapabilityKind> = {
  broker: "connector",
  cli: "surface",
  custodian: "connector",
  feed: "connector",
  file: "surface",
  gpu: "compute",
  model: "provider",
  oauth: "provider",
  telegram: "channel",
  web: "surface",
  whatsapp: "channel",
};

const expectedCapabilityCount =
  ADMITTED_SURFACES.length + DISABLED_CAPABILITIES.length;

/**
 * Hosted retained admission matrix (H06 / ZN-0288): exactly the declared
 * surfaces admitted; every other known capability disabled; no healthy mocks.
 */
export const HostedRetainedAdmissionFlags = Schema.Struct({
  capabilities: Schema.Array(HostedCapabilityAdmission).check(
    Schema.isMinLength(expectedCapabilityCount),
    Schema.isMaxLength(expectedCapabilityCount),
    Schema.makeFilter((capabilities) => {
      const ids = capabilities.map((entry) => entry.capabilityId);
      if (new Set(ids).size !== ids.length) {
        return false;
      }
      for (const surface of ADMITTED_SURFACES) {
        const entry = capabilities.find(
          (candidate) => candidate.capabilityId === surface
        );
        if (
          entry === undefined ||
          entry.state !== "admitted" ||
          entry.kind !== "surface"
        ) {
          return false;
        }
      }
      for (const capabilityId of DISABLED_CAPABILITIES) {
        const entry = capabilities.find(
          (candidate) => candidate.capabilityId === capabilityId
        );
        if (
          entry === undefined ||
          entry.state !== "disabled" ||
          entry.kind !== KIND_BY_ID[capabilityId]
        ) {
          return false;
        }
      }
      return true;
    })
  ),
  profileId: HostedRetainedPolicyProfileId,
  schemaVersion: HostedSchemaVersion,
}).annotate(exact);
export type HostedRetainedAdmissionFlags =
  typeof HostedRetainedAdmissionFlags.Type;

/** Frozen default flags for worlds-hosted-retained-v1 Worlds. */
export const hostedRetainedAdmissionFlags: HostedRetainedAdmissionFlags = {
  capabilities: [
    ...ADMITTED_SURFACES.map((capabilityId): HostedCapabilityAdmission => ({
      capabilityId,
      kind: "surface",
      state: "admitted",
    })),
    ...DISABLED_CAPABILITIES.map((capabilityId): HostedCapabilityAdmission => ({
      capabilityId,
      kind: KIND_BY_ID[capabilityId],
      state: "disabled",
    })),
  ],
  profileId: "worlds-hosted-retained-v1",
  schemaVersion: "hosted.v1",
};

export const HostedChannelId = Schema.Literals(["whatsapp", "telegram"]);
export type HostedChannelId = typeof HostedChannelId.Type;

export {
  ADMITTED_SURFACES as hostedAdmittedSurfaceIds,
  DISABLED_CAPABILITIES as hostedDisabledCapabilityIds,
  KIND_BY_ID as hostedCapabilityKindById,
};
