/* oxlint-disable eslint/sort-keys -- ZA-18 owner/CAS field insertions */
import { describe, expect, it } from "@effect/vitest";
import {
  AttemptId,
  ConversationId,
  IngressId,
  RelationshipId,
  TurnId,
} from "@zoen/contracts/eve/values";
import { EveJournal } from "@zoen/ontology/ports/eve/journal";
import { EveOpenCodeZen } from "@zoen/ontology/ports/eve/opencode-zen";
import { EveTurnService } from "@zoen/ontology/ports/eve/turn-service";
import { PrincipalId } from "@zoen/ontology/ports/worlds/context";
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
const ownerPrincipalId = Schema.decodeSync(PrincipalId)(
  "00000000-0000-4000-8000-000000000805"
);
const attemptId = Schema.decodeSync(AttemptId)(
  "00000000-0000-4000-8000-000000000806"
);
const purpose = "personal-records" as const;

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
              attemptId,
              ownerPrincipalId,
              purpose,
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
              attemptId,
              ownerPrincipalId,
              purpose,
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

it.effect(
  "ZA-19 grounding flag still fails closed without text profile / G-PROVIDER",
  () =>
    Effect.gen(function* groundedStillBlocked() {
      const surface = yield* makeProductEveSurface(true, {
        evidenceGroundingQualified: true,
      });
      yield* Effect.gen(function* assertBlocked() {
        const zen = yield* EveOpenCodeZen;
        const turns = yield* EveTurnService;
        const zenExit = yield* Effect.exit(
          zen.completeChat({
            conversationId,
            userText: "ping",
          })
        );
        // groundSubject without DB/context rights → fails closed (Blocked or Unavailable)
        expect(zenExit._tag).toBe("Failure");
        expect(turns).toBeDefined();
      }).pipe(Effect.provide(surface));
    })
);
