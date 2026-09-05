import { randomUUID } from "node:crypto";

import { Effect } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";

/** Logs bounded correlation metadata; requests, URLs, credentials and bodies stay private. */
export const responseSecurity = HttpRouter.middleware(
  (httpEffect) =>
    Effect.gen(function* secureResponse() {
      const requestId = randomUUID();
      const response = yield* httpEffect;
      yield* Effect.logInfo({
        event: "http.response",
        requestId,
        status: response.status,
      });
      return response.pipe(
        HttpServerResponse.setHeaders({
          "cache-control": "no-store",
          "referrer-policy": "no-referrer",
          "x-content-type-options": "nosniff",
          "x-request-id": requestId,
        })
      );
    }),
  { global: true }
);
