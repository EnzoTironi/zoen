import { randomUUID } from "node:crypto";

import { Context, Effect } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";

export class ResponseSecurityHeaders extends Context.Service<
  ResponseSecurityHeaders,
  Readonly<Record<string, string>>
>()("zoen/server/http/ResponseSecurityHeaders") {}

/** Logs bounded correlation metadata; requests, URLs, credentials and bodies stay private. */
export const responseSecurity = HttpRouter.middleware<{
  provides: ResponseSecurityHeaders;
}>()(
  (httpEffect) =>
    Effect.gen(function* secureResponse() {
      const requestId = randomUUID();
      const headers = {
        "cache-control": "no-store",
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
        "x-request-id": requestId,
      };
      const response = yield* httpEffect.pipe(
        Effect.provideService(ResponseSecurityHeaders, headers)
      );
      yield* Effect.logInfo({
        event: "http.response",
        requestId,
        status: response.status,
      });
      return response.pipe(HttpServerResponse.setHeaders(headers));
    }),
  { global: true }
);
