import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withStorage } from "../../../../apps/server/test/adapters/object-storage/worlds/fixture.js";
import { withD01Database as withCorrectionsDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.js";
import { createPersonalWorld } from "../../../../packages/authority/src/commit/genesis.js";
import { importEvidence } from "../../../../packages/authority/src/evidence/worlds/import.js";
import { answerQuestion } from "../../../../packages/authority/src/knowledge/corrections/answer.js";
import { proposeCorrection } from "../../../../packages/authority/src/knowledge/corrections/propose.js";
import { inspect } from "../../../../packages/authority/src/knowledge/worlds/inspect.js";
import { canonicalJson } from "../../../../packages/authority/src/values/canonical.js";
import {
  AnswerQuestion,
  ImportEvidence,
  Inspect,
  ProposeCorrection,
} from "../../../../packages/contracts/src/worlds/operations.js";
import { configuration, makeInput } from "../commit/fixture.js";

it.live(
  "EX13 changed released meaning conflicts, a real relevant import makes the retained question Stale, and another principal cannot answer it",
  () =>
    withCorrectionsDatabase((database) =>
      withStorage(() =>
        Effect.gen(function* retainedGuards() {
          const { context, request } = yield* makeInput();
          const { worldRef } = yield* createPersonalWorld(context, request);
          const addRevision = (revision: string) =>
            Effect.gen(function* actualImport() {
              const document = yield* canonicalJson({
                records: [
                  {
                    externalId: "one",
                    predicate: "obligation.amount",
                    subjectKey: "A",
                    validTime: {
                      _tag: "DateInterval",
                      from: "2026-09-01",
                      to: "2026-10-01",
                    },
                    value: {
                      _tag: "Known",
                      amount: revision === "1" ? "100" : "200",
                      currency: "BRL",
                    },
                  },
                ],
                schemaVersion: "worlds.v1",
                source: {
                  externalId: "billing",
                  label: "Billing",
                  namespace: "test",
                  revision,
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
            });
          yield* addRevision("1");
          const input = yield* Schema.decodeEffect(Inspect)({
            input: { atFrame: null, subjectKey: "A" },
            operation: "Inspect",
            purpose: "personal-records",
            schemaVersion: "worlds.v1",
            worldRef,
          });
          const frame = yield* inspect(context, input);
          const [selected] = frame.frame.claims;
          if (
            selected === undefined ||
            selected.validTime._tag !== "DateInterval"
          ) {
            return yield* Effect.die("Expected imported claim");
          }
          const proposalRequest = yield* Schema.decodeEffect(ProposeCorrection)(
            {
              ...request,
              input: {
                consequence: {
                  choice: { _tag: "selectClaim", claimRef: selected.claimRef },
                  subjectKey: "A",
                  validTime: selected.validTime,
                },
                frameRef: frame.frame.frameRef,
              },
              operation: "ProposeCorrection",
              operationId: randomUUID(),
              worldRef,
            }
          );
          const proposed = yield* proposeCorrection(context, proposalRequest);
          const answer = yield* Schema.decodeEffect(AnswerQuestion)({
            ...request,
            input: {
              answer: "confirm",
              consequenceDigest: proposed.consequenceDigest,
              questionRef: proposed.questionRef,
            },
            operation: "AnswerQuestion",
            operationId: randomUUID(),
            worldRef,
          });
          const wrongDigest = yield* Schema.decodeEffect(
            AnswerQuestion.fields.input.fields.consequenceDigest
          )(
            `${proposed.consequenceDigest.startsWith("a") ? "b" : "a"}${proposed.consequenceDigest.slice(1)}`
          );
          expect(
            yield* answerQuestion(context, {
              ...answer,
              input: { ...answer.input, consequenceDigest: wrongDigest },
            }).pipe(Effect.flip)
          ).toMatchObject({ _tag: "Conflict" });
          const stranger = yield* makeInput();
          expect(
            yield* answerQuestion(stranger.context, answer).pipe(Effect.flip)
          ).toMatchObject({ _tag: "NotFoundOrDenied" });
          yield* addRevision("2");
          expect(
            yield* answerQuestion(context, answer).pipe(Effect.flip)
          ).toMatchObject({ _tag: "Stale" });
          const sql = yield* SqlClient.SqlClient;
          expect(
            yield* sql`SELECT (SELECT count(*)::int FROM authority.corrections) AS corrections, state, internal_basis->'cut'->>'claims' AS claims, internal_basis->'cut'->>'cases' AS cases FROM authority.cases WHERE case_id = ${proposed.caseRef}`
          ).toStrictEqual([
            { cases: "1", claims: "1", corrections: 0, state: "proposed" },
          ]);
          expect(
            yield* proposeCorrection(context, proposalRequest)
          ).toStrictEqual(proposed);
          return null;
        }).pipe(
          Effect.provide(Layer.mergeAll(configuration, database.authority))
        )
      )
    )
);
