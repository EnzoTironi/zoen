import { describe, expect, it } from "@effect/vitest";
import {
  HostedRetainedAdmissionFlags,
  hostedRetainedAdmissionFlags,
  hostedDisabledCapabilityIds,
} from "@zoen/contracts/hosted/admission/values";
import { Effect, Exit, Result, Schema } from "effect";

import {
  admittedSurfaces,
  assertOnlyCoreSurfacesAdmitted,
  disabledCapabilities,
  evaluateChannelReadiness,
  readinessFor,
  reportsFalseHealthy,
  requireAdmittedCapability,
  requireChannelReadiness,
} from "../../../src/hosted/admission/flags.js";

const tamperedWhatsAppAdmitted = {
  ...hostedRetainedAdmissionFlags,
  capabilities: hostedRetainedAdmissionFlags.capabilities.map((entry) =>
    entry.capabilityId === "whatsapp"
      ? { ...entry, state: "admitted" as const }
      : entry
  ),
};

describe("EX38 hosted retained admission flags", () => {
  it("round-trips the frozen d04 admission matrix", () => {
    const decoded = Schema.decodeSync(HostedRetainedAdmissionFlags)(
      hostedRetainedAdmissionFlags
    );
    expect(decoded).toStrictEqual(hostedRetainedAdmissionFlags);
    expect(decoded.profileId).toBe("worlds-hosted-retained-v1");
    expect(decoded.schemaVersion).toBe("hosted.v1");
  });

  it("admits only web/cli/file surfaces; disables the rest", () => {
    expect(admittedSurfaces()).toStrictEqual(["web", "cli", "file"]);
    expect(assertOnlyCoreSurfacesAdmitted()).toBeTruthy();
    expect(disabledCapabilities()).toStrictEqual([
      ...hostedDisabledCapabilityIds,
    ]);
  });

  it("surface readiness is ready without claiming healthy", () => {
    for (const surface of ["web", "cli", "file"] as const) {
      const readiness = readinessFor(hostedRetainedAdmissionFlags, surface);
      expect(readiness).toStrictEqual({
        admitted: true,
        capabilityId: surface,
        status: "ready",
      });
      expect(reportsFalseHealthy(readiness)).toBeFalsy();
    }
  });

  it("disabled capabilities report Blocked-style disabled, never healthy", () => {
    for (const capabilityId of hostedDisabledCapabilityIds) {
      const readiness = readinessFor(
        hostedRetainedAdmissionFlags,
        capabilityId
      );
      expect(readiness).toMatchObject({
        admitted: false,
        blocked: true,
        capabilityId,
        reason: "not-admitted-in-profile",
        status: "disabled",
      });
      expect(reportsFalseHealthy(readiness)).toBeFalsy();
    }
  });

  it("rejects matrices that admit WhatsApp or drop a core surface", () => {
    expect(
      Result.isFailure(
        Schema.decodeResult(HostedRetainedAdmissionFlags)(
          tamperedWhatsAppAdmitted
        )
      )
    ).toBeTruthy();

    const withoutWeb = {
      ...hostedRetainedAdmissionFlags,
      capabilities: hostedRetainedAdmissionFlags.capabilities.map((entry) =>
        entry.capabilityId === "web"
          ? { ...entry, state: "disabled" as const }
          : entry
      ),
    };
    expect(
      Result.isFailure(
        Schema.decodeResult(HostedRetainedAdmissionFlags)(withoutWeb)
      )
    ).toBeTruthy();
  });

  it("rejects foreign profile ids and healthy-shaped extras", () => {
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(HostedRetainedAdmissionFlags)({
          ...hostedRetainedAdmissionFlags,
          profileId: "worlds-local-retained-v1",
        })
      )
    ).toBeTruthy();
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(HostedRetainedAdmissionFlags)({
          ...hostedRetainedAdmissionFlags,
          healthy: true,
        })
      )
    ).toBeTruthy();
  });

  it.effect(
    "requireAdmittedCapability allows surfaces and Blocks disabled",
    () =>
      Effect.gen(function* enforcement() {
        const web = yield* requireAdmittedCapability("web");
        expect(web.status).toBe("ready");

        const blockedWhatsApp = yield* Effect.exit(
          requireAdmittedCapability("whatsapp")
        );
        expect(Exit.isFailure(blockedWhatsApp)).toBeTruthy();

        const blockedGpu = yield* Effect.exit(requireAdmittedCapability("gpu"));
        expect(Exit.isFailure(blockedGpu)).toBeTruthy();

        const blockedOauth = yield* Effect.exit(
          requireAdmittedCapability("oauth")
        );
        expect(Exit.isFailure(blockedOauth)).toBeTruthy();
      })
  );

  it("absent provider does not pass channel readiness", () => {
    const defaultFlags = evaluateChannelReadiness({
      channelId: "whatsapp",
      flags: hostedRetainedAdmissionFlags,
      providerProvisioned: false,
    });
    expect(defaultFlags).toMatchObject({
      blocked: true,
      reason: "not-admitted-in-profile",
      status: "disabled",
    });
    expect(reportsFalseHealthy(defaultFlags)).toBeFalsy();

    const tamperedMissingProvider = evaluateChannelReadiness({
      channelId: "whatsapp",
      flags: tamperedWhatsAppAdmitted,
      providerProvisioned: false,
    });
    expect(tamperedMissingProvider).toStrictEqual({
      admitted: false,
      blocked: true,
      capabilityId: "whatsapp",
      reason: "provider-not-provisioned",
      status: "disabled",
    });
  });

  it("provisioned but unqualified channel still fails closed", () => {
    const readiness = evaluateChannelReadiness({
      channelId: "whatsapp",
      flags: tamperedWhatsAppAdmitted,
      providerProvisioned: true,
    });
    expect(readiness).toStrictEqual({
      admitted: false,
      blocked: true,
      capabilityId: "whatsapp",
      reason: "channel-not-qualified",
      status: "disabled",
    });
    expect(reportsFalseHealthy(readiness)).toBeFalsy();
  });

  it.effect(
    "requireChannelReadiness Blocks WhatsApp regardless of provider",
    () =>
      Effect.gen(function* channelBlocked() {
        const missing = yield* Effect.exit(
          requireChannelReadiness({
            channelId: "whatsapp",
            providerProvisioned: false,
          })
        );
        expect(Exit.isFailure(missing)).toBeTruthy();
        const present = yield* Effect.exit(
          requireChannelReadiness({
            channelId: "whatsapp",
            providerProvisioned: true,
          })
        );
        expect(Exit.isFailure(present)).toBeTruthy();
        const telegram = yield* Effect.exit(
          requireChannelReadiness({
            channelId: "telegram",
            providerProvisioned: true,
          })
        );
        expect(Exit.isFailure(telegram)).toBeTruthy();
      })
  );
});
