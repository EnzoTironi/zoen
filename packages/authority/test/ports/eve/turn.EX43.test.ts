import { describe, expect, it } from "@effect/vitest";
import {
  ConversationId,
  IngressId,
  MessageId,
  RelationshipId,
  TurnId,
} from "@zoen/contracts/eve/values";
import { Effect, Layer, Redacted, Schema } from "effect";

import { EveJournal } from "../../../src/ports/eve/journal.js";
import type { EveFetch } from "../../../src/ports/eve/opencode-zen.js";
import { EveOpenCodeZen } from "../../../src/ports/eve/opencode-zen.js";
import { runEveTurn } from "../../../src/ports/eve/turn.js";

const conversationId = Schema.decodeSync(ConversationId)(
  "00000000-0000-4000-8000-000000000401"
);
const relationshipId = Schema.decodeSync(RelationshipId)(
  "00000000-0000-4000-8000-000000000402"
);
const ingressId = Schema.decodeSync(IngressId)(
  "00000000-0000-4000-8000-000000000403"
);
const turnId = Schema.decodeSync(TurnId)(
  "00000000-0000-4000-8000-000000000404"
);
const messageId = Schema.decodeSync(MessageId)(
  "00000000-0000-4000-8000-000000000405"
);
const ingressCancel = Schema.decodeSync(IngressId)(
  "00000000-0000-4000-8000-000000000406"
);
const turnCancel = Schema.decodeSync(TurnId)(
  "00000000-0000-4000-8000-000000000407"
);
const messageCancel = Schema.decodeSync(MessageId)(
  "00000000-0000-4000-8000-000000000408"
);

const settings = {
  apiKey: Redacted.make("unit-test-key-must-not-journal"),
  baseUrl: "https://example.test/zen/v1",
  model: "big-pickle",
  userAgent: "opencode/1.17.20 zoen-eve",
} as const;

const mockOkFetch: EveFetch = () =>
  Promise.resolve(
    Response.json(
      {
        choices: [
          {
            message: {
              content: "Model reply: eve-ok from mocked OpenCode Zen.",
            },
          },
        ],
      },
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    )
  );

const zenLayer = Layer.mergeAll(
  EveJournal.stubMemoryLayer,
  EveOpenCodeZen.liveLayer(settings, mockOkFetch)
);

describe("EX43 Eve turn path (OpenCode Zen)", () => {
  it.effect("accept → model → settle returns real model text", () =>
    Effect.gen(function* path() {
      const result = yield* runEveTurn({
        conversationId,
        ingressId,
        messageId,
        profileId: "eve-opencode-zen-v1",
        providerAdmission: "opencode-zen",
        relationshipId,
        turnId,
        userText: "reply with eve-ok",
      });
      const journal = yield* EveJournal;
      const snapshot = yield* journal.recover(conversationId);
      const wire = JSON.stringify(snapshot);
      expect({
        admission: snapshot.providerAdmission,
        credential: snapshot.authorityCredentialPresent,
        messageCount: snapshot.messages.length,
        phase: result.turn.phase,
        state: result.message.state,
        uncertainty: result.message.uncertainty,
        visibleHasEveOk: result.message.visibleText.includes("eve-ok"),
        wireHasAuthHeader: wire.toLowerCase().includes("authorization"),
        wireHasKey: wire.includes("unit-test-key"),
        wireHasSecretPhrase: wire.includes("must-not-journal"),
      }).toStrictEqual({
        admission: "opencode-zen",
        credential: false,
        messageCount: 1,
        phase: "Settled",
        state: "Visible",
        uncertainty: "Known",
        visibleHasEveOk: true,
        wireHasAuthHeader: false,
        wireHasKey: false,
        wireHasSecretPhrase: false,
      });
    }).pipe(Effect.provide(zenLayer))
  );

  it.effect("abort during model call cancels before settle", () => {
    const controller = new AbortController();
    const abortingFetch: EveFetch = (_url, init) => {
      controller.abort();
      if (init?.signal?.aborted === true) {
        throw new DOMException("Aborted", "AbortError");
      }
      throw new DOMException("Aborted", "AbortError");
    };
    const layer = Layer.mergeAll(
      EveJournal.stubMemoryLayer,
      EveOpenCodeZen.liveLayer(settings, abortingFetch)
    );
    return Effect.gen(function* cancelled() {
      const exit = yield* Effect.exit(
        runEveTurn({
          conversationId,
          ingressId: ingressCancel,
          messageId: messageCancel,
          profileId: "eve-opencode-zen-v1",
          providerAdmission: "opencode-zen",
          relationshipId,
          signal: controller.signal,
          turnId: turnCancel,
          userText: "will cancel",
        })
      );
      const journal = yield* EveJournal;
      const snapshot = yield* journal.recover(conversationId);
      const turn = snapshot.turns.find((row) => row.turnId === turnCancel);
      expect({
        exit: exit._tag,
        messageCount: snapshot.messages.length,
        phase: turn?.phase,
        wireHasKey: JSON.stringify(snapshot).includes("unit-test-key"),
      }).toStrictEqual({
        exit: "Failure",
        messageCount: 0,
        phase: "Cancelled",
        wireHasKey: false,
      });
    }).pipe(Effect.provide(layer));
  });

  it.effect("voice admission stays fail-closed on turn path", () =>
    Effect.gen(function* voice() {
      const exit = yield* Effect.exit(
        runEveTurn({
          conversationId,
          ingressId,
          messageId,
          profileId: "eve-opencode-zen-v1",
          providerAdmission: "voice-blocked",
          relationshipId,
          turnId,
          userText: "no voice",
        })
      );
      expect(exit._tag).toBe("Failure");
    }).pipe(Effect.provide(zenLayer))
  );
});
