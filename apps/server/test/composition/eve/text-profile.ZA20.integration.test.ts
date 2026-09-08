import { randomUUID } from "node:crypto";

import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import {
  AttemptId,
  ConversationId,
  IngressId,
  MessageId,
  RelationshipId,
  TurnId,
} from "@zoen/contracts/eve/values";
import { EvidenceRef, WorldId } from "@zoen/contracts/worlds/values";
import {
  currentProductEveAdmissionInput,
  isProductEveAdmitted,
} from "@zoen/ontology/ports/eve/admission";
import { EveJournal } from "@zoen/ontology/ports/eve/journal";
import { EveOpenCodeZen } from "@zoen/ontology/ports/eve/opencode-zen";
import {
  acceptedGroundedTextProfile,
  isTextProfileAccepted,
} from "@zoen/ontology/ports/eve/text-profile";
import { runEveTurn } from "@zoen/ontology/ports/eve/turn";
import { PrincipalId } from "@zoen/ontology/ports/worlds/context";
import { Effect, Layer, Redacted, Schema } from "effect";

import { applyErasureMigrations } from "../../../../../ops/migrations/run.ts";
import { makeDurableEveJournalLayer } from "../../../src/adapters/postgres/eve/journal.ts";
import { makeProductEveSurface } from "../../../src/composition.ts";
import { grantTestEveJournalRole } from "../../adapters/postgres/eve/database.ts";
import { withWorldsDatabase } from "../../adapters/postgres/worlds/database.ts";

const decode = {
  attempt: Schema.decodeSync(AttemptId),
  conversation: Schema.decodeSync(ConversationId),
  evidence: Schema.decodeSync(EvidenceRef),
  ingress: Schema.decodeSync(IngressId),
  message: Schema.decodeSync(MessageId),
  principal: Schema.decodeSync(PrincipalId),
  relationship: Schema.decodeSync(RelationshipId),
  turn: Schema.decodeSync(TurnId),
  world: Schema.decodeSync(WorldId),
};

const installEveJournal = (
  database: Parameters<typeof grantTestEveJournalRole>[0]
) =>
  Effect.gen(function* install() {
    yield* applyErasureMigrations(database.names).pipe(
      Effect.provide(Layer.mergeAll(database.migration, NodeServices.layer))
    );
    yield* grantTestEveJournalRole(database);
  }).pipe(Effect.orDie);

const mockProviderFetch =
  (visibleText: string): typeof globalThis.fetch =>
  async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: visibleText, role: "assistant" } }],
      }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );

const failingProviderFetch: typeof globalThis.fetch = async () => {
  throw new Error("provider lost mid-flight");
};

it.live(
  "ZA-20-01: provider settle with evidence links persists and replays once across restart",
  () =>
    withWorldsDatabase(
      (database) =>
        Effect.gen(function* za2001() {
          expect(
            isTextProfileAccepted(acceptedGroundedTextProfile())
          ).toBeTruthy();
          // Tip without G-PROVIDER profile opt-in: textProfileAccepted false → product unadmitted.
          expect(
            isProductEveAdmitted(
              currentProductEveAdmissionInput(true, {
                durableJournalQualified: true,
                evidenceGroundingQualified: true,
                textProfileAccepted: false,
              })
            )
          ).toBeFalsy();

          yield* installEveJournal(database);

          const conversationId = decode.conversation(randomUUID());
          const relationshipId = decode.relationship(randomUUID());
          const ingressId = decode.ingress(randomUUID());
          const turnId = decode.turn(randomUUID());
          const messageId = decode.message(randomUUID());
          const attemptId = decode.attempt(randomUUID());
          const ownerPrincipalId = decode.principal(randomUUID());
          const purpose = "personal-records" as const;
          const worldRef = {
            realm: "live" as const,
            worldId: decode.world(randomUUID()),
          };
          const evidenceRef = decode.evidence(randomUUID());
          const visibleText =
            "ZA-20 grounded reply cites the contested commitment (synthetic provider).";

          const journalLayer = makeDurableEveJournalLayer({
            applicationName: "zoen-za20-journal",
            maxConnections: 4,
            url: database.urls.eveJournal,
          });
          const zenLayer = EveOpenCodeZen.liveLayer(
            {
              apiKey: Redacted.make("za20-integration-mock-key"),
              baseUrl: "https://example.test/zen/v1",
              model: "big-pickle",
              userAgent: "opencode/1.17.20 zoen-eve",
            },
            mockProviderFetch(visibleText)
          );
          const surface = Layer.mergeAll(journalLayer, zenLayer);

          const settled = yield* runEveTurn({
            attemptId,
            conversationId,
            evidenceLinks: [{ claimRef: null, evidenceRef }],
            ingressId,
            messageId,
            ownerPrincipalId,
            profileId: "eve-opencode-zen-v1",
            providerAdmission: "opencode-zen",
            purpose,
            relationshipId,
            turnId,
            userText: "qual o compromisso contestado?",
            worldRef,
          }).pipe(Effect.provide(surface));

          expect(settled.message.visibleText).toBe(visibleText);
          // Until ZA-19 authorizes citations, Known stays closed (Partial).
          expect(settled.message.uncertainty).toBe("Partial");
          expect(settled.message.evidenceLinks).toHaveLength(1);

          // Restart: new layer against the same durable rows — one visible message.
          const restarted = makeDurableEveJournalLayer({
            applicationName: "zoen-za20-journal-restart",
            maxConnections: 4,
            url: database.urls.eveJournal,
          });
          yield* Effect.gen(function* secondProcess() {
            const journal = yield* EveJournal;
            const snapshot = yield* journal.recover({
              conversationId,
              ownerPrincipalId,
              purpose,
              worldRef,
            });
            expect(snapshot.messages).toHaveLength(1);
            expect(snapshot.messages[0]?.visibleText).toBe(visibleText);
            expect(snapshot.messages[0]?.messageId).toBe(messageId);

            const replayed = yield* journal.acceptTurn({
              attemptId: decode.attempt(randomUUID()),
              conversationId,
              ingressId,
              ownerPrincipalId,
              profileId: "eve-opencode-zen-v1",
              providerAdmission: "opencode-zen",
              purpose,
              relationshipId,
              turnId,
              userText: "qual o compromisso contestado?",
              worldRef,
            });
            expect(replayed.phase).toBe("Settled");
            expect(replayed.turnId).toBe(turnId);

            const again = yield* journal.recover({
              conversationId,
              ownerPrincipalId,
              purpose,
              worldRef,
            });
            expect(again.messages).toHaveLength(1);
          }).pipe(Effect.provide(restarted));
        }),
      undefined,
      () => Effect.void
    )
);

it.live(
  "ZA-20-03: lost provider on durable journal cancels — at most one settlement on retry",
  () =>
    withWorldsDatabase(
      (database) =>
        Effect.gen(function* za2003() {
          yield* installEveJournal(database);

          const conversationId = decode.conversation(randomUUID());
          const relationshipId = decode.relationship(randomUUID());
          const ingressId = decode.ingress(randomUUID());
          const turnId = decode.turn(randomUUID());
          const messageId = decode.message(randomUUID());
          const attemptId = decode.attempt(randomUUID());
          const ownerPrincipalId = decode.principal(randomUUID());
          const purpose = "personal-records" as const;
          const worldRef = {
            realm: "live" as const,
            worldId: decode.world(randomUUID()),
          };

          const journalLayer = makeDurableEveJournalLayer({
            applicationName: "zoen-za20-lost-provider",
            maxConnections: 4,
            url: database.urls.eveJournal,
          });
          const failZen = EveOpenCodeZen.liveLayer(
            {
              apiKey: Redacted.make("za20-integration-mock-key"),
              baseUrl: "https://example.test/zen/v1",
              model: "big-pickle",
              userAgent: "opencode/1.17.20 zoen-eve",
            },
            failingProviderFetch
          );

          const lost = yield* Effect.exit(
            runEveTurn({
              attemptId,
              conversationId,
              ingressId,
              messageId,
              ownerPrincipalId,
              profileId: "eve-opencode-zen-v1",
              providerAdmission: "opencode-zen",
              purpose,
              relationshipId,
              turnId,
              userText: "ping perdido",
              worldRef,
            }).pipe(Effect.provide(Layer.mergeAll(journalLayer, failZen)))
          );
          expect(lost._tag).toBe("Failure");

          yield* Effect.gen(function* afterLoss() {
            const journal = yield* EveJournal;
            const snapshot = yield* journal.recover({
              conversationId,
              ownerPrincipalId,
              purpose,
              worldRef,
            });
            expect(snapshot.messages).toHaveLength(0);
            const turn = snapshot.turns.find((row) => row.turnId === turnId);
            expect(turn?.phase).toBe("Cancelled");
          }).pipe(Effect.provide(journalLayer));

          // Explicit retry under policy with a new turn/ingress — one settlement.
          const retryIngress = decode.ingress(randomUUID());
          const retryTurn = decode.turn(randomUUID());
          const retryMessage = decode.message(randomUUID());
          const retryAttempt = decode.attempt(randomUUID());
          const visibleText =
            "ZA-20 retry after lost provider — one settlement.";
          const okZen = EveOpenCodeZen.liveLayer(
            {
              apiKey: Redacted.make("za20-integration-mock-key"),
              baseUrl: "https://example.test/zen/v1",
              model: "big-pickle",
              userAgent: "opencode/1.17.20 zoen-eve",
            },
            mockProviderFetch(visibleText)
          );
          const settled = yield* runEveTurn({
            attemptId: retryAttempt,
            conversationId,
            ingressId: retryIngress,
            messageId: retryMessage,
            ownerPrincipalId,
            profileId: "eve-opencode-zen-v1",
            providerAdmission: "opencode-zen",
            purpose,
            relationshipId,
            turnId: retryTurn,
            userText: "ping perdido",
            worldRef,
          }).pipe(Effect.provide(Layer.mergeAll(journalLayer, okZen)));
          expect(settled.message.visibleText).toBe(visibleText);

          yield* Effect.gen(function* finalSnap() {
            const journal = yield* EveJournal;
            const snapshot = yield* journal.recover({
              conversationId,
              ownerPrincipalId,
              purpose,
              worldRef,
            });
            expect(snapshot.messages).toHaveLength(1);
          }).pipe(Effect.provide(journalLayer));
        }),
      undefined,
      () => Effect.void
    )
);

it.live(
  "ZA-20: all gates + openCodeZen install liveLayer (not PROFILE_BLOCKED)",
  () =>
    withWorldsDatabase(
      (database) =>
        Effect.gen(function* liveInstall() {
          yield* installEveJournal(database);
          const conversationId = decode.conversation(randomUUID());
          const surface = yield* makeProductEveSurface(true, {
            eveJournalDatabaseUrl: database.urls.eveJournal,
            evidenceGroundingQualified: true,
            openCodeZen: {
              apiKey: Redacted.make("za20-integration-mock-key"),
              baseUrl: "https://example.test/zen/v1",
              model: "big-pickle",
            },
            textProfileAccepted: true,
          });
          yield* Effect.gen(function* assertLive() {
            const zen = yield* EveOpenCodeZen;
            const exit = yield* Effect.exit(
              zen.completeChat({
                conversationId,
                userText: "ping",
              })
            );
            expect(exit._tag).toBe("Failure");
            if (exit._tag === "Failure") {
              expect(
                String(exit.cause).includes("PROFILE_BLOCKED")
              ).toBeFalsy();
            }
          }).pipe(Effect.provide(surface));
        }),
      undefined,
      () => Effect.void
    )
);
