import type { D01Error } from "@zoen/contracts/d01/errors";
import {
  InvalidInput,
  Unauthenticated,
  Unavailable,
  Expired,
  Unsupported,
} from "@zoen/contracts/d01/errors";
import {
  CorrectionSuccess,
  D01Success,
  SemanticSuccess,
  WorldCreated,
} from "@zoen/contracts/d01/operations";
import { D01_LIMITS, Instant } from "@zoen/contracts/d01/values";
import type { Redacted } from "effect";
import { Context, DateTime, Effect, Layer, Schema } from "effect";

import { validateContext, withinRequestDeadline } from "../access/context.js";
import { authorizeWorld } from "../access/world.js";
import { createPersonalWorld } from "../commit/genesis.js";
import { importEvidence } from "../evidence/d01/import.js";
import { openEvidence } from "../evidence/d01/open.js";
import { answerQuestion } from "../knowledge/corrections/answer.js";
import { proposeCorrection } from "../knowledge/corrections/propose.js";
import { parseCorrectionBytes } from "../knowledge/corrections/request.js";
import { undoCorrection } from "../knowledge/corrections/undo.js";
import { inspect } from "../knowledge/d01/inspect.js";
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
    readonly executeCorrection: (
      credential: Redacted.Redacted,
      bytes: Uint8Array
    ) => Effect.Effect<CorrectionSuccess, D01Error>;
  }
>()("zoen/authority/semantic/SemanticExecutor") {
  static readonly layer = Layer.effect(
    SemanticExecutor,
    Effect.gen(function* makeSemanticExecutor() {
      const presence = yield* Presence;
      const dependencies =
        yield* Effect.context<
          Effect.Services<
            | ReturnType<typeof createPersonalWorld>
            | ReturnType<typeof importEvidence>
            | ReturnType<typeof openEvidence>
            | ReturnType<typeof inspect>
            | ReturnType<typeof proposeCorrection>
            | ReturnType<typeof answerQuestion>
            | ReturnType<typeof undoCorrection>
          >
        >();
      const execute = Effect.fn("authority.semantic.execute")(
        function* execute(
          family: "d01" | "correction",
          credential: Redacted.Redacted,
          bytes: Uint8Array
        ) {
          const request =
            family === "d01"
              ? yield* parseEnvelopeBytes(bytes)
              : yield* parseCorrectionBytes(bytes);
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
          const result = yield* Effect.gen(function* dispatch() {
            switch (request.operation) {
              case "CreatePersonalWorld": {
                return yield* createPersonalWorld(context, request);
              }
              case "ImportEvidence": {
                return yield* importEvidence(context, request);
              }
              case "Inspect": {
                return yield* inspect(context, request);
              }
              case "OpenEvidence": {
                return yield* openEvidence(context, request);
              }
              case "ProposeCorrection": {
                return yield* proposeCorrection(context, request);
              }
              case "AnswerQuestion": {
                return yield* answerQuestion(context, request);
              }
              case "UndoCorrection": {
                return yield* undoCorrection(context, request);
              }
              default: {
                return yield* new Unsupported({ code: "UNSUPPORTED" });
              }
            }
          }).pipe(withinRequestDeadline(context));
          const decoded = yield* Schema.decodeEffect(SemanticSuccess)(
            result
          ).pipe(
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
          const worldRef =
            request.operation === "CreatePersonalWorld"
              ? (yield* Schema.decodeUnknownEffect(WorldCreated)(decoded).pipe(
                  Effect.mapError(
                    () => new Unavailable({ code: "UNAVAILABLE" })
                  )
                )).worldRef
              : request.worldRef;
          yield* authorizeWorld(currentContext, worldRef);
          return decoded;
        },
        Effect.catchTag(
          "SqlError",
          () => new Unavailable({ code: "UNAVAILABLE" })
        ),
        Effect.timeoutOrElse({
          duration: `${D01_LIMITS.requestSeconds} seconds`,
          orElse: () => Effect.fail(new Expired({ code: "EXPIRED" })),
        }),
        Effect.provide(dependencies)
      );
      return SemanticExecutor.of({
        execute: (credential, bytes) =>
          execute("d01", credential, bytes).pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(D01Success)),
            Effect.catchTag(
              "SchemaError",
              () => new Unavailable({ code: "UNAVAILABLE" })
            )
          ),
        executeCorrection: (credential, bytes) =>
          execute("correction", credential, bytes).pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(CorrectionSuccess)),
            Effect.catchTag(
              "SchemaError",
              () => new Unavailable({ code: "UNAVAILABLE" })
            )
          ),
      });
    })
  );
}
