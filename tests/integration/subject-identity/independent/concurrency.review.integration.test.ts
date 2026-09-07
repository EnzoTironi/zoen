/* oxlint-disable unicorn/consistent-function-scoping, eslint/complexity */
import { randomBytes, randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { SemanticExecutor } from "@zoen/authority/semantic/executor";
import { canonicalJson } from "@zoen/authority/values/canonical";
import {
  CorrectionApplied,
  CorrectionProposed,
  EvidenceImported,
  FrameInspected,
  WorldCreated,
} from "@zoen/contracts/worlds/operations";
import { Deferred, Effect, Fiber, Result, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import {
  http,
  jsonBody,
  responseCookie,
  withLegacyBasisHarness,
} from "./harness.ts";

const json = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const envelope = { purpose: "personal-records", schemaVersion: "worlds.v1" };
const executePath = "/api/worlds/execute";
const validTime = {
  _tag: "DateInterval" as const,
  from: "2026-09-01",
  to: "2026-10-01",
};
const jsonDocument = (revision: string, amount: string) =>
  json({
    records: [
      {
        externalId: "invoice-a",
        predicate: "obligation.amount",
        subjectKey: "invoice-a",
        validTime,
        value: { _tag: "Known", amount, currency: "BRL" },
      },
    ],
    schemaVersion: "worlds.v1",
    source: {
      externalId: "billing-json",
      label: "JSON source",
      namespace: "independent-concurrency",
      revision,
    },
  });

it.live(
  "independent: concurrent Answer vs identity cut bump yields one Stale and no partial apply",
  () =>
    withLegacyBasisHarness((harness) =>
      Effect.gen(function* refutePartialApply() {
        const signup = yield* http(
          harness.origin,
          "/api/auth/sign-up/email",
          json({
            email: `${randomUUID()}@example.test`,
            name: "Concurrency owner",
            password: randomBytes(24).toString("base64url"),
          })
        );
        expect(signup.status).toBe(200);
        const owner = responseCookie(signup);
        const createdResponse = yield* http(
          harness.origin,
          executePath,
          json({
            ...envelope,
            input: {},
            operation: "CreatePersonalWorld",
            operationId: randomUUID(),
          }),
          owner
        );
        expect(createdResponse.status).toBe(200);
        const { worldRef } = yield* jsonBody(createdResponse).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(WorldCreated))
        );
        const imported = yield* http(
          harness.origin,
          executePath,
          json({
            ...envelope,
            input: { document: jsonDocument("1", "100.00") },
            operation: "ImportEvidence",
            operationId: randomUUID(),
            worldRef,
          }),
          owner
        );
        expect(imported.status).toBe(200);
        yield* jsonBody(imported).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(EvidenceImported))
        );

        const { runtime } = yield* harness.transitionToCurrentComponent();

        return yield* Effect.scoped(
          Effect.gen(function* withCurrentExecutor() {
            const executor = yield* SemanticExecutor;
            const sql = yield* SqlClient.SqlClient;
            const bytes = (value: unknown) =>
              canonicalJson(value).pipe(
                Effect.map((text) => new TextEncoder().encode(text))
              );

            const inspected = yield* executor
              .execute(
                owner,
                yield* bytes({
                  ...envelope,
                  input: { atFrame: null, subjectKey: "invoice-a" },
                  operation: "Inspect",
                  worldRef,
                })
              )
              .pipe(Effect.flatMap(Schema.decodeUnknownEffect(FrameInspected)));
            const selected = inspected.frame.claims.find(
              (claim) => claim.recordId === "invoice-a"
            );
            if (selected === undefined) {
              return yield* Effect.die("Expected claim");
            }
            const proposed = yield* executor
              .executeCorrection(
                owner,
                yield* bytes({
                  ...envelope,
                  input: {
                    consequence: {
                      choice: {
                        _tag: "selectClaim",
                        claimRef: selected.claimRef,
                      },
                      subjectKey: "invoice-a",
                      validTime,
                    },
                    frameRef: inspected.frame.frameRef,
                  },
                  operation: "ProposeCorrection",
                  operationId: randomUUID(),
                  worldRef,
                })
              )
              .pipe(
                Effect.flatMap(Schema.decodeUnknownEffect(CorrectionProposed))
              );

            const countsBefore = yield* sql`
              SELECT
                (SELECT count(*)::int FROM authority.cases WHERE world_id = ${worldRef.worldId}::uuid) AS cases,
                (SELECT count(*)::int FROM authority.corrections WHERE world_id = ${worldRef.worldId}::uuid) AS events,
                (SELECT count(*)::int FROM authority.receipts WHERE world_id = ${worldRef.worldId}::uuid) AS receipts,
                (SELECT version::text FROM authority.domains WHERE world_id = ${worldRef.worldId}::uuid AND domain_key = 'identity') AS identity`;

            const gate = yield* Deferred.make<null>();
            const answering = yield* Effect.gen(function* raceAnswer() {
              yield* Deferred.await(gate);
              return yield* executor
                .executeCorrection(
                  owner,
                  yield* bytes({
                    ...envelope,
                    input: {
                      answer: "confirm",
                      consequenceDigest: proposed.consequenceDigest,
                      questionRef: proposed.questionRef,
                    },
                    operation: "AnswerQuestion",
                    operationId: randomUUID(),
                    worldRef,
                  })
                )
                .pipe(Effect.result);
            }).pipe(Effect.forkScoped);
            const bumping = yield* Effect.gen(function* raceBump() {
              yield* Deferred.await(gate);
              yield* sql`
                UPDATE authority.domains
                SET version = version + 1
                WHERE world_id = ${worldRef.worldId}::uuid
                  AND domain_key = 'identity'`;
            }).pipe(Effect.forkScoped);
            yield* Deferred.succeed(gate, null);
            const answerResult = yield* Fiber.join(answering);
            yield* Fiber.join(bumping);

            const countsAfter = yield* sql`
              SELECT
                (SELECT count(*)::int FROM authority.corrections WHERE world_id = ${worldRef.worldId}::uuid) AS events,
                (SELECT count(*)::int FROM authority.receipts WHERE world_id = ${worldRef.worldId}::uuid) AS receipts,
                (SELECT version::text FROM authority.domains WHERE world_id = ${worldRef.worldId}::uuid AND domain_key = 'identity') AS identity,
                (SELECT state FROM authority.cases WHERE world_id = ${worldRef.worldId}::uuid AND case_id = ${proposed.caseRef}::uuid) AS case_state`;

            expect(BigInt(String(countsAfter[0]?.identity))).toBe(
              BigInt(String(countsBefore[0]?.identity)) + 1n
            );
            if (Result.isSuccess(answerResult)) {
              yield* Schema.decodeUnknownEffect(CorrectionApplied)(
                answerResult.success
              );
              expect(countsAfter[0]?.case_state).toBe("applied");
              expect(Number(countsAfter[0]?.events)).toBe(
                Number(countsBefore[0]?.events) + 1
              );
            } else {
              expect(answerResult.failure).toMatchObject({ _tag: "Stale" });
              expect(countsAfter[0]?.case_state).toBe("proposed");
              expect(countsAfter[0]?.events).toBe(countsBefore[0]?.events);
              expect(countsAfter[0]?.receipts).toBe(countsBefore[0]?.receipts);
            }

            const again = yield* executor
              .execute(
                owner,
                yield* bytes({
                  ...envelope,
                  input: { atFrame: null, subjectKey: "invoice-a" },
                  operation: "Inspect",
                  worldRef,
                })
              )
              .pipe(Effect.flatMap(Schema.decodeUnknownEffect(FrameInspected)));
            const againSelected = again.frame.claims.find(
              (claim) => claim.recordId === "invoice-a"
            );
            if (againSelected === undefined) {
              return yield* Effect.die("Expected claim for second race");
            }
            const pending = yield* executor
              .executeCorrection(
                owner,
                yield* bytes({
                  ...envelope,
                  input: {
                    consequence: {
                      choice: {
                        _tag: "selectClaim",
                        claimRef: againSelected.claimRef,
                      },
                      subjectKey: "invoice-a",
                      validTime,
                    },
                    frameRef: again.frame.frameRef,
                  },
                  operation: "ProposeCorrection",
                  operationId: randomUUID(),
                  worldRef,
                })
              )
              .pipe(
                Effect.flatMap(Schema.decodeUnknownEffect(CorrectionProposed))
              );
            const beforeSecond = yield* sql`
              SELECT
                (SELECT count(*)::int FROM authority.corrections WHERE world_id = ${worldRef.worldId}::uuid) AS events,
                (SELECT count(*)::int FROM authority.receipts WHERE world_id = ${worldRef.worldId}::uuid) AS receipts,
                (SELECT version::text FROM authority.domains WHERE world_id = ${worldRef.worldId}::uuid AND domain_key = 'claims') AS claims`;

            const gate2 = yield* Deferred.make<null>();
            const answerFiber = yield* Effect.gen(function* raceAnswer2() {
              yield* Deferred.await(gate2);
              return yield* executor
                .executeCorrection(
                  owner,
                  yield* bytes({
                    ...envelope,
                    input: {
                      answer: "confirm",
                      consequenceDigest: pending.consequenceDigest,
                      questionRef: pending.questionRef,
                    },
                    operation: "AnswerQuestion",
                    operationId: randomUUID(),
                    worldRef,
                  })
                )
                .pipe(Effect.result);
            }).pipe(Effect.forkScoped);
            const importFiber = yield* Effect.gen(function* raceImport() {
              yield* Deferred.await(gate2);
              return yield* executor
                .execute(
                  owner,
                  yield* bytes({
                    ...envelope,
                    input: { document: jsonDocument("2", "110.00") },
                    operation: "ImportEvidence",
                    operationId: randomUUID(),
                    worldRef,
                  })
                )
                .pipe(Effect.result);
            }).pipe(Effect.forkScoped);
            yield* Deferred.succeed(gate2, null);
            const answerOutcome = yield* Fiber.join(answerFiber);
            const importOutcome = yield* Fiber.join(importFiber);
            expect(Result.isSuccess(importOutcome)).toBeTruthy();
            if (Result.isSuccess(importOutcome)) {
              yield* Schema.decodeUnknownEffect(EvidenceImported)(
                importOutcome.success
              );
            }
            const afterSecond = yield* sql`
              SELECT
                (SELECT count(*)::int FROM authority.corrections WHERE world_id = ${worldRef.worldId}::uuid) AS events,
                (SELECT count(*)::int FROM authority.receipts WHERE world_id = ${worldRef.worldId}::uuid) AS receipts,
                (SELECT version::text FROM authority.domains WHERE world_id = ${worldRef.worldId}::uuid AND domain_key = 'claims') AS claims,
                (SELECT state FROM authority.cases WHERE world_id = ${worldRef.worldId}::uuid AND case_id = ${pending.caseRef}::uuid) AS case_state`;
            expect(BigInt(String(afterSecond[0]?.claims))).toBeGreaterThan(
              BigInt(String(beforeSecond[0]?.claims))
            );
            if (Result.isFailure(answerOutcome)) {
              expect(answerOutcome.failure).toMatchObject({ _tag: "Stale" });
              expect(afterSecond[0]?.case_state).toBe("proposed");
            } else {
              expect(afterSecond[0]?.case_state).toBe("applied");
            }
            expect(
              Number(afterSecond[0]?.receipts) -
                Number(beforeSecond[0]?.receipts)
            ).toBeGreaterThanOrEqual(1);

            return {
              firstAnswer: Result.isSuccess(answerResult) ? "applied" : "stale",
              oracles: ["answer-vs-identity-bump", "answer-vs-import-claims"],
              revision: harness.legacy.revision,
              secondAnswer: Result.isSuccess(answerOutcome)
                ? "applied"
                : "stale",
            };
          }).pipe(Effect.provide(runtime))
        );
      }).pipe(Effect.provide(harness.database.authority))
    ),
  300_000
);
