import { PgClient } from "@effect/sql-pg";
import { expect, it } from "@effect/vitest";
import { Presence } from "@zoen/authority/ports/d01/context";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { makeD01IdentityLayer } from "../../../src/identity/d01/identity.ts";
import { withD01IdentityDatabase } from "./database.ts";
import { createAccount } from "./http.ts";

it.live(
  "EX09 session expiration is enforced by the real provider and clock on the next verification",
  () =>
    withD01IdentityDatabase(
      (fixture) =>
        Effect.gen(function* expiry() {
          const presence = yield* Presence;
          const account = yield* createAccount(fixture.config.baseUrl);
          const before = yield* presence.verify(account.credential);
          yield* Effect.sleep("1200 millis");
          const after = yield* presence
            .verify(account.credential)
            .pipe(Effect.flip);
          expect({ after, principal: before.principalId }).toMatchObject({
            after: { _tag: "Unauthenticated", code: "PRESENCE_REQUIRED" },
            principal: account.user.id,
          });
        }).pipe(Effect.provide(fixture.runtime)),
      { sessionSeconds: 1 }
    )
);

it.live(
  "EX09 provider SQL denial remains closed Unavailable without a cached or offline session",
  () =>
    withD01IdentityDatabase((fixture) =>
      Effect.gen(function* deniedDatabase() {
        const presence = yield* Presence;
        const account = yield* createAccount(fixture.config.baseUrl);
        yield* presence.verify(account.credential);
        const role = yield* Effect.gen(function* runtimeName() {
          const sql = yield* SqlClient.SqlClient;
          const [row] = yield* sql`SELECT current_user AS name`.pipe(
            Effect.flatMap(
              Schema.decodeUnknownEffect(
                Schema.Tuple([Schema.Struct({ name: Schema.NonEmptyString })])
              )
            )
          );
          return row.name;
        }).pipe(Effect.provide(fixture.database.identity));
        yield* Effect.gen(function* revokeFixtureRead() {
          const sql = yield* SqlClient.SqlClient;
          yield* sql`REVOKE SELECT ON identity.session FROM ${sql(role)}`;
        }).pipe(Effect.provide(fixture.database.migration));
        const unavailable = yield* presence
          .verify(account.credential)
          .pipe(Effect.flip);
        expect(unavailable).toMatchObject({
          _tag: "Unavailable",
          code: "UNAVAILABLE",
        });
        expect(Object.keys(unavailable).toSorted()).toStrictEqual([
          "_tag",
          "code",
        ]);
      }).pipe(Effect.provide(fixture.runtime))
    )
);

it.live(
  "EX09 identity startup refuses authority and progress credentials even though they are valid runtime roles",
  () =>
    withD01IdentityDatabase((fixture) =>
      Effect.gen(function* credentials() {
        for (const profile of [
          fixture.database.authority,
          fixture.database.progress,
        ]) {
          const url = yield* PgClient.PgClient.use((pg) =>
            Effect.succeed(pg.config.url)
          ).pipe(Effect.provide(profile));
          if (url === undefined) {
            throw new Error("EX06 fixture must provide a URL");
          }
          const failure = yield* Effect.void.pipe(
            Effect.provide(
              makeD01IdentityLayer({ ...fixture.config, databaseUrl: url })
            ),
            Effect.flip
          );
          expect(failure).toMatchObject({
            _tag: "Unavailable",
            code: "UNAVAILABLE",
          });
        }
      })
    )
);
