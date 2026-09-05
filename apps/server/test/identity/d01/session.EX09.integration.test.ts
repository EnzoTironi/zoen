import { randomBytes } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { Presence } from "@zoen/authority/ports/d01/context";
import { Effect, Redacted, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withD01IdentityDatabase } from "./database.ts";
import { cookieCredential, createAccount, postAuth } from "./http.ts";

it.live(
  "EX09 real password signup/login and logout produce a UUID presence without a domain grant",
  () =>
    withD01IdentityDatabase((fixture) =>
      Effect.gen(function* sessions() {
        const presence = yield* Presence;
        const account = yield* createAccount(fixture.config.baseUrl);
        const verified = yield* presence.verify(account.credential);
        const flags = account.response.headers.getSetCookie().join(";");
        expect({
          emailVerified: account.user.emailVerified,
          httpOnly: flags.includes("HttpOnly"),
          principal: verified.principalId,
          realm: verified.realm,
          sameSite: flags.includes("SameSite=Lax"),
        }).toStrictEqual({
          emailVerified: false,
          httpOnly: true,
          principal: account.user.id,
          realm: "live",
          sameSite: true,
        });
        yield* Effect.gen(function* noImplicitGrant() {
          const sql = yield* SqlClient.SqlClient;
          expect(
            yield* sql`SELECT principal_id FROM authority.memberships WHERE principal_id = ${verified.principalId}`
          ).toStrictEqual([]);
        }).pipe(Effect.provide(fixture.database.authority));
        yield* Effect.gen(function* internalIdentifier() {
          const sql = yield* SqlClient.SqlClient;
          const [row] =
            yield* sql`SELECT id::text AS id, token FROM identity.session WHERE id = ${verified.sessionId}`.pipe(
              Effect.flatMap(
                Schema.decodeUnknownEffect(
                  Schema.Tuple([
                    Schema.Struct({ id: Schema.String, token: Schema.String }),
                  ])
                )
              )
            );
          const denied = yield* sql`SELECT * FROM authority.worlds`.pipe(
            Effect.flip
          );
          expect({
            denied,
            distinct: row.id !== row.token,
            mapped: verified.sessionId === row.id,
          }).toMatchObject({
            denied: {
              _tag: "SqlError",
              reason: { _tag: "AuthorizationError" },
            },
            distinct: true,
            mapped: true,
          });
        }).pipe(Effect.provide(fixture.database.identity));
        const logout = yield* postAuth(
          fixture.config.baseUrl,
          "sign-out",
          {},
          account.credential
        );
        const afterLogout = yield* presence
          .verify(account.credential)
          .pipe(Effect.flip);
        const wrong = yield* postAuth(fixture.config.baseUrl, "sign-in/email", {
          email: account.email,
          password: randomBytes(24).toString("base64url"),
        });
        const login = yield* postAuth(fixture.config.baseUrl, "sign-in/email", {
          email: account.email,
          password: Redacted.value(account.password),
        });
        const next = yield* presence.verify(cookieCredential(login));
        expect({
          afterLogout,
          login: login.status,
          logout: logout.status,
          newSession: next.sessionId !== verified.sessionId,
          principal: next.principalId,
          wrong: wrong.status,
        }).toMatchObject({
          afterLogout: { _tag: "Unauthenticated" },
          login: 200,
          logout: 200,
          newSession: true,
          principal: verified.principalId,
          wrong: 401,
        });
      }).pipe(Effect.provide(fixture.runtime))
    )
);
