import { describe, expect, it } from "@effect/vitest";
import {
  ConversationId,
  IngressId,
  RelationshipId,
  TurnId,
} from "@zoen/contracts/eve/values";
import { EveJournal } from "@zoen/ontology/ports/eve/journal";
import { EveOpenCodeZen } from "@zoen/ontology/ports/eve/opencode-zen";
import { Effect, Schema } from "effect";

import { makeProductEveSurface } from "../../../src/composition.ts";

const conversationId = Schema.decodeSync(ConversationId)(
  "00000000-0000-4000-8000-000000000801"
);
const relationshipId = Schema.decodeSync(RelationshipId)(
  "00000000-0000-4000-8000-000000000802"
);
const ingressId = Schema.decodeSync(IngressId)(
  "00000000-0000-4000-8000-000000000803"
);
const turnId = Schema.decodeSync(TurnId)(
  "00000000-0000-4000-8000-000000000804"
);

describe("ZA-17 product Eve composition admission", () => {
  it.effect(
    "OpenCode key present still installs blocked journal+Zen (makeApplication surface)",
    () =>
      Effect.gen(function* keyPresentBlocked() {
        // Same helper makeApplication uses — key alone must not admit live/stub.
        const surface = yield* makeProductEveSurface(true);
        yield* Effect.gen(function* assertBlocked() {
          const journal = yield* EveJournal;
          const zen = yield* EveOpenCodeZen;
          const journalExit = yield* Effect.exit(
            journal.acceptTurn({
              conversationId,
              ingressId,
              profileId: "eve-opencode-zen-v1",
              providerAdmission: "opencode-zen",
              relationshipId,
              turnId,
              userText: "quanto gastei?",
              worldRef: null,
            })
          );
          const zenExit = yield* Effect.exit(
            zen.completeChat({
              conversationId,
              userText: "ping",
            })
          );
          expect(journalExit._tag).toBe("Failure");
          expect(zenExit._tag).toBe("Failure");
        }).pipe(Effect.provide(surface));
      })
  );

  it.effect(
    "OpenCode key absent installs the same blocked product surface",
    () =>
      Effect.gen(function* keyAbsent() {
        const surface = yield* makeProductEveSurface(false);
        yield* Effect.gen(function* assertBlocked() {
          const journal = yield* EveJournal;
          const zen = yield* EveOpenCodeZen;
          const journalExit = yield* Effect.exit(
            journal.acceptTurn({
              conversationId,
              ingressId,
              profileId: "eve-opencode-zen-v1",
              providerAdmission: "opencode-zen",
              relationshipId,
              turnId,
              userText: "ping",
              worldRef: null,
            })
          );
          const zenExit = yield* Effect.exit(
            zen.completeChat({
              conversationId,
              userText: "ping",
            })
          );
          expect(journalExit._tag).toBe("Failure");
          expect(zenExit._tag).toBe("Failure");
        }).pipe(Effect.provide(surface));
      })
  );
});
