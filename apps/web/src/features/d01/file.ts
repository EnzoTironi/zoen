import { InvalidInput } from "@zoen/contracts/d01/errors";
import { D01_LIMITS } from "@zoen/contracts/d01/values";
import { Effect } from "effect";

/** Decode exact UTF-8 without parsing the document or silently replacing malformed bytes. */
export const readDocument = Effect.fn("web.readDocument")(
  function* readDocument(file: File) {
    if (file.size < 1 || file.size > D01_LIMITS.documentBytes) {
      return yield* new InvalidInput({ code: "INVALID_INPUT" });
    }
    const bytes = yield* Effect.tryPromise({
      catch: () => new InvalidInput({ code: "INVALID_INPUT" }),
      try: () => file.arrayBuffer(),
    });
    return yield* Effect.try({
      catch: () => new InvalidInput({ code: "INVALID_INPUT" }),
      try: () =>
        new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
          bytes
        ),
    });
  }
);
