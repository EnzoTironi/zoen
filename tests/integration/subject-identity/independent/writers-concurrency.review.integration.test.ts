/* oxlint-disable eslint/complexity */
import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { SemanticExecutor } from "@zoen/authority/semantic/executor";
import { canonicalJson } from "@zoen/authority/values/canonical";
import { EvidenceImported, WorldCreated } from "@zoen/contracts/d01/operations";
import {
  IdentityProposed,
  IdentityResolved,
  SubjectIdentityInspected,
} from "@zoen/contracts/subject-identity/operations";
import { Deferred, Effect, Fiber, Layer, Result, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { layer as s3EvidenceLayer } from "../../../../apps/server/src/adapters/object-storage/d01/s3.js";
import { withStorage } from "../../../../apps/server/test/adapters/object-storage/d01/fixture.js";
import { withD01IdentityDatabase } from "../../../../apps/server/test/identity/d01/database.js";
import {
  createAccount,
  postAuth,
} from "../../../../apps/server/test/identity/d01/http.js";
import { configuration } from "../../d01/commit/fixture.js";

const bytes = (value: unknown) =>
  canonicalJson(value).pipe(
    Effect.map((json) => new TextEncoder().encode(json))
  );

const d01 = {
  purpose: "personal-records" as const,
  schemaVersion: "d01.v1" as const,
};
const envelope = {
  purpose: "personal-records" as const,
  schemaVersion: "subject-identity.v1" as const,
};

const documentFor = (
  subjects: readonly { key: string; amount: string }[],
  revision: string
) =>
  canonicalJson({
    records: subjects.map((subject) => ({
      externalId: `row-${subject.key}`,
      predicate: "obligation.amount",
      subjectKey: subject.key,
      validTime: {
        _tag: "DateInterval",
        from: "2026-09-01",
        to: "2026-10-01",
      },
      value: { _tag: "Known", amount: subject.amount, currency: "BRL" },
    })),
    schemaVersion: "d01.v1",
    source: {
      externalId: `billing-${revision}`,
      label: `Billing ${revision}`,
      namespace: "subject-identity-concurrency",
      revision,
    },
  });

/** ID-08 concurrency: ResolveIdentity vs identity cut bump / ImportEvidence — no partial apply. */
it.live(
  "independent: concurrent ResolveIdentity vs identity bump or ImportEvidence yields Stale without partial decision",
  () =>
    withD01IdentityDatabase((fixture) =>
      withStorage(({ config: storage }) =>
        Effect.gen(function* identityWriterConcurrency() {
          const account = yield* createAccount(fixture.config.baseUrl);
          const executor = yield* SemanticExecutor;
          const created = yield* executor
            .execute(
              account.credential,
              yield* bytes({
                ...d01,
                input: {},
                operation: "CreatePersonalWorld",
                operationId: randomUUID(),
              })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(WorldCreated)));
          const { worldRef } = created;
          yield* executor.execute(
            account.credential,
            yield* bytes({
              ...d01,
              input: {
                document: yield* documentFor(
                  [
                    { amount: "100", key: "A" },
                    { amount: "120", key: "B" },
                    { amount: "130", key: "C" },
                  ],
                  "1"
                ),
              },
              operation: "ImportEvidence",
              operationId: randomUUID(),
              worldRef,
            })
          );

          const inspected = yield* executor
            .executeSubjectIdentity(
              account.credential,
              yield* bytes({
                ...envelope,
                input: {
                  anchors: ["A", "B"],
                  atFrame: null,
                  interval: {
                    _tag: "DateInterval",
                    from: "2026-09-01",
                    to: "2026-10-01",
                  },
                },
                operation: "InspectSubjectIdentity",
                worldRef,
              })
            )
            .pipe(
              Effect.flatMap(
                Schema.decodeUnknownEffect(SubjectIdentityInspected)
              )
            );
          const proposed = yield* executor
            .executeSubjectIdentity(
              account.credential,
              yield* bytes({
                ...envelope,
                input: {
                  frame: {
                    frameRef: inspected.frame.frameRef,
                    kind: "subject-identity",
                  },
                  left: "A",
                  right: "B",
                },
                operation: "ProposeIdentityResolution",
                operationId: randomUUID(),
                worldRef,
              })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(IdentityProposed)));

          const summary = yield* Effect.scoped(
            Effect.gen(function* raceScoped() {
              const sql = yield* SqlClient.SqlClient;
              const before = yield* sql`
                SELECT
                  (SELECT count(*)::int FROM authority.identity_decisions WHERE world_id = ${worldRef.worldId}::uuid) AS decisions,
                  (SELECT count(*)::int FROM authority.receipts WHERE world_id = ${worldRef.worldId}::uuid) AS receipts,
                  (SELECT version::text FROM authority.domains WHERE world_id = ${worldRef.worldId}::uuid AND domain_key = 'identity') AS identity,
                  (SELECT state FROM authority.cases WHERE world_id = ${worldRef.worldId}::uuid AND case_id = ${proposed.question.caseRef}::uuid) AS case_state`;

              const gate = yield* Deferred.make<null>();
              const resolving = yield* Effect.gen(function* raceResolve() {
                yield* Deferred.await(gate);
                return yield* executor
                  .executeSubjectIdentity(
                    account.credential,
                    yield* bytes({
                      ...envelope,
                      input: {
                        answer: "same-as",
                        consequenceDigest: proposed.question.consequenceDigest,
                        questionRef: proposed.question.questionRef,
                      },
                      operation: "ResolveIdentity",
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
              const resolveResult = yield* Fiber.join(resolving);
              yield* Fiber.join(bumping);

              const afterBump = yield* sql`
                SELECT
                  (SELECT count(*)::int FROM authority.identity_decisions WHERE world_id = ${worldRef.worldId}::uuid) AS decisions,
                  (SELECT count(*)::int FROM authority.receipts WHERE world_id = ${worldRef.worldId}::uuid) AS receipts,
                  (SELECT version::text FROM authority.domains WHERE world_id = ${worldRef.worldId}::uuid AND domain_key = 'identity') AS identity,
                  (SELECT state FROM authority.cases WHERE world_id = ${worldRef.worldId}::uuid AND case_id = ${proposed.question.caseRef}::uuid) AS case_state`;

              expect(BigInt(String(afterBump[0]?.identity))).toBeGreaterThan(
                BigInt(String(before[0]?.identity))
              );
              if (Result.isSuccess(resolveResult)) {
                const applied = yield* Schema.decodeUnknownEffect(
                  IdentityResolved
                )(resolveResult.success);
                expect(applied.outcome).toBe("applied");
                expect(afterBump[0]?.case_state).toBe("applied");
                expect(Number(afterBump[0]?.decisions)).toBe(
                  Number(before[0]?.decisions) + 1
                );
              } else {
                expect(resolveResult.failure).toMatchObject({ _tag: "Stale" });
                expect(afterBump[0]?.case_state).toBe("proposed");
                expect(afterBump[0]?.decisions).toBe(before[0]?.decisions);
                expect(afterBump[0]?.receipts).toBe(before[0]?.receipts);
              }

              const withC = yield* executor
                .executeSubjectIdentity(
                  account.credential,
                  yield* bytes({
                    ...envelope,
                    input: {
                      anchors: ["A", "C"],
                      atFrame: null,
                      interval: {
                        _tag: "DateInterval",
                        from: "2026-09-01",
                        to: "2026-10-01",
                      },
                    },
                    operation: "InspectSubjectIdentity",
                    worldRef,
                  })
                )
                .pipe(
                  Effect.flatMap(
                    Schema.decodeUnknownEffect(SubjectIdentityInspected)
                  )
                );
              const pending = yield* executor
                .executeSubjectIdentity(
                  account.credential,
                  yield* bytes({
                    ...envelope,
                    input: {
                      frame: {
                        frameRef: withC.frame.frameRef,
                        kind: "subject-identity",
                      },
                      left: "A",
                      right: "C",
                    },
                    operation: "ProposeIdentityResolution",
                    operationId: randomUUID(),
                    worldRef,
                  })
                )
                .pipe(
                  Effect.flatMap(Schema.decodeUnknownEffect(IdentityProposed))
                );

              const beforeSecond = yield* sql`
                SELECT
                  (SELECT count(*)::int FROM authority.identity_decisions WHERE world_id = ${worldRef.worldId}::uuid) AS decisions,
                  (SELECT version::text FROM authority.domains WHERE world_id = ${worldRef.worldId}::uuid AND domain_key = 'claims') AS claims,
                  (SELECT state FROM authority.cases WHERE world_id = ${worldRef.worldId}::uuid AND case_id = ${pending.question.caseRef}::uuid) AS case_state`;

              const gate2 = yield* Deferred.make<null>();
              const resolveFiber = yield* Effect.gen(function* raceResolve2() {
                yield* Deferred.await(gate2);
                return yield* executor
                  .executeSubjectIdentity(
                    account.credential,
                    yield* bytes({
                      ...envelope,
                      input: {
                        answer: "same-as",
                        consequenceDigest: pending.question.consequenceDigest,
                        questionRef: pending.question.questionRef,
                      },
                      operation: "ResolveIdentity",
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
                    account.credential,
                    yield* bytes({
                      ...d01,
                      input: {
                        document: yield* documentFor(
                          [{ amount: "140", key: "D" }],
                          "2"
                        ),
                      },
                      operation: "ImportEvidence",
                      operationId: randomUUID(),
                      worldRef,
                    })
                  )
                  .pipe(Effect.result);
              }).pipe(Effect.forkScoped);
              yield* Deferred.succeed(gate2, null);
              const resolveOutcome = yield* Fiber.join(resolveFiber);
              const importOutcome = yield* Fiber.join(importFiber);
              expect(Result.isSuccess(importOutcome)).toBeTruthy();
              if (Result.isSuccess(importOutcome)) {
                yield* Schema.decodeUnknownEffect(EvidenceImported)(
                  importOutcome.success
                );
              }
              const afterSecond = yield* sql`
                SELECT
                  (SELECT count(*)::int FROM authority.identity_decisions WHERE world_id = ${worldRef.worldId}::uuid) AS decisions,
                  (SELECT version::text FROM authority.domains WHERE world_id = ${worldRef.worldId}::uuid AND domain_key = 'claims') AS claims,
                  (SELECT state FROM authority.cases WHERE world_id = ${worldRef.worldId}::uuid AND case_id = ${pending.question.caseRef}::uuid) AS case_state`;
              expect(BigInt(String(afterSecond[0]?.claims))).toBeGreaterThan(
                BigInt(String(beforeSecond[0]?.claims))
              );
              if (Result.isFailure(resolveOutcome)) {
                expect(resolveOutcome.failure).toMatchObject({ _tag: "Stale" });
                expect(afterSecond[0]?.case_state).toBe("proposed");
                expect(afterSecond[0]?.decisions).toBe(
                  beforeSecond[0]?.decisions
                );
              } else {
                const applied = yield* Schema.decodeUnknownEffect(
                  IdentityResolved
                )(resolveOutcome.success);
                expect(applied.outcome).toBe("applied");
                expect(afterSecond[0]?.case_state).toBe("applied");
                expect(Number(afterSecond[0]?.decisions)).toBe(
                  Number(beforeSecond[0]?.decisions) + 1
                );
              }

              return {
                first: Result.isSuccess(resolveResult) ? "applied" : "stale",
                oracles: [
                  "resolve-vs-identity-bump",
                  "resolve-vs-import-claims",
                ],
                second: Result.isSuccess(resolveOutcome) ? "applied" : "stale",
              };
            }).pipe(Effect.provide(fixture.database.authority))
          );

          yield* postAuth(
            fixture.config.baseUrl,
            "sign-out",
            {},
            account.credential
          );
          return summary;
        }).pipe(
          Effect.provide(
            Layer.provideMerge(
              SemanticExecutor.layer,
              Layer.mergeAll(
                configuration,
                fixture.runtime,
                fixture.database.authority,
                s3EvidenceLayer(storage)
              )
            )
          )
        )
      )
    )
);
