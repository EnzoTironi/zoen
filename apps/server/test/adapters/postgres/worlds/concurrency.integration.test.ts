import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { Deferred, Effect, Exit, Fiber, Result, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withD01Database } from "./database.ts";
import { claimRow, seedEvidence } from "./seed.ts";

it.live(
  "D01 repeatable read keeps head, membership and predicates on one cut across a concurrent commit",
  () =>
    withD01Database((database) =>
      Effect.gen(function* snapshots() {
        const sql = yield* SqlClient.SqlClient;
        // READ COMMITTED is the negative control: this exact interleaving tears its cut.
        for (const repeatable of [false, true]) {
          const seed = yield* seedEvidence();
          const headRead = yield* Deferred.make<null>();
          const writerCommitted = yield* Deferred.make<null>();
          const reader = yield* sql
            .withTransaction(
              Effect.gen(function* readCut() {
                if (repeatable) {
                  yield* sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ`;
                }
                const head =
                  yield* sql`SELECT security_revision FROM authority.worlds WHERE world_id = ${seed.worldId} AND realm = ${seed.realm}`;
                yield* Deferred.succeed(headRead, null);
                yield* Deferred.await(writerCommitted);
                const membership =
                  yield* sql`SELECT state, revision FROM authority.memberships WHERE world_id = ${seed.worldId} AND realm = ${seed.realm} AND principal_id = ${seed.principal}`;
                const predicates =
                  yield* sql`SELECT version FROM authority.domains WHERE world_id = ${seed.worldId} AND realm = ${seed.realm} AND domain_key = 'claims'`;
                return { head, membership, predicates };
              })
            )
            .pipe(Effect.forkChild);
          yield* Deferred.await(headRead);
          yield* sql.withTransaction(
            Effect.gen(function* changeAuthorization() {
              yield* sql`UPDATE authority.worlds SET security_revision = 1 WHERE world_id = ${seed.worldId} AND realm = ${seed.realm}`;
              yield* sql`UPDATE authority.memberships SET state = 'revoked', revision = 1 WHERE world_id = ${seed.worldId} AND realm = ${seed.realm}`;
              yield* sql`UPDATE authority.domains SET version = 1 WHERE world_id = ${seed.worldId} AND realm = ${seed.realm}`;
            })
          );
          yield* Deferred.succeed(writerCommitted, null);
          const observed = yield* Fiber.join(reader);
          expect(observed).toStrictEqual({
            head: [{ security_revision: "0" }],
            membership: [
              {
                revision: repeatable ? "0" : "1",
                state: repeatable ? "active" : "revoked",
              },
            ],
            predicates: [{ version: repeatable ? "0" : "1" }],
          });
          expect(
            yield* sql`SELECT security_revision FROM authority.worlds WHERE world_id = ${seed.worldId} AND realm = ${seed.realm}`
          ).toStrictEqual([{ security_revision: "1" }]);
        }
      }).pipe(Effect.provide(database.authority))
    )
);

it.live(
  "D01 concurrent physical identity collision commits one claim and rolls back the losing transaction",
  () =>
    withD01Database((database) =>
      Effect.gen(function* collision() {
        const sql = yield* SqlClient.SqlClient;
        const seed = yield* seedEvidence();
        const row = claimRow(seed);
        const firstReady = yield* Deferred.make<number>();
        const secondReady = yield* Deferred.make<number>();
        const start = yield* Deferred.make<null>();
        const contend = (ready: Deferred.Deferred<number>) =>
          sql
            .withTransaction(
              Effect.gen(function* transaction() {
                const [connection] =
                  yield* sql`SELECT pg_backend_pid() AS pid`.pipe(
                    Effect.flatMap(
                      Schema.decodeUnknownEffect(
                        Schema.Tuple([Schema.Struct({ pid: Schema.Finite })])
                      )
                    )
                  );
                yield* Deferred.succeed(ready, connection.pid);
                yield* Deferred.await(start);
                yield* sql`INSERT INTO authority.claims ${sql.insert({ ...row, claim_id: randomUUID() })}`;
                yield* sql`UPDATE authority.domains SET version = version + 1 WHERE world_id = ${seed.worldId} AND realm = ${seed.realm}`;
              })
            )
            .pipe(Effect.exit);
        const first = yield* contend(firstReady).pipe(Effect.forkChild);
        const second = yield* contend(secondReady).pipe(Effect.forkChild);
        const firstPid = yield* Deferred.await(firstReady);
        const secondPid = yield* Deferred.await(secondReady);
        expect(firstPid).not.toBe(secondPid);
        yield* Deferred.succeed(start, null);
        const results = [yield* Fiber.join(first), yield* Fiber.join(second)];
        expect(results.filter(Exit.isSuccess)).toHaveLength(1);
        const failure = results.find(Exit.isFailure);
        if (failure === undefined) {
          throw new Error("one contender must fail");
        }
        expect(Result.getOrThrow(Exit.findError(failure))).toMatchObject({
          _tag: "SqlError",
          reason: { _tag: "UniqueViolation" },
        });
        expect(
          yield* sql`SELECT external_id FROM authority.claims`
        ).toStrictEqual([{ external_id: row.external_id }]);
        expect(yield* sql`SELECT version FROM authority.domains`).toStrictEqual(
          [{ version: "1" }]
        );
      }).pipe(Effect.provide(database.authority))
    )
);
