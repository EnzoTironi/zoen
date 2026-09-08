import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { Presence } from "@zoen/ontology/ports/worlds/context";
import { Effect, Redacted, Schema } from "effect";

import { IdentityAuth } from "../../../src/identity/worlds/identity.ts";
import { withIdentityDatabase } from "./database.ts";
import { UserResponse, createAccount, postAuth } from "./http.ts";

it.live(
  "EX09 fixed audience, trusted origins, callback validation and real login CSRF checks protect secure cookies",
  () =>
    withIdentityDatabase(
      (fixture) =>
        Effect.gen(function* security() {
          const auth = yield* IdentityAuth;
          const presence = yield* Presence;
          const account = yield* createAccount(fixture.config.baseUrl);
          const flags = account.response.headers.getSetCookie().join(";");
          expect({
            hostOnly: !flags.includes("Domain="),
            httpOnly: flags.includes("HttpOnly"),
            prefix: flags.includes("__Secure-zoen-worlds.session_token="),
            secure: flags.includes("; Secure"),
          }).toStrictEqual({
            hostOnly: true,
            httpOnly: true,
            prefix: true,
            secure: true,
          });
          const wrongAudience = yield* auth.handle(
            new Request("https://elsewhere.test/api/auth/get-session", {
              headers: { cookie: Redacted.value(account.credential) },
            })
          );
          const wrongOrigin = yield* auth.handle(
            new Request(`${fixture.config.baseUrl}/api/auth/sign-out`, {
              body: "{}",
              headers: {
                "Content-Type": "application/json",
                cookie: Redacted.value(account.credential),
                origin: "https://elsewhere.test",
              },
              method: "POST",
            })
          );
          const crossSite = yield* auth.handle(
            new Request(`${fixture.config.baseUrl}/api/auth/sign-up/email`, {
              body: new URLSearchParams({
                email: `${randomUUID()}@example.test`,
                name: "Cross-site request",
                password: "long-unused-password",
              }),
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "cross-site",
              },
              method: "POST",
            })
          );
          const callback = yield* postAuth(
            fixture.config.baseUrl,
            "sign-in/email",
            {
              callbackURL: "https://elsewhere.test/steal",
              email: account.email,
              password: Redacted.value(account.password),
            }
          );
          expect([
            wrongAudience.status,
            wrongOrigin.status,
            crossSite.status,
            callback.status,
          ]).toStrictEqual([403, 403, 403, 403]);
          const stillValid = yield* presence.verify(account.credential);
          expect(stillValid.principalId).toBe(account.user.id);
          const unsupported = yield* auth.handle(
            new Request(`${fixture.config.baseUrl}/api/auth/delete-user`, {
              body: "{}",
              headers: {
                "Content-Type": "application/json",
                cookie: Redacted.value(account.credential),
                origin: fixture.config.baseUrl,
              },
              method: "POST",
            })
          );
          expect(unsupported.status).toBe(404);
        }).pipe(Effect.provide(fixture.runtime)),
      { secure: true }
    )
);

it.live(
  "EX09 another account, forged actor headers and client supplied IDs cannot impersonate the first account",
  () =>
    withIdentityDatabase((fixture) =>
      Effect.gen(function* forgedIdentity() {
        const auth = yield* IdentityAuth;
        const presence = yield* Presence;
        const first = yield* createAccount(fixture.config.baseUrl);
        const second = yield* createAccount(fixture.config.baseUrl, {
          emailVerified: true,
          id: first.user.id,
          principalId: first.user.id,
          role: "owner",
        });
        const verified = yield* presence.verify(second.credential);
        expect({
          different: second.user.id !== first.user.id,
          principal: verified.principalId,
          verifiedEmail: second.user.emailVerified,
        }).toStrictEqual({
          different: true,
          principal: second.user.id,
          verifiedEmail: false,
        });
        const response = yield* auth.handle(
          new Request(`${fixture.config.baseUrl}/api/auth/get-session`, {
            headers: {
              authorization: `Bearer ${first.user.id}`,
              cookie: Redacted.value(second.credential),
              origin: fixture.config.baseUrl,
              "x-principal-id": first.user.id,
              "x-role": "owner",
              "x-user-id": first.user.id,
            },
          })
        );
        const body = yield* Effect.tryPromise(() => response.json()).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(UserResponse))
        );
        expect(body.user.id).toBe(second.user.id);
        for (const invalid of [
          Redacted.make(`zoen-worlds.session_token=${first.user.id}`),
          Redacted.make(`x-principal-id=${first.user.id}`),
          Redacted.make(`${Redacted.value(second.credential)}x`),
          Redacted.make("bad\r\ncookie"),
        ]) {
          expect(
            yield* presence.verify(invalid).pipe(Effect.flip)
          ).toMatchObject({
            _tag: "Unauthenticated",
            code: "PRESENCE_REQUIRED",
          });
        }
      }).pipe(Effect.provide(fixture.runtime))
    )
);
