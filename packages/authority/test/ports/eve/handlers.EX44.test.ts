import { describe, expect, it } from "@effect/vitest";
import {
  AcceptConversationTurn,
  CancelConversationTurn,
  RecoverConversationJournal,
  SettleConversationMessage,
} from "@zoen/contracts/eve/operations";
import {
  ConversationId,
  IngressId,
  MessageId,
  RelationshipId,
  TurnId,
} from "@zoen/contracts/eve/values";
import { WorldId } from "@zoen/contracts/worlds/values";
import { Effect, Layer, Redacted, Schema } from "effect";

import {
  acceptConversationTurn,
  cancelConversationTurn,
  recoverConversationJournal,
  settleConversationMessage,
} from "../../../src/ports/eve/handlers.js";
import { EveJournal } from "../../../src/ports/eve/journal.js";
import type { EveFetch } from "../../../src/ports/eve/opencode-zen.js";
import { EveOpenCodeZen } from "../../../src/ports/eve/opencode-zen.js";
import type { VerifiedRequestContext } from "../../../src/ports/worlds/context.js";

const conversationId = Schema.decodeSync(ConversationId)(
  "00000000-0000-4000-8000-000000000501"
);
const relationshipId = Schema.decodeSync(RelationshipId)(
  "00000000-0000-4000-8000-000000000502"
);
const ingressId = Schema.decodeSync(IngressId)(
  "00000000-0000-4000-8000-000000000503"
);
const turnId = Schema.decodeSync(TurnId)(
  "00000000-0000-4000-8000-000000000504"
);
const messageId = Schema.decodeSync(MessageId)(
  "00000000-0000-4000-8000-000000000505"
);
const worldRef = {
  realm: "live" as const,
  worldId: Schema.decodeSync(WorldId)("00000000-0000-4000-8000-000000000599"),
};

const context = {
  deadline: "2099-01-01T00:00:00.000Z",
  presence: {
    authenticatedAt: "2026-09-07T00:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
    principalId: "00000000-0000-4000-8000-000000000510",
    realm: "live",
    sessionId: "00000000-0000-4000-8000-000000000511",
  },
  purpose: "personal-records",
} as VerifiedRequestContext;

const settings = {
  apiKey: Redacted.make("unit-test-key-must-not-journal"),
  baseUrl: "https://example.test/zen/v1",
  model: "big-pickle",
  userAgent: "opencode/1.17.20 zoen-eve",
} as const;

const mockOkFetch: EveFetch = () =>
  Promise.resolve(
    Response.json({
      choices: [
        { message: { content: "Model reply: eve-ok from HTTP surface." } },
      ],
    })
  );

const zenLayer = Layer.mergeAll(
  EveJournal.stubMemoryLayer,
  EveOpenCodeZen.liveLayer(settings, mockOkFetch)
);

const acceptRequest = Schema.decodeSync(AcceptConversationTurn)({
  input: {
    conversationId,
    ingressId,
    messageId,
    profileId: "eve-opencode-zen-v1",
    providerAdmission: "opencode-zen",
    relationshipId,
    turnId,
    userText: "reply with eve-ok",
  },
  operation: "AcceptConversationTurn",
  purpose: "personal-records",
  schemaVersion: "eve.v1",
  worldRef,
});

describe("EX44 Eve HTTP handlers (product surface)", () => {
  it.effect(
    "accept → Zen → settle returns visible text without journaling the key",
    () =>
      Effect.gen(function* path() {
        const result = yield* acceptConversationTurn(context, acceptRequest);
        expect(result._tag).toBe("ConversationMessageSettled");
        if (result._tag !== "ConversationMessageSettled") {
          return;
        }
        expect(result.visibleText).toContain("eve-ok");
        const recovered = yield* recoverConversationJournal(
          context,
          Schema.decodeSync(RecoverConversationJournal)({
            input: { conversationId },
            operation: "RecoverConversationJournal",
            purpose: "personal-records",
            schemaVersion: "eve.v1",
            worldRef,
          })
        );
        expect(recovered._tag).toBe("ConversationJournalRecovered");
        if (recovered._tag !== "ConversationJournalRecovered") {
          return;
        }
        expect(
          JSON.stringify(recovered.snapshot).includes("unit-test-key")
        ).toBeFalsy();
      }).pipe(Effect.provide(zenLayer))
  );

  it.effect("stub-local admission is fail-closed on the product surface", () =>
    Effect.gen(function* stub() {
      const exit = yield* Effect.exit(
        acceptConversationTurn(
          context,
          Schema.decodeSync(AcceptConversationTurn)({
            ...acceptRequest,
            input: {
              ...acceptRequest.input,
              profileId: "eve-local-stub-v1",
              providerAdmission: "stub-local",
            },
          })
        )
      );
      expect(exit._tag).toBe("Failure");
    }).pipe(Effect.provide(zenLayer))
  );

  it.effect("missing OpenCode key surfaces Blocked", () =>
    Effect.gen(function* blocked() {
      const exit = yield* Effect.exit(
        acceptConversationTurn(context, acceptRequest)
      );
      expect(exit._tag).toBe("Failure");
    }).pipe(
      Effect.provide(
        Layer.mergeAll(EveJournal.stubMemoryLayer, EveOpenCodeZen.blockedLayer)
      )
    )
  );

  it.effect("client SettleConversationMessage is Unsupported", () =>
    Effect.gen(function* settle() {
      const exit = yield* Effect.exit(
        settleConversationMessage(
          context,
          Schema.decodeSync(SettleConversationMessage)({
            input: {
              conversationId,
              evidenceLinks: [],
              messageId,
              turnId,
              uncertainty: "Known",
              visibleText: "forged",
            },
            operation: "SettleConversationMessage",
            purpose: "personal-records",
            schemaVersion: "eve.v1",
            worldRef,
          })
        )
      );
      expect(exit._tag).toBe("Failure");
    })
  );

  it.effect("cancel before settle leaves no Visible message", () =>
    Effect.gen(function* cancel() {
      const journal = yield* EveJournal;
      yield* journal.acceptTurn({
        conversationId,
        ingressId: Schema.decodeSync(IngressId)(
          "00000000-0000-4000-8000-000000000506"
        ),
        profileId: "eve-opencode-zen-v1",
        providerAdmission: "opencode-zen",
        relationshipId,
        turnId: Schema.decodeSync(TurnId)(
          "00000000-0000-4000-8000-000000000507"
        ),
        userText: "pending",
        worldRef: null,
      });
      const cancelled = yield* cancelConversationTurn(
        context,
        Schema.decodeSync(CancelConversationTurn)({
          input: {
            conversationId,
            turnId: Schema.decodeSync(TurnId)(
              "00000000-0000-4000-8000-000000000507"
            ),
          },
          operation: "CancelConversationTurn",
          purpose: "personal-records",
          schemaVersion: "eve.v1",
          worldRef,
        })
      );
      expect(cancelled._tag).toBe("ConversationTurnCancelled");
      const snapshot = yield* journal.recover(conversationId);
      expect(snapshot.messages).toHaveLength(0);
    }).pipe(Effect.provide(EveJournal.stubMemoryLayer))
  );
});
