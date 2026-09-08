import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withStorage } from "../../../../apps/server/test/adapters/object-storage/worlds/fixture.js";
import { withWorldsDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.js";
import {
  AnswerQuestion,
  ImportEvidence,
  Inspect,
  ProposeCorrection,
  UndoCorrection,
} from "../../../../packages/contracts/src/worlds/operations.js";
import { createPersonalWorld } from "../../../../packages/ontology/src/commit/genesis.js";
import { importEvidence } from "../../../../packages/ontology/src/evidence/import.js";
import { answerQuestion } from "../../../../packages/ontology/src/knowledge/corrections/answer.js";
import { proposeCorrection } from "../../../../packages/ontology/src/knowledge/corrections/propose.js";
import { undoCorrection } from "../../../../packages/ontology/src/knowledge/corrections/undo.js";
import { inspect } from "../../../../packages/ontology/src/knowledge/inspect.js";
import { canonicalJson } from "../../../../packages/ontology/src/values/canonical.js";
import { configuration, makeInput } from "../commit/fixture.js";

it.live(
  "independent EX13 a three-answer chain restores exact predecessors through undo, replay remains stable, and retained frames stay historical",
  () =>
    withWorldsDatabase((database) =>
      withStorage(() =>
        Effect.gen(function* reviewChain() {
          const { context, request } = yield* makeInput();
          const { worldRef } = yield* createPersonalWorld(context, request);
          const validTime = {
            _tag: "DateInterval" as const,
            from: "2026-09-01",
            to: "2026-10-01",
          };
          const document = yield* canonicalJson({
            records: [
              {
                externalId: "amount",
                predicate: "obligation.amount",
                subjectKey: "A",
                validTime,
                value: { _tag: "Known", amount: "100", currency: "BRL" },
              },
            ],
            schemaVersion: "worlds.v1",
            source: {
              externalId: "chain",
              label: "Chain",
              namespace: "review",
              revision: "1",
            },
          });
          yield* importEvidence(
            context,
            yield* Schema.decodeEffect(ImportEvidence)({
              ...request,
              input: { document },
              operation: "ImportEvidence",
              operationId: randomUUID(),
              worldRef,
            })
          );
          const inspectRequest = yield* Schema.decodeEffect(Inspect)({
            input: { atFrame: null, subjectKey: "A" },
            operation: "Inspect",
            purpose: "personal-records",
            schemaVersion: "worlds.v1",
            worldRef,
          });
          const before = yield* inspect(context, inspectRequest);
          const [claim] = before.frame.claims;
          if (claim === undefined) {
            return yield* Effect.die("Real import must yield a claim");
          }
          const apply = (answer: "confirm" | "unknown") =>
            Effect.gen(function* applyAnswer() {
              const current = yield* inspect(context, inspectRequest);
              const proposed = yield* proposeCorrection(
                context,
                yield* Schema.decodeEffect(ProposeCorrection)({
                  ...request,
                  input: {
                    consequence: {
                      choice: { _tag: "selectClaim", claimRef: claim.claimRef },
                      subjectKey: "A",
                      validTime,
                    },
                    frameRef: current.frame.frameRef,
                  },
                  operation: "ProposeCorrection",
                  operationId: randomUUID(),
                  worldRef,
                })
              );
              const answerRequest = yield* Schema.decodeEffect(AnswerQuestion)({
                ...request,
                input: {
                  answer,
                  consequenceDigest: proposed.consequenceDigest,
                  questionRef: proposed.questionRef,
                },
                operation: "AnswerQuestion",
                operationId: randomUUID(),
                worldRef,
              });
              const applied = yield* answerQuestion(context, answerRequest);
              return {
                answerRequest,
                applied,
                frame: yield* inspect(context, inspectRequest),
              };
            });
          const first = yield* apply("confirm");
          const second = yield* apply("unknown");
          const third = yield* apply("confirm");
          const undo = (correctionRef: string, frameRef: string) =>
            Schema.decodeEffect(UndoCorrection)({
              ...request,
              input: { correctionRef, frameRef },
              operation: "UndoCorrection",
              operationId: randomUUID(),
              worldRef,
            });
          const oldUndo = yield* undo(
            first.applied.correctionRef,
            first.frame.frame.frameRef
          );
          expect(
            yield* undoCorrection(context, oldUndo).pipe(Effect.flip)
          ).toMatchObject({ _tag: "Stale" });
          const undoThird = yield* undo(
            third.applied.correctionRef,
            third.frame.frame.frameRef
          );
          const undone = yield* undoCorrection(context, undoThird);
          const restoredSecond = yield* inspect(context, inspectRequest);
          expect(restoredSecond.frame.scopedCorrections).toStrictEqual(
            second.frame.frame.scopedCorrections
          );
          yield* undoCorrection(
            context,
            yield* undo(
              second.applied.correctionRef,
              restoredSecond.frame.frameRef
            )
          );
          const restoredFirst = yield* inspect(context, inspectRequest);
          expect(restoredFirst.frame.scopedCorrections).toStrictEqual(
            first.frame.frame.scopedCorrections
          );
          expect(yield* undoCorrection(context, undoThird)).toStrictEqual(
            undone
          );
          expect(
            yield* answerQuestion(context, second.answerRequest)
          ).toStrictEqual(second.applied);
          expect(
            (yield* inspect(context, inspectRequest)).frame.scopedCorrections
          ).toStrictEqual(first.frame.frame.scopedCorrections);
          const fourth = yield* apply("unknown");
          yield* undoCorrection(
            context,
            yield* undo(
              fourth.applied.correctionRef,
              fourth.frame.frame.frameRef
            )
          );
          const afterFourthUndo = yield* inspect(context, inspectRequest);
          expect(afterFourthUndo.frame.scopedCorrections).toStrictEqual(
            first.frame.frame.scopedCorrections
          );
          yield* undoCorrection(
            context,
            yield* undo(
              first.applied.correctionRef,
              afterFourthUndo.frame.frameRef
            )
          );
          expect(
            (yield* inspect(context, inspectRequest)).frame.scopedCorrections
          ).toStrictEqual([]);
          for (const historical of [
            before,
            first.frame,
            second.frame,
            third.frame,
            fourth.frame,
          ]) {
            expect(
              yield* inspect(context, {
                ...inspectRequest,
                input: {
                  ...inspectRequest.input,
                  atFrame: historical.frame.frameRef,
                },
              })
            ).toStrictEqual(historical);
          }
          const sql = yield* SqlClient.SqlClient;
          expect(
            yield* sql`SELECT count(*)::int AS events, count(DISTINCT receipt_id)::int AS receipts FROM authority.corrections`
          ).toStrictEqual([{ events: 8, receipts: 8 }]);
          return null;
        }).pipe(
          Effect.provide(Layer.mergeAll(configuration, database.authority))
        )
      )
    )
);
