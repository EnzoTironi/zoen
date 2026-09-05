import {
  InvalidInput,
  NotFoundOrDenied,
  QuotaExceeded,
} from "@zoen/contracts/d01/errors";
import { D01_LIMITS } from "@zoen/contracts/d01/values";
import { Effect, Stream } from "effect";
import type { HttpServerRequest } from "effect/unstable/http";

/** The configured public origin is the audience; forwarding headers grant nothing. */
export const checkRequestAudience = Effect.fn("http.checkRequestAudience")(
  function* checkRequestAudience(
    request: HttpServerRequest.HttpServerRequest,
    publicUrl: URL
  ) {
    if (
      request.headers.host !== publicUrl.host ||
      (request.headers.origin !== undefined &&
        request.headers.origin !== publicUrl.origin) ||
      (request.method !== "GET" && request.headers.origin !== publicUrl.origin)
    ) {
      return yield* new NotFoundOrDenied({ code: "NOT_FOUND_OR_DENIED" });
    }
    return null;
  }
);

/** Reads original bytes with a streaming limit, before any JSON decoder runs. */
export const readJsonBody = Effect.fn("http.readJsonBody")(
  function* readJsonBody(request: HttpServerRequest.HttpServerRequest) {
    const contentType = request.headers["content-type"]
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase();
    if (
      contentType !== "application/json" ||
      (request.headers["content-encoding"] !== undefined &&
        request.headers["content-encoding"] !== "identity")
    ) {
      return yield* new InvalidInput({ code: "INVALID_INPUT" });
    }
    const declaredLength = request.headers["content-length"];
    if (
      declaredLength !== undefined &&
      Number(declaredLength) > D01_LIMITS.envelopeBytes
    ) {
      return yield* new QuotaExceeded({ code: "QUOTA_EXCEEDED" });
    }
    const chunks: Uint8Array[] = [];
    let size = 0;
    yield* request.stream.pipe(
      Stream.mapError(() => new InvalidInput({ code: "INVALID_INPUT" })),
      Stream.runForEach((chunk) =>
        Effect.gen(function* retainChunk() {
          size += chunk.byteLength;
          if (size > D01_LIMITS.envelopeBytes) {
            return yield* new QuotaExceeded({ code: "QUOTA_EXCEEDED" });
          }
          chunks.push(chunk);
          return null;
        })
      )
    );
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  }
);
