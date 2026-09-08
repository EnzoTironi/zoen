import { expect, it } from "@effect/vitest";
import { Deferred, Effect, Layer, Queue, Ref } from "effect";
import { SqlClient } from "effect/unstable/sql";
import type { SqlError } from "effect/unstable/sql/SqlError";

import { withWorldsDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.js";
import { createPersonalWorld } from "../../../../packages/ontology/src/commit/genesis.js";
import { serializable } from "../../../../packages/ontology/src/commit/transaction.js";
import { configuration, makeInput } from "./fixture.js";

it.live(
  "EX05 a real outbox constraint failure rolls back all genesis state and its receipt",
  () =>
    withWorldsDatabase((database) =>
      Effect.gen(function* outboxFailure() {
        yield* Effect.gen(function* rejectOutboxEvent() {
          const sql = yield* SqlClient.SqlClient;
          yield* sql`ALTER TABLE jobs.outbox ADD CONSTRAINT ex05_fault CHECK (event_kind <> 'semantic-committed')`;
        }).pipe(Effect.provide(database.migration));
        yield* Effect.gen(function* runFailedGenesis() {
          const { context, request } = yield* makeInput();
          const failure = yield* createPersonalWorld(context, request).pipe(
            Effect.flip
          );
          expect(failure).toMatchObject({
            _tag: "Unavailable",
            code: "UNAVAILABLE",
          });
          const sql = yield* SqlClient.SqlClient;
          expect(
            yield* sql`
        SELECT
          (SELECT count(*)::int FROM authority.worlds) AS worlds,
          (SELECT count(*)::int FROM authority.memberships) AS memberships,
          (SELECT count(*)::int FROM authority.domains) AS domains,
          (SELECT count(*)::int FROM authority.receipts) AS receipts,
          (SELECT count(*)::int FROM jobs.outbox) AS outbox,
          (SELECT count(*)::int FROM authority.bootstrap_operations) AS operations
      `
          ).toStrictEqual([
            {
              domains: 0,
              memberships: 0,
              operations: 0,
              outbox: 0,
              receipts: 0,
              worlds: 0,
            },
          ]);
        }).pipe(
          Effect.provide(Layer.mergeAll(configuration, database.authority))
        );
      })
    )
);

it.live(
  "EX05 three real serialization conflicts exhaust exactly three total attempts",
  () =>
    withWorldsDatabase((database) =>
      Effect.scoped(
        Effect.gen(function* serializationLimit() {
          const { context, request } = yield* makeInput();
          const created = yield* createPersonalWorld(context, request);
          const sql = yield* SqlClient.SqlClient;
          const barriers = yield* Queue.unbounded<Deferred.Deferred<boolean>>();
          const attempts = yield* Ref.make(0);
          yield* Effect.forkScoped(
            Effect.forever(
              Effect.gen(function* conflictingWriter() {
                const done = yield* Queue.take(barriers);
                yield* sql`UPDATE authority.worlds SET security_revision = security_revision + 1
        WHERE world_id = ${created.worldRef.worldId} AND realm = 'live'`;
                yield* Deferred.succeed(done, true);
              })
            )
          );
          const failure = yield* serializable(
            Effect.gen(function* losingTransaction() {
              yield* Ref.update(attempts, (count) => count + 1);
              const isolation = yield* sql`SHOW transaction_isolation`;
              expect(isolation).toStrictEqual([
                { transaction_isolation: "serializable" },
              ]);
              yield* sql`SELECT security_revision FROM authority.worlds WHERE world_id = ${created.worldRef.worldId} AND realm = 'live'`;
              const changed = yield* Deferred.make<boolean>();
              yield* Queue.offer(barriers, changed);
              yield* Deferred.await(changed);
              yield* sql`UPDATE authority.worlds SET emergency_deny = true
        WHERE world_id = ${created.worldRef.worldId} AND realm = 'live'`;
            })
          ).pipe(Effect.flip);
          expect(failure).toMatchObject({
            _tag: "RetryableInfrastructureFailure",
            code: "RETRYABLE_INFRASTRUCTURE_FAILURE",
          });
          expect(yield* Ref.get(attempts)).toBe(3);
          expect(
            yield* sql`SELECT emergency_deny, security_revision::int FROM authority.worlds WHERE world_id = ${created.worldRef.worldId} AND realm = 'live'`
          ).toStrictEqual([{ emergency_deny: false, security_revision: 3 }]);
        })
      ).pipe(Effect.provide(Layer.mergeAll(configuration, database.authority)))
    )
);

it.live(
  "EX05 a real SQL expression failure is never retried and exposes no SQL detail",
  () =>
    withWorldsDatabase((database) =>
      Effect.gen(function* nonRetryableSql() {
        const sql = yield* SqlClient.SqlClient;
        const attempts = yield* Ref.make(0);
        const error = yield* serializable(
          Effect.gen(function* invalidExpression() {
            yield* Ref.update(attempts, (count) => count + 1);
            return yield* sql`SELECT 1 / 0`;
          })
        ).pipe(Effect.flip);
        expect(error).toMatchObject({
          _tag: "Unavailable",
          code: "UNAVAILABLE",
        });
        expect(Object.keys(error).toSorted()).toStrictEqual(["_tag", "code"]);
        expect(yield* Ref.get(attempts)).toBe(1);
      }).pipe(Effect.provide(database.authority))
    )
);

it.live(
  "EX05 a deferred FK failure at COMMIT remains a safe typed failure",
  () =>
    withWorldsDatabase((database) =>
      Effect.gen(function* deferredCommitFailure() {
        const { context, request } = yield* makeInput();
        const sql = yield* SqlClient.SqlClient;
        const error = yield* serializable(sql`
      INSERT INTO authority.bootstrap_operations
        (principal_id, operation_id, semantic_operation, intent_digest, world_id, realm, receipt_id)
      VALUES (${context.presence.principalId}, ${request.operationId}, 'CreatePersonalWorld',
        ${"1".repeat(64)}, ${request.operationId}, 'live', ${request.operationId})
    `).pipe(Effect.flip);
        expect(error).toMatchObject({
          _tag: "Unavailable",
          code: "UNAVAILABLE",
        });
        expect(
          yield* sql`SELECT count(*)::int AS count FROM authority.bootstrap_operations`
        ).toStrictEqual([{ count: 0 }]);
      }).pipe(Effect.provide(database.authority))
    )
);

it.live(
  "EX05 a write-skew conflict raised only at COMMIT retries the same transaction",
  () =>
    withWorldsDatabase((database) =>
      Effect.scoped(
        Effect.gen(function* commitSerialization() {
          const firstInput = yield* makeInput();
          const secondInput = yield* makeInput();
          const first = yield* createPersonalWorld(
            firstInput.context,
            firstInput.request
          );
          const second = yield* createPersonalWorld(
            secondInput.context,
            secondInput.request
          );
          const sql = yield* SqlClient.SqlClient;
          const startOther = yield* Deferred.make<boolean>();
          const otherWrote = yield* Deferred.make<boolean>();
          const firstWrote = yield* Deferred.make<boolean>();
          const otherCommitted = yield* Deferred.make<boolean, SqlError>();
          const attempts = yield* Ref.make(0);
          const bodiesCompleted = yield* Ref.make(0);
          yield* Effect.forkScoped(
            Deferred.complete(
              otherCommitted,
              Deferred.await(startOther).pipe(
                Effect.andThen(
                  sql.withTransaction(
                    Effect.gen(function* otherSerializableTransaction() {
                      yield* sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`;
                      yield* sql`SELECT security_revision FROM authority.worlds WHERE world_id = ${first.worldRef.worldId} AND realm = 'live'`;
                      yield* sql`UPDATE authority.worlds SET security_revision = security_revision + 1 WHERE world_id = ${second.worldRef.worldId} AND realm = 'live'`;
                      yield* Deferred.succeed(otherWrote, true);
                      return yield* Deferred.await(firstWrote);
                    })
                  )
                )
              )
            )
          );
          yield* serializable(
            Effect.gen(function* retriedBody() {
              const attempt = yield* Ref.updateAndGet(
                attempts,
                (count) => count + 1
              );
              yield* sql`SELECT security_revision FROM authority.worlds WHERE world_id = ${second.worldRef.worldId} AND realm = 'live'`;
              if (attempt === 1) {
                yield* Deferred.succeed(startOther, true);
                yield* Deferred.await(otherWrote);
              }
              yield* sql`UPDATE authority.worlds SET security_revision = security_revision + 1 WHERE world_id = ${first.worldRef.worldId} AND realm = 'live'`;
              if (attempt === 1) {
                yield* Deferred.succeed(firstWrote, true);
                yield* Deferred.await(otherCommitted);
              }
              yield* Ref.update(bodiesCompleted, (count) => count + 1);
            })
          );
          expect(yield* Ref.get(attempts)).toBe(2);
          expect(yield* Ref.get(bodiesCompleted)).toBe(2);
          expect(
            yield* sql`SELECT security_revision::int FROM authority.worlds WHERE world_id = ${first.worldRef.worldId} AND realm = 'live'`
          ).toStrictEqual([{ security_revision: 1 }]);
        })
      ).pipe(Effect.provide(Layer.mergeAll(configuration, database.authority)))
    )
);
