import { describe, expect, it } from "@effect/vitest";
import { AcceptConversationTurn } from "@zoen/contracts/eve/operations";
import {
  ConversationId,
  IngressId,
  MessageId,
  RelationshipId,
  TurnId,
} from "@zoen/contracts/eve/values";
import { EvidenceRef, WorldId } from "@zoen/contracts/worlds/values";
import { Effect, Layer, Redacted, Schema } from "effect";

import {
  currentProductEveAdmissionInput,
  isProductEveAdmitted,
  uncertaintyFromEvidenceBasis,
  uncertaintyFromGenerationText,
} from "../../../src/ports/eve/admission.js";
import { acceptConversationTurn } from "../../../src/ports/eve/handlers.js";
import { EveJournal } from "../../../src/ports/eve/journal.js";
import { EveOpenCodeZen } from "../../../src/ports/eve/opencode-zen.js";
import { EveTurnService } from "../../../src/ports/eve/turn-service.js";
import type { VerifiedRequestContext } from "../../../src/ports/worlds/context.js";

const conversationId = Schema.decodeSync(ConversationId)(
  "00000000-0000-4000-8000-000000000701"
);
const relationshipId = Schema.decodeSync(RelationshipId)(
  "00000000-0000-4000-8000-000000000702"
);
const ingressId = Schema.decodeSync(IngressId)(
  "00000000-0000-4000-8000-000000000703"
);
const turnId = Schema.decodeSync(TurnId)(
  "00000000-0000-4000-8000-000000000704"
);
const messageId = Schema.decodeSync(MessageId)(
  "00000000-0000-4000-8000-000000000705"
);
const worldRef = {
  realm: "live" as const,
  worldId: Schema.decodeSync(WorldId)("00000000-0000-4000-8000-000000000799"),
};
const evidenceRef = Schema.decodeSync(EvidenceRef)(
  "00000000-0000-4000-8000-000000000706"
);

const context = {
  deadline: "2099-01-01T00:00:00.000Z",
  presence: {
    authenticatedAt: "2026-09-07T00:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
    principalId: "00000000-0000-4000-8000-000000000710",
    realm: "live",
    sessionId: "00000000-0000-4000-8000-000000000711",
  },
  purpose: "personal-records",
} as VerifiedRequestContext;

const acceptRequest = Schema.decodeSync(AcceptConversationTurn)({
  input: {
    conversationId,
    ingressId,
    messageId,
    profileId: "eve-opencode-zen-v1",
    providerAdmission: "opencode-zen",
    relationshipId,
    turnId,
    userText: "quanto gastei?",
  },
  operation: "AcceptConversationTurn",
  purpose: "personal-records",
  schemaVersion: "eve.v1",
  worldRef,
});

describe("ZA-17 Eve admission safety", () => {
  it("ZA-17-01: missing key or missing journal/grounding stays unadmitted", () => {
    expect(
      isProductEveAdmitted(currentProductEveAdmissionInput(false))
    ).toBeFalsy();
    expect(
      isProductEveAdmitted(currentProductEveAdmissionInput(true))
    ).toBeFalsy();
    expect(
      isProductEveAdmitted({
        durableJournalQualified: true,
        evidenceGroundingQualified: true,
        openCodeKeyPresent: false,
        textProfileAccepted: true,
      })
    ).toBeFalsy();
  });

  it("ZA-17-02: long unsupported prose cannot set Known; unverified links cannot either", () => {
    const longProse =
      "This is a long model reply that previously would have been classified Known solely by character count, without any authorized evidence citation.";
    expect(uncertaintyFromGenerationText(longProse)).toBe("Partial");
    expect(uncertaintyFromGenerationText("")).toBe("Unknown");
    expect(uncertaintyFromGenerationText("   ")).toBe("Unknown");
    expect(
      uncertaintyFromEvidenceBasis({
        citationsAuthorized: false,
        evidenceLinks: [],
        generatedText: longProse,
      })
    ).toBe("Partial");
    // Identifier-only links without authorization must stay Partial (Greptile P2 / Qodo High).
    expect(
      uncertaintyFromEvidenceBasis({
        citationsAuthorized: false,
        evidenceLinks: [{ claimRef: null, evidenceRef }],
        generatedText: longProse,
      })
    ).toBe("Partial");
    expect(
      uncertaintyFromEvidenceBasis({
        citationsAuthorized: true,
        evidenceLinks: [],
        generatedText: longProse,
      })
    ).toBe("Partial");
    expect(
      uncertaintyFromEvidenceBasis({
        citationsAuthorized: true,
        evidenceLinks: [{ claimRef: null, evidenceRef }],
        generatedText: longProse,
      })
    ).toBe("Known");
    expect(
      uncertaintyFromEvidenceBasis({
        citationsAuthorized: true,
        evidenceLinks: [{ claimRef: null, evidenceRef }],
        generatedText: "   ",
      })
    ).toBe("Unknown");
  });

  it.effect(
    "ZA-17-03: host key configured but safety proof absent keeps handlers Blocked",
    () =>
      Effect.gen(function* keyWithoutProof() {
        // Key present via liveLayer settings, journal product-blocked — no
        // stubMemory substitute may activate the capability.
        const exit = yield* Effect.exit(
          acceptConversationTurn(context, acceptRequest)
        );
        expect(exit._tag).toBe("Failure");
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            EveJournal.blockedProvidersLayer,
            EveOpenCodeZen.liveLayer({
              apiKey: Redacted.make("host-key-present-must-not-admit"),
              baseUrl: "https://example.test/zen/v1",
              model: "big-pickle",
              userAgent: "opencode/1.17.20 zoen-eve",
            }),
            EveTurnService.legacyWithoutGroundingLayer
          )
        )
      )
  );

  it.effect(
    "ZA-17-01 seam: blocked product surface rejects authenticated accept",
    () =>
      Effect.gen(function* blockedSurface() {
        const exit = yield* Effect.exit(
          acceptConversationTurn(context, acceptRequest)
        );
        expect(exit._tag).toBe("Failure");
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            EveJournal.blockedProvidersLayer,
            EveOpenCodeZen.blockedLayer,
            EveTurnService.legacyWithoutGroundingLayer
          )
        )
      )
  );
});
