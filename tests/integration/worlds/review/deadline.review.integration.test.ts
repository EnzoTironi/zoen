import { randomBytes, randomUUID } from "node:crypto";

import { NodeHttpClient } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import {
  DateTime,
  Deferred,
  Effect,
  Fiber,
  Redacted,
  Schema,
  Stream,
} from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { SqlClient } from "effect/unstable/sql";

import {
  http,
  jsonBody,
  responseCookie,
  withD01Http,
} from "../../../../apps/server/test/composition/worlds/fixture.js";
import { canonicalJson } from "../../../../packages/authority/src/values/canonical.js";

it.live(
  "independent EX10 HTTP deadline includes slow body delivery and rolls back the subsequent real lock wait",
  () =>
    withD01Http(({ database, origin }) =>
      Effect.scoped(
        Effect.gen(function* wholeHttpDeadline() {
          const signup = yield* http(
            origin,
            "/api/auth/sign-up/email",
            yield* canonicalJson({
              email: `${randomUUID()}@example.test`,
              name: "Deadline account",
              password: randomBytes(24).toString("base64url"),
            })
          );
          const identity = yield* jsonBody(signup).pipe(
            Effect.flatMap(
              Schema.decodeUnknownEffect(
                Schema.Struct({
                  user: Schema.Struct({
                    id: Schema.String.check(Schema.isUUID()),
                  }),
                })
              )
            )
          );
          const operationId = randomUUID();
          const held = yield* Deferred.make<null>();
          const release = yield* Deferred.make<null>();
          yield* Effect.acquireRelease(Effect.void, () =>
            Deferred.succeed(release, null)
          );
          const sql = yield* SqlClient.SqlClient;
          const holder = yield* Effect.forkScoped(
            sql.withTransaction(
              Effect.gen(function* holdGenesisLock() {
                const key = `genesis:${identity.user.id}:${operationId}`;
                yield* sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
                yield* Deferred.succeed(held, null);
                yield* Deferred.await(release);
              })
            )
          );
          yield* Deferred.await(held);
          const content = new TextEncoder().encode(
            yield* canonicalJson({
              input: {},
              operation: "CreatePersonalWorld",
              operationId,
              purpose: "personal-records",
              schemaVersion: "worlds.v1",
            })
          );
          const body = Stream.concat(
            Stream.make(content.slice(0, 1)),
            Stream.fromEffect(
              Effect.sleep("28 seconds").pipe(Effect.as(content.slice(1)))
            )
          );
          const start = DateTime.toEpochMillis(yield* DateTime.now);
          const pending = yield* Effect.forkScoped(
            HttpClient.HttpClient.use((client) =>
              client
                .execute(
                  HttpClientRequest.post(`${origin}/api/worlds/execute`).pipe(
                    HttpClientRequest.bodyStream(body, {
                      contentType: "application/json",
                    }),
                    HttpClientRequest.setHeaders({
                      cookie: Redacted.value(responseCookie(signup)),
                      origin,
                    })
                  )
                )
                .pipe(
                  Effect.flatMap((response) =>
                    response.json.pipe(
                      Effect.map((responseBody) => ({
                        body: responseBody,
                        status: response.status,
                      }))
                    )
                  )
                )
            ).pipe(Effect.provide(NodeHttpClient.layerNodeHttp))
          );
          yield* Effect.sleep("28500 millis");
          const [lock] =
            yield* sql`SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND NOT granted AND database = (SELECT oid FROM pg_database WHERE datname = current_database())) AS waiting`;
          expect(lock?.waiting).toBeTruthy();
          const outcome = yield* Fiber.join(pending);
          const elapsed = DateTime.toEpochMillis(yield* DateTime.now) - start;
          yield* Deferred.succeed(release, null);
          yield* Fiber.join(holder);
          expect(outcome).toStrictEqual({
            body: { _tag: "Expired", code: "EXPIRED" },
            status: 410,
          });
          expect(elapsed).toBeLessThan(33_000);
          expect(
            yield* sql`SELECT (SELECT count(*)::int FROM authority.worlds) AS worlds, (SELECT count(*)::int FROM authority.receipts) AS receipts, (SELECT count(*)::int FROM jobs.outbox) AS outbox`
          ).toStrictEqual([{ outbox: 0, receipts: 0, worlds: 0 }]);
        })
      ).pipe(Effect.provide(database.authority))
    ),
  40_000
);
