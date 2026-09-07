import { expect, it } from "@effect/vitest";
import { Presence } from "@zoen/authority/ports/worlds/context";
import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withIdentityDatabase } from "./database.ts";
import { createAccount, postAuth } from "./http.ts";

it.live(
  "EX09 logout cannot confirm revocation when Better Auth swallows a real session DELETE denial",
  () =>
    withIdentityDatabase((fixture) =>
      Effect.gen(function* logoutDenial() {
        const presence = yield* Presence;
        const account = yield* createAccount(fixture.config.baseUrl);
        const verified = yield* presence.verify(account.credential);
        const [role] = yield* SqlClient.SqlClient.use(
          (sql) => sql<{ name: string }>`SELECT current_user AS name`
        ).pipe(Effect.provide(fixture.database.identity));
        if (role === undefined) {
          throw new Error("Identity role must exist");
        }
        yield* SqlClient.SqlClient.use(
          (sql) => sql`REVOKE DELETE ON identity.session FROM ${sql(role.name)}`
        ).pipe(Effect.provide(fixture.database.migration));
        const logout = yield* postAuth(
          fixture.config.baseUrl,
          "sign-out",
          {},
          account.credential
        );
        const stillValid = yield* presence.verify(account.credential);
        expect(stillValid.sessionId).toBe(verified.sessionId);
        yield* SqlClient.SqlClient.use(
          (sql) => sql`GRANT DELETE ON identity.session TO ${sql(role.name)}`
        ).pipe(Effect.provide(fixture.database.migration));
        expect(logout.status).toBe(503);
        expect(logout.headers.getSetCookie()).toStrictEqual([]);
        expect(yield* Effect.tryPromise(() => logout.json())).toStrictEqual({
          code: "UNAVAILABLE",
        });
        const retry = yield* postAuth(
          fixture.config.baseUrl,
          "sign-out",
          {},
          account.credential
        );
        expect(retry.status).toBe(200);
        expect(
          yield* presence.verify(account.credential).pipe(Effect.flip)
        ).toMatchObject({ _tag: "Unauthenticated" });
        const absent = yield* postAuth(
          fixture.config.baseUrl,
          "sign-out",
          {},
          account.credential
        );
        expect(absent.status).toBe(200);
      }).pipe(Effect.provide(fixture.runtime))
    )
);

it.live(
  "EX09 logout checks the exact session row even when a real DELETE trigger silently retains it",
  () =>
    withIdentityDatabase((fixture) =>
      Effect.gen(function* retainedSession() {
        const presence = yield* Presence;
        const account = yield* createAccount(fixture.config.baseUrl);
        const verified = yield* presence.verify(account.credential);
        yield* SqlClient.SqlClient.use((sql) =>
          sql.unsafe(
            `CREATE FUNCTION identity.retain_logout_session() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END; $$`
          )
        ).pipe(Effect.provide(fixture.database.migration));
        yield* SqlClient.SqlClient.use((sql) =>
          sql.unsafe(
            `CREATE TRIGGER retain_logout_session BEFORE DELETE ON identity.session FOR EACH ROW EXECUTE FUNCTION identity.retain_logout_session()`
          )
        ).pipe(Effect.provide(fixture.database.migration));
        const rejectedCallback = yield* postAuth(
          fixture.config.baseUrl,
          "sign-out",
          { callbackURL: "https://elsewhere.test/logout" },
          account.credential
        );
        expect(rejectedCallback.status).toBe(403);
        const logout = yield* postAuth(
          fixture.config.baseUrl,
          "sign-out",
          { sessionId: "00000000-0000-4000-8000-000000000001" },
          account.credential
        );
        expect(logout.status).toBe(503);
        expect((yield* presence.verify(account.credential)).sessionId).toBe(
          verified.sessionId
        );
        yield* SqlClient.SqlClient.use((sql) =>
          sql.unsafe(`DROP TRIGGER retain_logout_session ON identity.session`)
        ).pipe(Effect.provide(fixture.database.migration));
        expect(
          (yield* postAuth(
            fixture.config.baseUrl,
            "sign-out",
            {},
            account.credential
          )).status
        ).toBe(200);
      }).pipe(Effect.provide(fixture.runtime))
    )
);

it.live(
  "EX09 logout fails closed when current session lookup loses real SELECT privilege",
  () =>
    withIdentityDatabase((fixture) =>
      Effect.gen(function* unreadableSession() {
        const presence = yield* Presence;
        const account = yield* createAccount(fixture.config.baseUrl);
        const before = yield* presence.verify(account.credential);
        const [role] = yield* SqlClient.SqlClient.use(
          (sql) => sql<{ name: string }>`SELECT current_user AS name`
        ).pipe(Effect.provide(fixture.database.identity));
        if (role === undefined) {
          throw new Error("Identity role must exist");
        }
        yield* SqlClient.SqlClient.use(
          (sql) => sql`REVOKE SELECT ON identity.session FROM ${sql(role.name)}`
        ).pipe(Effect.provide(fixture.database.migration));
        const logout = yield* postAuth(
          fixture.config.baseUrl,
          "sign-out",
          {},
          account.credential
        );
        expect(logout.status).toBe(503);
        expect(logout.headers.getSetCookie()).toStrictEqual([]);
        yield* SqlClient.SqlClient.use(
          (sql) => sql`GRANT SELECT ON identity.session TO ${sql(role.name)}`
        ).pipe(Effect.provide(fixture.database.migration));
        expect((yield* presence.verify(account.credential)).sessionId).toBe(
          before.sessionId
        );
      }).pipe(Effect.provide(fixture.runtime))
    )
);
