import { parseJsonBytes } from "@zoen/authority/values/json";
import { Expired, InvalidInput } from "@zoen/contracts/d01/errors";
import type {
  NotFoundOrDenied,
  QuotaExceeded,
  Unavailable,
} from "@zoen/contracts/d01/errors";
import { D01_LIMITS } from "@zoen/contracts/d01/values";
import { Effect, Layer } from "effect";
import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";

import { D01Auth } from "../identity/d01/identity.ts";
import { checkRequestAudience, readJsonBody } from "./request.ts";

const errorResponse = (
  error:
    | Expired
    | InvalidInput
    | NotFoundOrDenied
    | QuotaExceeded
    | Unavailable,
  status: number
) =>
  HttpServerResponse.jsonUnsafe(
    { _tag: error._tag, code: error.code },
    { status }
  );

/** Bridges only the provider's admitted identity routes to native Fetch requests. */
export const makeIdentityRoutes = (publicUrl: URL) =>
  Layer.effectDiscard(
    Effect.gen(function* identityRoutes() {
      const router = yield* HttpRouter.HttpRouter;
      const auth = yield* D01Auth;
      const handle = Effect.gen(function* identityRequest() {
        const request = yield* HttpServerRequest.HttpServerRequest;
        yield* checkRequestAudience(request, publicUrl);
        const body =
          request.method === "POST" ? yield* readJsonBody(request) : undefined;
        if (body !== undefined) {
          yield* parseJsonBytes(body, D01_LIMITS.envelopeBytes);
        }
        const webRequest = yield* Effect.try({
          catch: () => new InvalidInput({ code: "INVALID_INPUT" }),
          try: () =>
            new Request(new URL(request.url, publicUrl), {
              headers: request.headers,
              method: request.method,
              ...(body === undefined ? {} : { body }),
            }),
        });
        return HttpServerResponse.fromWeb(yield* auth.handle(webRequest));
      }).pipe(
        Effect.timeoutOrElse({
          duration: D01_LIMITS.requestSeconds * 1000,
          orElse: () => Effect.fail(new Expired({ code: "EXPIRED" })),
        }),
        Effect.catchTags({
          Expired: (error) => Effect.succeed(errorResponse(error, 410)),
          InvalidInput: (error) => Effect.succeed(errorResponse(error, 400)),
          NotFoundOrDenied: (error) =>
            Effect.succeed(errorResponse(error, 404)),
          QuotaExceeded: (error) => Effect.succeed(errorResponse(error, 429)),
          Unavailable: (error) => Effect.succeed(errorResponse(error, 503)),
        })
      );
      yield* router.add("POST", "/api/auth/sign-up/email", handle);
      yield* router.add("POST", "/api/auth/sign-in/email", handle);
      yield* router.add("POST", "/api/auth/sign-out", handle);
      yield* router.add("GET", "/api/auth/get-session", handle);
    })
  );
