import { describe, expect, it } from "@effect/vitest";
import {
  AttemptId,
  ConversationId,
  IngressId,
  MessageId,
  RelationshipId,
  TurnId,
} from "@zoen/contracts/eve/values";
import { EveJournal } from "@zoen/ontology/ports/eve/journal";
import type { EveFetch } from "@zoen/ontology/ports/eve/opencode-zen";
import { EveOpenCodeZen } from "@zoen/ontology/ports/eve/opencode-zen";
import { PrincipalId } from "@zoen/ontology/ports/worlds/context";
import { Effect, Layer, Redacted, Schema } from "effect";

import { admitDomainToolCall } from "../../src/eve/domain-tools.ts";
import { runGroundedModelTurn } from "../../src/eve/turn-service.ts";

const conversationId = Schema.decodeSync(ConversationId)(
  "00000000-0000-4000-8000-000000000801"
);
const relationshipId = Schema.decodeSync(RelationshipId)(
  "00000000-0000-4000-8000-000000000802"
);
const purpose = "personal-records" as const;
const ownerPrincipalId = Schema.decodeSync(PrincipalId)(
  "00000000-0000-4000-8000-000000000810"
);

const settings = {
  apiKey: Redacted.make("unit-test-key-must-not-journal"),
  baseUrl: "https://example.test/zen/v1",
  model: "big-pickle",
  userAgent: "opencode/1.17.20 zoen-eve",
} as const;

describe("ZA-19 grounded turn service", () => {
  it.effect("ZA-19-02 forged tool call denied before journal settle", () =>
    Effect.gen(function* deny() {
      const exit = yield* Effect.exit(
        admitDomainToolCall({
          arguments: { subjectKey: "x" },
          name: "exec_shell",
          sql: "DROP TABLE authority.claims",
        })
      );
      expect(exit._tag).toBe("Failure");
    })
  );

  it.effect(
    "ZA-19-03 abort during model I/O cancels; no settled disclosure",
    () => {
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
      const turnId = Schema.decodeSync(TurnId)(
        "00000000-0000-4000-8000-000000000821"
      );
      const ingressId = Schema.decodeSync(IngressId)(
        "00000000-0000-4000-8000-000000000822"
      );
      const messageId = Schema.decodeSync(MessageId)(
        "00000000-0000-4000-8000-000000000823"
      );
      const attemptId = Schema.decodeSync(AttemptId)(
        "00000000-0000-4000-8000-000000000824"
      );
      return Effect.gen(function* cancelled() {
        const exit = yield* Effect.exit(
          runGroundedModelTurn({
            attemptId,
            conversationId,
            ingressId,
            messageId,
            ownerPrincipalId,
            profileId: "eve-opencode-zen-v1",
            providerAdmission: "opencode-zen",
            purpose,
            relationshipId,
            signal: controller.signal,
            turnId,
            userText: "will cancel mid-stream",
            worldRef: null,
          })
        );
        const journal = yield* EveJournal;
        const snapshot = yield* journal.recover({
          conversationId,
          ownerPrincipalId,
          purpose,
          worldRef: null,
        });
        const turn = snapshot.turns.find((row) => row.turnId === turnId);
        const journalJson = yield* Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown)
        )(snapshot);
        expect({
          exit: exit._tag,
          messageCount: snapshot.messages.length,
          phase: turn?.phase,
          wireHasKey: journalJson.includes("unit-test-key"),
        }).toStrictEqual({
          exit: "Failure",
          messageCount: 0,
          phase: "Cancelled",
          wireHasKey: false,
        });
      }).pipe(Effect.provide(layer));
    }
  );
});
