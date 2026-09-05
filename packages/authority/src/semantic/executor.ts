import type { D01Error } from "@zoen/contracts/d01/errors";
import {
  InvalidInput,
  Unauthenticated,
  Unavailable,
  Unsupported,
} from "@zoen/contracts/d01/errors";
import { D01Success } from "@zoen/contracts/d01/operations";
import { D01_LIMITS, Instant } from "@zoen/contracts/d01/values";
import type { Redacted } from "effect";
import { Context, DateTime, Effect, Layer, Schema } from "effect";

import { validateContext } from "../access/context.js";
import { authorizeWorld } from "../access/world.js";
import { createPersonalWorld } from "../commit/genesis.js";
import { Presence } from "../ports/d01/context.js";
import { canonicalJson } from "../values/canonical.js";
import { parseEnvelopeBytes } from "../values/json.js";

export class SemanticExecutor extends Context.Service<
  SemanticExecutor,
  {
    readonly execute: (
      credential: Redacted.Redacted,
      bytes: Uint8Array
    ) => Effect.Effect<D01Success, D01Error>;
  }
>()("zoen/authority/semantic/SemanticExecutor") {
  static readonly layer = Layer.effect(
    SemanticExecutor,
    Effect.gen(function* makeSemanticExecutor() {
      const presence = yield* Presence;
      const dependencies =
        yield* Effect.context<
          Effect.Services<ReturnType<typeof createPersonalWorld>>
        >();
      const execute = Effect.fn("authority.semantic.execute")(
        function* execute(credential: Redacted.Redacted, bytes: Uint8Array) {
          const request = yield* parseEnvelopeBytes(bytes);
          const verified = yield* presence.verify(credential);
          const now = yield* DateTime.now;
          const deadline = yield* Schema.decodeEffect(Instant)(
            DateTime.formatIso(
              DateTime.add(now, { seconds: D01_LIMITS.requestSeconds })
            )
          ).pipe(
            Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" }))
          );
          const context = yield* validateContext({
            deadline,
            presence: verified,
            purpose: request.purpose,
          });
          if (request.operation !== "CreatePersonalWorld") {
            return yield* new Unsupported({ code: "UNSUPPORTED" });
          }
          const result = yield* createPersonalWorld(context, request);
          const decoded = yield* Schema.decodeEffect(D01Success)(result).pipe(
            Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
          );
          const json = yield* canonicalJson(decoded);
          if (
            new TextEncoder().encode(json).byteLength > D01_LIMITS.responseBytes
          ) {
            return yield* new Unavailable({ code: "UNAVAILABLE" });
          }
          const currentPresence = yield* presence.verify(credential);
          if (
            currentPresence.principalId !== verified.principalId ||
            currentPresence.sessionId !== verified.sessionId ||
            currentPresence.realm !== verified.realm
          ) {
            return yield* new Unauthenticated({ code: "PRESENCE_REQUIRED" });
          }
          const currentContext = yield* validateContext({
            ...context,
            presence: currentPresence,
          });
          yield* authorizeWorld(currentContext, result.worldRef);
          return decoded;
        },
        Effect.catchTag(
          "SqlError",
          () => new Unavailable({ code: "UNAVAILABLE" })
        ),
        Effect.provide(dependencies)
      );
      return SemanticExecutor.of({ execute });
    })
  );
}
