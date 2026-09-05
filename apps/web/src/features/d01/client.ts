import { D01Api } from "@zoen/contracts/d01/api";
import { D01Error, Unavailable } from "@zoen/contracts/d01/errors";
import type { D01Request } from "@zoen/contracts/d01/operations";
import { Context, Effect, Layer, Option, Schema } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";

export const BrowserSession = Schema.Struct({
  session: Schema.Struct({ id: Schema.String.check(Schema.isUUID()) }),
  user: Schema.Struct({ id: Schema.String.check(Schema.isUUID()) }),
});
export type BrowserSession = typeof BrowserSession.Type;

const closedError = (error: unknown): D01Error =>
  Option.getOrElse(
    Schema.decodeUnknownOption(D01Error)(error),
    () => new Unavailable({ code: "UNAVAILABLE" })
  );

const makeClient = Effect.fn("web.makeClient")(function* makeClient(
  origin: string
) {
  const http = (yield* HttpClient.HttpClient).pipe(
    HttpClient.mapRequest((request) =>
      request.pipe(
        HttpClientRequest.prependUrl(origin),
        HttpClientRequest.setHeader("Content-Type", "application/json")
      )
    )
  );
  const api = yield* HttpApiClient.make(D01Api, {
    transformClient: () => http,
  });
  const session = http.get("/api/auth/get-session").pipe(
    Effect.flatMap(
      HttpClientResponse.schemaBodyJson(Schema.NullOr(BrowserSession))
    ),
    Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
  );
  const authenticate = Effect.fn("web.authenticate")(
    function* authenticate(
      mode: "sign-in" | "sign-up",
      email: string,
      password: string,
      name: string
    ) {
      const body =
        mode === "sign-up" ? { email, name, password } : { email, password };
      const request = yield* HttpClientRequest.bodyJson(
        HttpClientRequest.post(`/api/auth/${mode}/email`),
        body
      );
      const response = yield* http.execute(request);
      if (response.status !== 200) {
        return yield* new Unavailable({ code: "UNAVAILABLE" });
      }
      return yield* session;
    },
    Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
  );
  const logout = Effect.gen(function* logout() {
    const request = yield* HttpClientRequest.bodyJson(
      HttpClientRequest.post("/api/auth/sign-out"),
      {}
    );
    const response = yield* http.execute(request);
    if (response.status !== 200) {
      return yield* new Unavailable({ code: "UNAVAILABLE" });
    }
    return yield* Effect.void;
  }).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
  const execute = (payload: D01Request) =>
    Effect.gen(function* executeRequest() {
      switch (payload.operation) {
        case "CreatePersonalWorld": {
          return yield* api.d01.execute({ payload });
        }
        case "ImportEvidence": {
          return yield* api.d01.execute({ payload });
        }
        case "Inspect": {
          return yield* api.d01.execute({ payload });
        }
        case "OpenEvidence": {
          return yield* api.d01.execute({ payload });
        }
        default: {
          return yield* new Unavailable({ code: "UNAVAILABLE" });
        }
      }
    }).pipe(Effect.mapError(closedError));
  return { authenticate, execute, logout, session };
});

export class BrowserApi extends Context.Service<
  BrowserApi,
  Effect.Success<ReturnType<typeof makeClient>>
>()("zoen/web/d01/BrowserApi") {}

/** The browser supplies the HttpOnly cookie. No credential is read by JavaScript. */
export const browserApiLayer = (origin: string) =>
  Layer.effect(BrowserApi, makeClient(origin)).pipe(
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(
      Layer.succeed(FetchHttpClient.RequestInit, {
        cache: "no-store",
        credentials: "same-origin",
        redirect: "error",
      })
    )
  );
