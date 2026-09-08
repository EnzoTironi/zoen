import { describe, expect, it } from "@effect/vitest";
import { WorldId } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";

import {
  currentRestoreActivationQualification,
  gatesAdmitRestorePromotion,
} from "../../../src/ports/erasure/restore-activation-laws.js";
import {
  ErasureRestoreActivation,
  memoryRestoreActivationLayer,
} from "../../../src/ports/erasure/restore-activation.js";

const world = {
  realm: "live" as const,
  worldId: Schema.decodeSync(WorldId)("00000000-0000-4000-8000-000000000013"),
};
const revokedPrincipal = "00000000-0000-4000-8000-000000000021";

describe("ZA-13 restore activation port", () => {
  it("unqualified layer never advertises restoreAfterErasure or gate clearance", () => {
    const qualification = currentRestoreActivationQualification();
    expect(gatesAdmitRestorePromotion(qualification)).toBeFalsy();
    expect(qualification.objectLockRestoreAfterErasure).toBe("Unknown");
  });

  it.effect(
    "restored install starts quarantined with a fresh writer identity",
    () =>
      Effect.gen(function* quarantine() {
        const activation = yield* ErasureRestoreActivation;
        const started = yield* activation.beginQuarantinedRestore({
          backupGenerationId: "00000000-0000-4000-8000-000000000099",
        });
        expect(started.phase).toBe("Quarantined");
        expect(started.deploymentWriterId.length).toBeGreaterThan(0);
        const again = yield* activation.beginQuarantinedRestore({
          backupGenerationId: "00000000-0000-4000-8000-000000000099",
        });
        expect(again.deploymentWriterId).not.toBe(started.deploymentWriterId);
      }).pipe(Effect.provide(memoryRestoreActivationLayer()))
  );

  it.effect(
    "ZA-13-02: credential promotion and content serving stay closed",
    () =>
      Effect.gen(function* closed() {
        const activation = yield* ErasureRestoreActivation;
        const started = yield* activation.beginQuarantinedRestore({
          backupGenerationId: null,
        });
        yield* activation.enterPreparing(started.preparationId);
        const content = yield* Effect.exit(activation.requireContentServing);
        const credentials = yield* Effect.exit(
          activation.requireCredentialPromotion
        );
        expect(content._tag).toBe("Failure");
        expect(credentials._tag).toBe("Failure");
        const promotion = yield* Effect.exit(
          activation.requirePromotion(started.preparationId, {
            catalogCoverage: "BoundedComplete",
            controllerSuppression: { state: "Clear" },
            erasureRace: {
              kind: "erasure-admitted-before-drain",
              suppression: { state: "Clear" },
            },
            principalRights: "active",
            writersSettled: true,
          })
        );
        expect(promotion._tag).toBe("Failure");
        expect((yield* activation.observe).phase).toBe("PromotionBlocked");
      }).pipe(Effect.provide(memoryRestoreActivationLayer()))
  );

  it.effect("ZA-13-01: revoked principal rights deny access observation", () =>
    Effect.gen(function* revoked() {
      const activation = yield* ErasureRestoreActivation;
      const rights = yield* activation.observeCurrentRights(
        world,
        revokedPrincipal
      );
      expect(rights).toBe("revoked");
    }).pipe(
      Effect.provide(
        memoryRestoreActivationLayer({
          rights: new Map([
            [`live:${world.worldId}:${revokedPrincipal}`, "revoked"],
          ]),
        })
      )
    )
  );
});
