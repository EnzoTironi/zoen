import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { Presence } from "@zoen/authority/ports/worlds/context";
import { SemanticExecutor } from "@zoen/authority/semantic/executor";
import { canonicalJson } from "@zoen/authority/values/canonical";
import { Deferred, Effect, Fiber, Layer } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { configuration } from "../../../../../tests/integration/worlds/commit/fixture.ts";
import { withStorage } from "../../adapters/object-storage/worlds/fixture.ts";
import { withIdentityDatabase } from "./database.ts";
import { createAccount, postAuth } from "./http.ts";

it.live(
  "EX09 logout during a real SQL wait withholds the committed result at pre-emission",
  () =>
    withIdentityDatabase((fixture) =>
      withStorage(() =>
        Effect.gen(function* preEmission() {
          const executor = yield* SemanticExecutor;
          const presence = yield* Presence;
          const account = yield* createAccount(fixture.config.baseUrl);
          const verified = yield* presence.verify(account.credential);
          const operationId = randomUUID();
          const bytes = new TextEncoder().encode(
            yield* canonicalJson({
              input: {},
              operation: "CreatePersonalWorld",
              operationId,
              purpose: "personal-records",
              schemaVersion: "worlds.v1",
            })
          );
          const sql = yield* SqlClient.SqlClient;
          const held = yield* Deferred.make<null>();
          const release = yield* Deferred.make<null>();
          const lockKey = `genesis:${verified.principalId}:${operationId}`;
          const holder = yield* Effect.forkScoped(
            sql.withTransaction(
              Effect.gen(function* holdLock() {
                yield* sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
                yield* Deferred.succeed(held, null);
                yield* Deferred.await(release);
              })
            )
          );
          yield* Deferred.await(held);
          const pending = yield* Effect.forkScoped(
            executor.execute(account.credential, bytes).pipe(Effect.result)
          );
          yield* Effect.gen(function* revokeWhileWaiting() {
            let waiting = false;
            for (let attempt = 0; attempt < 40 && !waiting; attempt += 1) {
              const rows =
                yield* sql`SELECT EXISTS (SELECT FROM pg_locks WHERE locktype = 'advisory' AND NOT granted AND database = (SELECT oid FROM pg_database WHERE datname = current_database())) AS waiting`;
              waiting = rows[0]?.waiting === true;
              if (!waiting) {
                yield* Effect.sleep("25 millis");
              }
            }
            expect(waiting).toBeTruthy();
            const loggedOut = yield* postAuth(
              fixture.config.baseUrl,
              "sign-out",
              {},
              account.credential
            );
            expect(loggedOut.status).toBe(200);
          }).pipe(Effect.ensuring(Deferred.succeed(release, null)));
          yield* Fiber.join(holder);
          expect(yield* Fiber.join(pending)).toMatchObject({
            _tag: "Failure",
            failure: { _tag: "Unauthenticated", code: "PRESENCE_REQUIRED" },
          });
          expect(
            yield* sql`SELECT (SELECT count(*)::integer FROM authority.worlds) AS worlds, (SELECT count(*)::integer FROM authority.receipts) AS receipts`
          ).toStrictEqual([{ receipts: 1, worlds: 1 }]);
        }).pipe(
          Effect.provide(
            SemanticExecutor.layer.pipe(
              Layer.provideMerge(
                Layer.mergeAll(
                  configuration,
                  fixture.database.authority,
                  fixture.runtime
                )
              )
            )
          )
        )
      )
    )
);
