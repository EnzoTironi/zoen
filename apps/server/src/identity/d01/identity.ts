import {
  Presence,
  PrincipalId,
  SessionId,
  VerifiedPresence,
} from "@zoen/authority/ports/d01/context";
import { Unauthenticated, Unavailable } from "@zoen/contracts/d01/errors";
import { betterAuth } from "better-auth";
import { Context, DateTime, Effect, Layer, Redacted, Schema } from "effect";

import {
  D01IdentityConfig,
  IdentityConfigurationError,
  d01AuthOptions,
} from "./configuration.ts";
import { acquireD01IdentityPool, checkD01IdentityPool } from "./database.ts";

export class D01Auth extends Context.Service<
  D01Auth,
  {
    readonly handle: (request: Request) => Effect.Effect<Response, Unavailable>;
  }
>()("zoen/server/identity/d01/Auth") {}

const CookieCredential = Schema.Redacted(
  Schema.String.check(Schema.isMaxLength(8192), Schema.isPattern(/^[^\r\n]*$/u))
);
const ProviderSession = Schema.Struct({
  session: Schema.Struct({
    createdAt: Schema.DateTimeUtcFromDate,
    expiresAt: Schema.DateTimeUtcFromDate,
    id: SessionId,
    userId: PrincipalId,
  }),
  user: Schema.Struct({ id: PrincipalId }),
});
const authPaths = new Map([
  ["/api/auth/sign-up/email", "POST"],
  ["/api/auth/sign-in/email", "POST"],
  ["/api/auth/sign-out", "POST"],
  ["/api/auth/get-session", "GET"],
]);

/** Provides real auth transport and the shared executor's Presence port. */
export const makeD01IdentityLayer = (input: D01IdentityConfig) =>
  Layer.effectContext(
    Effect.gen(function* makeIdentity() {
      const config = yield* Schema.decodeEffect(D01IdentityConfig)(input).pipe(
        Effect.mapError(
          () =>
            new IdentityConfigurationError({
              code: "invalid_identity_configuration",
            })
        )
      );
      const pool = yield* acquireD01IdentityPool(config.databaseUrl);
      yield* checkD01IdentityPool(pool);
      const auth = betterAuth(d01AuthOptions(config, pool));
      yield* Effect.tryPromise({
        catch: () => new Unavailable({ code: "UNAVAILABLE" }),
        try: () => auth.$context,
      });

      const verify = Effect.fn("identity.verifyPresence")(function* verify(
        credential: Redacted.Redacted
      ) {
        const cookie = yield* Schema.decodeEffect(CookieCredential)(
          credential
        ).pipe(
          Effect.mapError(
            () => new Unauthenticated({ code: "PRESENCE_REQUIRED" })
          )
        );
        const session = yield* Effect.tryPromise({
          catch: () => new Unavailable({ code: "UNAVAILABLE" }),
          try: () =>
            auth.api.getSession({
              headers: new Headers({ cookie: Redacted.value(cookie) }),
              query: { disableCookieCache: true, disableRefresh: true },
            }),
        });
        if (session === null) {
          return yield* new Unauthenticated({ code: "PRESENCE_REQUIRED" });
        }
        const current = yield* Schema.decodeEffect(ProviderSession)(
          session
        ).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
        if (current.session.userId !== current.user.id) {
          return yield* new Unauthenticated({ code: "PRESENCE_REQUIRED" });
        }
        const presence = yield* Schema.decodeEffect(VerifiedPresence)({
          authenticatedAt: DateTime.formatIso(current.session.createdAt),
          expiresAt: DateTime.formatIso(current.session.expiresAt),
          principalId: current.user.id,
          realm: "live",
          sessionId: current.session.id,
        }).pipe(
          Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
        );
        const now = yield* DateTime.now;
        if (presence.expiresAt <= DateTime.formatIso(now)) {
          return yield* new Unauthenticated({ code: "PRESENCE_REQUIRED" });
        }
        return presence;
      });
      const handle = Effect.fn("identity.handleAuth")(function* handle(
        request: Request
      ) {
        const url = new URL(request.url);
        if (url.origin !== config.baseUrl.origin) {
          return new Response(null, { status: 403 });
        }
        if (authPaths.get(url.pathname) !== request.method) {
          return new Response(null, { status: 404 });
        }
        const origin = request.headers.get("origin");
        if (origin !== null && origin !== config.baseUrl.origin) {
          return new Response(null, { status: 403 });
        }
        const response = yield* Effect.tryPromise({
          catch: () => new Unavailable({ code: "UNAVAILABLE" }),
          try: () => auth.handler(request),
        });
        if (response.status >= 500) {
          return Response.json({ code: "UNAVAILABLE" }, { status: 503 });
        }
        return response;
      });
      return Context.make(Presence, Presence.of({ verify })).pipe(
        Context.add(D01Auth, D01Auth.of({ handle }))
      );
    })
  );
