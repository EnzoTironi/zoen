import { NodeHttpServerRequest } from "@effect/platform-node";
import { Effect } from "effect";
import type { HttpServerRequest } from "effect/unstable/http";

import { ResponseSecurityHeaders } from "./security.ts";

/**
 * The only private JSON writer: no retained callback or deferred body emission.
 * Production emission is gated in `withEmission` via `permit.authorizeSend` before
 * invoke; optional `authorizeSend` here covers direct writers (ZA-08 child).
 */
export const makePrivateJsonEmitter = Effect.fn("http.privateJsonEmitter")(
  function* makePrivateJsonEmitter(
    request: HttpServerRequest.HttpServerRequest,
    authorizeSend?: () => "authorized" | "retired"
  ) {
    const security = yield* ResponseSecurityHeaders;
    const native = NodeHttpServerRequest.toServerResponse(request);
    return (bytes: Uint8Array): "submitted" => {
      if (authorizeSend !== undefined && authorizeSend() === "retired") {
        throw new Error("disclosure.writer_epoch_retired");
      }
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
