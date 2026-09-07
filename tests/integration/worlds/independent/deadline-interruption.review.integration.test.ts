import { describe, expect, it } from "@effect/vitest";
import { DateTime, Deferred, Effect, Fiber, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withD01Database } from "../../../../apps/server/test/adapters/postgres/worlds/database.js";
import { createPersonalWorld } from "../../../../packages/authority/src/commit/genesis.js";
import { VerifiedRequestContext } from "../../../../packages/authority/src/ports/worlds/context.js";
import { configuration, makeInput } from "../commit/fixture.js";

describe("independent EX05 deadline interruption review", () => {
  it.live(
    "finishes expired SQL wait while the conflicting lock remains held",
    () =>
      withD01Database((database) =>
        Effect.scoped(
          Effect.gen(function* expiredWhileWaiting() {
            const sql = yield* SqlClient.SqlClient;
            const { context, request } = yield* makeInput();
            const shortContext = yield* Schema.decodeEffect(
              VerifiedRequestContext
            )({
              ...context,
              deadline: DateTime.formatIso(
                DateTime.add(yield* DateTime.now, { seconds: 2 })
              ),
            });
            const held = yield* Deferred.make<null>();
            const release = yield* Deferred.make<null>();
            const lockKey = `genesis:${context.presence.principalId}:${request.operationId}`;
            const holder = yield* Effect.forkScoped(
              sql.withTransaction(
                Effect.gen(function* holdRealLock() {
                  yield* sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
                  yield* Deferred.succeed(held, null);
                  yield* Deferred.await(release);
                })
              )
            );
            yield* Deferred.await(held);
            const pending = yield* Effect.forkScoped(
              createPersonalWorld(shortContext, request).pipe(Effect.result)
            );
            let waiting = false;
            for (let attempt = 0; attempt < 20 && !waiting; attempt += 1) {
              const rows =
                yield* sql`SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND NOT granted AND database = (SELECT oid FROM pg_database WHERE datname = current_database())) AS waiting`;
              waiting = rows[0]?.waiting === true;
              if (!waiting) {
                yield* Effect.sleep("25 millis");
              }
            }
            expect(waiting).toBeTruthy();
            yield* Effect.sleep("2200 millis");
            expect(pending.pollUnsafe()).toBeDefined();
            yield* Deferred.succeed(release, null);
            yield* Fiber.join(holder);
            const outcome = yield* Fiber.join(pending);
            expect(outcome).toMatchObject({
              _tag: "Failure",
              failure: { _tag: "Expired" },
            });
            const rows =
              yield* sql`SELECT (SELECT count(*)::int FROM authority.worlds) AS worlds, (SELECT count(*)::int FROM authority.receipts) AS receipts, (SELECT count(*)::int FROM jobs.outbox) AS outbox`;
            expect(rows).toStrictEqual([{ outbox: 0, receipts: 0, worlds: 0 }]);
          })
        ).pipe(
          Effect.provide(Layer.mergeAll(configuration, database.authority))
        )
      )
  );
});
