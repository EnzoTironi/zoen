import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { DisclosureFence } from "@zoen/authority/ports/disclosure/fence";
import { sessionDisclosureKey } from "@zoen/authority/ports/disclosure/keys";
import { Presence } from "@zoen/authority/ports/worlds/context";
import { Instant, WorldRef } from "@zoen/contracts/worlds/values";
import { DateTime, Deferred, Effect, Fiber, Redacted, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withD01IdentityDatabase } from "../worlds/database.ts";
import { cookieCredential, createAccount, postAuth } from "../worlds/http.ts";

const target = Effect.gen(function* disclosureTarget() {
  const now = yield* DateTime.now;
  return {
    deadline: yield* Schema.decodeEffect(Instant)(
      DateTime.formatIso(DateTime.add(now, { seconds: 10 }))
    ),
    world: yield* Schema.decodeEffect(WorldRef)({
      realm: "live",
      worldId: randomUUID(),
    }),
  };
});

it.live(
  "EX22 provider failure retains terminal closing without claiming identity revoked; another login has its own session",
  () =>
    withD01IdentityDatabase((fixture) =>
      Effect.gen(function* terminalProviderFailure() {
        const fence = yield* DisclosureFence;
        const presence = yield* Presence;
        const account = yield* createAccount(fixture.config.baseUrl);
        const verified = yield* presence.verify(account.credential);
        const test = yield* target;
        yield* SqlClient.SqlClient.use(
          (sql) =>
            sql`REVOKE DELETE ON identity.session FROM ${sql(fixture.database.names.identity)}`
        ).pipe(Effect.provide(fixture.database.migration));
        const response = yield* postAuth(
          fixture.config.baseUrl,
          "sign-out",
          {},
          account.credential
        );
        expect(response.status).toBe(503);
        expect(response.headers.getSetCookie()).toStrictEqual([]);
        expect((yield* presence.verify(account.credential)).sessionId).toBe(
          verified.sessionId
        );
        expect(
          yield* Effect.scoped(
            fence.shared(verified, test.world, test.deadline)
          ).pipe(Effect.flip)
        ).toMatchObject({ _tag: "Unavailable" });
        const login = yield* postAuth(fixture.config.baseUrl, "sign-in/email", {
          email: account.email,
          password: Redacted.value(account.password),
        });
        expect(login.status).toBe(200);
        const newCookie = cookieCredential(login);
        const newPresence = yield* presence.verify(newCookie);
        expect(newPresence.sessionId).not.toBe(verified.sessionId);
        const permit = yield* Effect.scoped(
          fence.shared(newPresence, test.world, test.deadline)
        );
        yield* permit.acknowledge;
        yield* SqlClient.SqlClient.use(
          (sql) =>
            sql`GRANT DELETE ON identity.session TO ${sql(fixture.database.names.identity)}`
        ).pipe(Effect.provide(fixture.database.migration));
        expect(
          (yield* postAuth(
            fixture.config.baseUrl,
            "sign-out",
            {},
            account.credential
          )).status
        ).toBe(200);
        expect((yield* presence.verify(newCookie)).sessionId).toBe(
          newPresence.sessionId
        );
      }).pipe(Effect.provide(fixture.runtime))
    )
);

it.live(
  "EX22 terminal closing survives coordinator loss while Better Auth is blocked before its real DELETE",
  () =>
    withD01IdentityDatabase((fixture) =>
      Effect.gen(function* closingDuringProviderIo() {
        const fence = yield* DisclosureFence;
        const presence = yield* Presence;
        const account = yield* createAccount(fixture.config.baseUrl);
        const verified = yield* presence.verify(account.credential);
        const test = yield* target;
        const ready = yield* Deferred.make<null>();
        const allowDelete = yield* Deferred.make<null>();
        const holder = yield* SqlClient.SqlClient.use((sql) =>
          sql.withTransaction(
            Effect.gen(function* holdProviderDelete() {
              yield* sql`LOCK TABLE identity.session IN SHARE MODE`;
              yield* Deferred.succeed(ready, null);
              yield* Deferred.await(allowDelete).pipe(
                Effect.timeout("5 seconds")
              );
            })
          )
        ).pipe(Effect.provide(fixture.database.migration), Effect.forkChild);
        yield* Deferred.await(ready);
        const logout = yield* postAuth(
          fixture.config.baseUrl,
          "sign-out",
          {},
          account.credential
        ).pipe(Effect.uninterruptible, Effect.forkChild);
        yield* SqlClient.SqlClient.use((sql) =>
          Effect.gen(function* observeProvider() {
            while (true) {
              const rows = yield* sql<{
                blocked: boolean;
              }>`SELECT EXISTS (SELECT FROM pg_stat_activity WHERE application_name = 'zoen-worlds-identity' AND wait_event_type = 'Lock' AND query ILIKE '%delete%') AS blocked`;
              if (rows[0]?.blocked === true) {
                break;
              }
              yield* Effect.sleep("10 millis");
            }
          })
        ).pipe(
          Effect.provide(fixture.database.identity),
          Effect.timeout("3 seconds")
        );
        const key = sessionDisclosureKey(verified);
        expect(
          yield* SqlClient.SqlClient.use(
            (sql) =>
              sql`SELECT session_key FROM jobs.disclosure_session_closing WHERE session_key = ${key}`
          ).pipe(Effect.provide(fixture.database.migration))
        ).toStrictEqual([{ session_key: key }]);
        expect(
          yield* SqlClient.SqlClient.use(
            (sql) =>
              sql`SELECT pg_terminate_backend(pid) AS terminated FROM pg_stat_activity WHERE application_name = 'zoen-ex22-identity-fence'`
          ).pipe(Effect.provide(fixture.database.authority))
        ).toStrictEqual([{ terminated: true }]);
        expect((yield* presence.verify(account.credential)).sessionId).toBe(
          verified.sessionId
        );
        expect(
          yield* Effect.scoped(
            fence.shared(verified, test.world, test.deadline)
          ).pipe(Effect.flip)
        ).toMatchObject({ _tag: "Unavailable" });
        yield* Deferred.succeed(allowDelete, null);
        yield* Fiber.join(holder);
        yield* Fiber.await(logout);
        expect(
          yield* presence.verify(account.credential).pipe(Effect.flip)
        ).toMatchObject({ _tag: "Unauthenticated" });
        expect(
          yield* SqlClient.SqlClient.use(
            (sql) =>
              sql`SELECT session_key FROM jobs.disclosure_session_closing WHERE session_key = ${key}`
          ).pipe(Effect.provide(fixture.database.migration))
        ).toStrictEqual([{ session_key: key }]);
      }).pipe(Effect.provide(fixture.runtime))
    )
);
