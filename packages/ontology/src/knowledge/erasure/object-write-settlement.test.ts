import { describe, expect, it } from "vitest";

import {
  observeStorageFenceQualification,
  refuseNonTerminalSettlementEvidence,
} from "./object-write-settlement.ts";

describe("object write settlement (ZA-10)", () => {
  it("reports G-STORAGE-FENCE Blocked — Object Lock is not a writer fence", () => {
    expect(observeStorageFenceQualification()).toBe("Blocked");
  });

  it("refuses HEAD 404, TTL, network loss, and credential retirement as settlement", () => {
    for (const evidence of [
      {
        _tag: "HeadNotFound" as const,
        attemptId: "00000000-0000-4000-8000-000000000001",
      },
      {
        _tag: "TtlExpired" as const,
        attemptId: "00000000-0000-4000-8000-000000000001",
      },
      {
        _tag: "NetworkDisconnect" as const,
        attemptId: "00000000-0000-4000-8000-000000000001",
      },
      {
        _tag: "CredentialRetirement" as const,
        attemptId: "00000000-0000-4000-8000-000000000001",
      },
    ]) {
      expect(refuseNonTerminalSettlementEvidence(evidence)).toBeTruthy();
    }
    expect(
      refuseNonTerminalSettlementEvidence({
        _tag: "ProviderTerminal",
        attemptId: "00000000-0000-4000-8000-000000000001",
      })
    ).toBeFalsy();
    expect(
      refuseNonTerminalSettlementEvidence({
        _tag: "ClientCancelled",
        attemptId: "00000000-0000-4000-8000-000000000001",
      })
    ).toBeFalsy();
  });
});
