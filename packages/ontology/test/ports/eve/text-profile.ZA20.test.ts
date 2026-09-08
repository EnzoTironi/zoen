import { randomUUID } from "node:crypto";

import { describe, expect, it } from "@effect/vitest";
import {
  AttemptId,
  ConversationId,
  IngressId,
  MessageId,
  RelationshipId,
  TurnId,
} from "@zoen/contracts/eve/values";
import { Effect, Layer, Redacted, Schema } from "effect";

import {
  currentProductEveAdmissionInput,
  isProductEveAdmitted,
} from "../../../src/ports/eve/admission.js";
import { EveJournal } from "../../../src/ports/eve/journal.js";
import { EveOpenCodeZen } from "../../../src/ports/eve/opencode-zen.js";
import {
  acceptedGroundedTextProfile,
  groundedTextProfileReady,
  isTextProfileAccepted,
  unqualifiedGroundedTextProfile,
} from "../../../src/ports/eve/text-profile.js";
import { runEveTurn } from "../../../src/ports/eve/turn.js";
import { PrincipalId } from "../../../src/ports/worlds/context.js";

const failingProviderFetch: typeof globalThis.fetch = async () => {
  throw new Error("upstream lost");
};

const decode = {
  attempt: Schema.decodeSync(AttemptId),
  conversation: Schema.decodeSync(ConversationId),
  ingress: Schema.decodeSync(IngressId),
  message: Schema.decodeSync(MessageId),
  principal: Schema.decodeSync(PrincipalId),
  relationship: Schema.decodeSync(RelationshipId),
  turn: Schema.decodeSync(TurnId),
};

describe("ZA-20 grounded text profile qualification", () => {
  it("ZA-20-02: unqualified or skipped suite never admits the text profile", () => {
    expect(isTextProfileAccepted(unqualifiedGroundedTextProfile())).toBeFalsy();
    expect(
      groundedTextProfileReady({
        openCodeKeyPresent: true,
        qualification: acceptedGroundedTextProfile(),
        suiteExecuted: false,
      })
    ).toBeFalsy();
    expect(
      groundedTextProfileReady({
        openCodeKeyPresent: false,
        qualification: acceptedGroundedTextProfile(),
        suiteExecuted: true,
      })
    ).toBeFalsy();
    expect(
      isProductEveAdmitted(
        currentProductEveAdmissionInput(true, {
          durableJournalQualified: true,
          evidenceGroundingQualified: true,
          textProfileAccepted: false,
        })
      )
    ).toBeFalsy();
  });

  it("ZA-20 records narrow acceptance without claiming full D05", () => {
    const accepted = acceptedGroundedTextProfile();
    expect(isTextProfileAccepted(accepted)).toBeTruthy();
    expect(accepted.claimsFullD05).toBeFalsy();
    expect(accepted.claimsCloudVoiceOrRouting).toBeFalsy();
    expect(accepted.profileId).toBe("eve-opencode-zen-v1");
    expect(accepted.providerAdmission).toBe("opencode-zen");
    expect(
      isProductEveAdmitted(
        currentProductEveAdmissionInput(true, {
          durableJournalQualified: true,
          evidenceGroundingQualified: true,
          textProfileAccepted: true,
        })
      )
    ).toBeTruthy();
  });

  it.effect(
    "ZA-20-03: lost provider response cancels — no fabricated visible settlement",
    () =>
      Effect.gen(function* lostProvider() {
        const conversationId = decode.conversation(randomUUID());
        const relationshipId = decode.relationship(randomUUID());
        const ingressId = decode.ingress(randomUUID());
        const turnId = decode.turn(randomUUID());
        const messageId = decode.message(randomUUID());
        const attemptId = decode.attempt(randomUUID());
        const ownerPrincipalId = decode.principal(randomUUID());

        const exit = yield* Effect.exit(
          runEveTurn({
            attemptId,
            conversationId,
            ingressId,
            messageId,
            ownerPrincipalId,
            profileId: "eve-opencode-zen-v1",
            providerAdmission: "opencode-zen",
            purpose: "personal-records",
            relationshipId,
            turnId,
            userText: "qual o compromisso contestado?",
          })
        );
        expect(exit._tag).toBe("Failure");

        const journal = yield* EveJournal;
        const snapshot = yield* journal.recover({
          conversationId,
          ownerPrincipalId,
          purpose: "personal-records",
          worldRef: null,
        });
        expect(snapshot.messages).toHaveLength(0);
        const turn = snapshot.turns.find((row) => row.turnId === turnId);
        expect(turn?.phase).toBe("Cancelled");
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            EveJournal.stubMemoryLayer,
            EveOpenCodeZen.liveLayer(
              {
                apiKey: Redacted.make("za20-test-key-not-a-secret"),
                baseUrl: "https://example.test/zen/v1",
                model: "big-pickle",
                userAgent: "opencode/1.17.20 zoen-eve",
              },
              failingProviderFetch
            )
          )
        )
      )
  );
});
