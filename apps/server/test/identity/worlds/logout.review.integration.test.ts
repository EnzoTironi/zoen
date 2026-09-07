import { expect, it } from "@effect/vitest";
import { Presence } from "@zoen/authority/ports/worlds/context";
import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withD01IdentityDatabase } from "./database.ts";
import { createAccount, postAuth } from "./http.ts";

it.live(
  "independent logout review: successful deletion with unavailable post-check does not clear the cookie",
  () =>
    withD01IdentityDatabase((fixture) =>
      Effect.gen(function* postCheckFailure() {
        const presence = yield* Presence;
        const account = yield* createAccount(fixture.config.baseUrl);
        const verified = yield* presence.verify(account.credential);
        const [role] = yield* SqlClient.SqlClient.use(
          (sql) => sql<{ name: string }>`SELECT current_user AS name`
        ).pipe(Effect.provide(fixture.database.identity));
        if (role === undefined) {
          throw new Error("Missing identity role");
        }
        yield* SqlClient.SqlClient.use((sql) =>
          sql.unsafe(
            `CREATE FUNCTION identity.remove_logout_select() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$ BEGIN EXECUTE format('REVOKE SELECT ON identity.session FROM %I', TG_ARGV[0]); RETURN OLD; END; $$`
          )
        ).pipe(Effect.provide(fixture.database.migration));
        yield* SqlClient.SqlClient.use((sql) =>
          sql.unsafe(
            `CREATE TRIGGER remove_logout_select AFTER DELETE ON identity.session FOR EACH ROW EXECUTE FUNCTION identity.remove_logout_select('${role.name.replaceAll("'", "''")}')`
          )
        ).pipe(Effect.provide(fixture.database.migration));
        const logout = yield* postAuth(
          fixture.config.baseUrl,
          "sign-out",
          {},
          account.credential
        );
        expect(logout.status).toBe(503);
        expect(logout.headers.getSetCookie()).toStrictEqual([]);
        expect(yield* Effect.tryPromise(() => logout.json())).toStrictEqual({
          code: "UNAVAILABLE",
        });
        const rows = yield* SqlClient.SqlClient.use(
          (sql) =>
            sql`SELECT id FROM identity.session WHERE id = ${verified.sessionId}`
        ).pipe(Effect.provide(fixture.database.migration));
        expect(rows).toStrictEqual([]);
        yield* SqlClient.SqlClient.use(
          (sql) => sql`GRANT SELECT ON identity.session TO ${sql(role.name)}`
        ).pipe(Effect.provide(fixture.database.migration));
        expect(
          yield* presence.verify(account.credential).pipe(Effect.flip)
        ).toMatchObject({ _tag: "Unauthenticated" });
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
  "independent logout review: body targeting another live session cannot redirect revocation or confirmation",
  () =>
    withD01IdentityDatabase((fixture) =>
      Effect.gen(function* exactSession() {
        const presence = yield* Presence;
        const first = yield* createAccount(fixture.config.baseUrl);
        const second = yield* createAccount(fixture.config.baseUrl);
        const firstPresence = yield* presence.verify(first.credential);
        const secondPresence = yield* presence.verify(second.credential);
        const logout = yield* postAuth(
          fixture.config.baseUrl,
          "sign-out",
          {
            sessionId: secondPresence.sessionId,
            token: secondPresence.sessionId,
            userId: secondPresence.principalId,
          },
          first.credential
        );
        expect(logout.status).toBe(200);
        expect(
          logout.headers
            .getSetCookie()
            .some((cookie) => cookie.includes("Max-Age=0"))
        ).toBeTruthy();
        expect(
          yield* presence.verify(first.credential).pipe(Effect.flip)
        ).toMatchObject({ _tag: "Unauthenticated" });
        expect((yield* presence.verify(second.credential)).sessionId).toBe(
          secondPresence.sessionId
        );
        const rows = yield* SqlClient.SqlClient.use(
          (sql) =>
            sql<{
              id: string;
            }>`SELECT id FROM identity.session WHERE id IN (${firstPresence.sessionId}, ${secondPresence.sessionId})`
        ).pipe(Effect.provide(fixture.database.migration));
        expect(rows).toStrictEqual([{ id: secondPresence.sessionId }]);
      }).pipe(Effect.provide(fixture.runtime))
    )
);
