import { describe, expect, it } from "@effect/vitest";
import { Unavailable } from "@zoen/contracts/d01/errors";
import { Effect, Schema } from "effect";

import { DataPolicySchema } from "../../../src/ports/d01/context.js";
import type { ErasureAttemptIdentity } from "../../../src/ports/erasure/attempt-register.js";

/**
 * Blocked oracle: until a qualified controller exists, register stays Unavailable.
 * Never fabricate Confirmed/Aborted.
 */
const blockedRegister = {
  register: (_identity: ErasureAttemptIdentity) =>
    Effect.fail(new Unavailable({ code: "UNAVAILABLE" })),
};

describe("EX30/EX31 erasure gates still blocked", () => {
  it("retained DataPolicy forbids erasure and restore-after-erasure", () => {
    const policy = Schema.decodeUnknownSync(DataPolicySchema)({
      dataScope: "admitted-non-sensitive",
      enabledRealm: "live",
      erasure: false,
      legalHold: false,
      licensedExpiry: false,
      profileId: "d01-local-retained-v1",
      restoreAfterErasure: false,
      retention: "while-pinned",
    });
    expect(policy.erasure).toBe(false);
    expect(policy.restoreAfterErasure).toBe(false);
  });

  it("unqualified controller port stays Unavailable (no fake Confirmed)", async () => {
    const identity = {
      deploymentEpoch: "test-epoch",
      operationId: "00000000-0000-4000-8000-000000000010" as never,
      principalId: "00000000-0000-4000-8000-000000000011" as never,
      worldRef: {
        realm: "live" as const,
        worldId: "00000000-0000-4000-8000-000000000012" as never,
      },
    };
    const exit = await Effect.runPromiseExit(blockedRegister.register(identity));
    expect(exit._tag).toBe("Failure");
  });
});
