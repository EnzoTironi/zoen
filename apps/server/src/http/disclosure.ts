import { NodeHttpServerRequest } from "@effect/platform-node";
import { Effect } from "effect";
import type { HttpServerRequest } from "effect/unstable/http";

import { ResponseSecurityHeaders } from "./security.ts";

/** The only private JSON writer: no retained callback or deferred body emission. */
export const makePrivateJsonEmitter = Effect.fn("http.privateJsonEmitter")(
  function* makePrivateJsonEmitter(
    request: HttpServerRequest.HttpServerRequest
  ) {
    const security = yield* ResponseSecurityHeaders;
    const native = NodeHttpServerRequest.toServerResponse(request);
    return (bytes: Uint8Array): "submitted" => {
      native.writeHead(200, {
        ...security,
        "content-length": String(bytes.byteLength),
        "content-type": "application/json",
      });
      native.end(bytes);
      return "submitted";
    };
  }
);
