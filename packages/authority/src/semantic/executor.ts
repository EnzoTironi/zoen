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
  WorldCreated,
} from "@zoen/contracts/d01/operations";
import type { SemanticSuccess } from "@zoen/contracts/d01/operations";
import { D01_LIMITS, Instant } from "@zoen/contracts/d01/values";
import { SharingSuccess } from "@zoen/contracts/sharing/operations";
import type { Redacted } from "effect";
import { Clock, Context, DateTime, Effect, Layer, Schema, Scope } from "effect";

import { validateContext, withinRequestDeadline } from "../access/context.js";
import { inspectWorldAccess } from "../access/sharing/inspect.js";
import {
  grantWorldReadAccess,
  revokeWorldReadAccess,
} from "../access/sharing/mutation.js";
import { parseSharingBytes } from "../access/sharing/request.js";
import { authorizeWorld, operationCapability } from "../access/world.js";
import { createPersonalWorld } from "../commit/genesis.js";
import { importEvidence } from "../evidence/d01/import.js";
import { openEvidence } from "../evidence/d01/open.js";
import { answerQuestion } from "../knowledge/corrections/answer.js";
import { proposeCorrection } from "../knowledge/corrections/propose.js";
import { parseCorrectionBytes } from "../knowledge/corrections/request.js";
import { undoCorrection } from "../knowledge/corrections/undo.js";
import { inspect } from "../knowledge/d01/inspect.js";
import { Presence } from "../ports/d01/context.js";
import { DisclosureFence } from "../ports/disclosure/fence.js";
import { canonicalJson } from "../values/canonical.js";
import { parseEnvelopeBytes } from "../values/json.js";

type Family = "d01" | "correction" | "sharing";
type Emit = (jsonBytes: Uint8Array) => "submitted";
type ExecuteWithEmission = (
  credential: Redacted.Redacted,
  bytes: Uint8Array,
  emit: Emit
) => Effect.Effect<void, D01Error, Scope.Scope>;

const parseRequest = (family: Family, bytes: Uint8Array) => {
  switch (family) {
    case "d01": {
      return parseEnvelopeBytes(bytes);
    }
    case "correction": {
      return parseCorrectionBytes(bytes);
    }
    case "sharing": {
      return parseSharingBytes(bytes);
    }
    default: {
      return Effect.fail(new Unsupported({ code: "UNSUPPORTED" }));
    }
  }
};
const decodeSuccess = (
  family: Family,
  result: unknown
): Effect.Effect<SemanticSuccess, Schema.SchemaError | Unsupported> => {
  switch (family) {
    case "d01": {
      return Schema.decodeUnknownEffect(D01Success)(result);
    }
    case "correction": {
      return Schema.decodeUnknownEffect(CorrectionSuccess)(result);
    }
    case "sharing": {
      return Schema.decodeUnknownEffect(SharingSuccess)(result);
    }
    default: {
      return Effect.fail(new Unsupported({ code: "UNSUPPORTED" }));
    }
  }
};
const schemaUnavailable = () => new Unavailable({ code: "UNAVAILABLE" });

export class SemanticExecutor extends Context.Service<
  SemanticExecutor,
  {
    /** In-process result only; adapters that emit bytes must use a scoped emission method. */
    readonly execute: (
      credential: Redacted.Redacted,
      bytes: Uint8Array
    ) => Effect.Effect<D01Success, D01Error>;
    readonly executeCorrection: (
      credential: Redacted.Redacted,
      bytes: Uint8Array
    ) => Effect.Effect<CorrectionSuccess, D01Error>;
    readonly executeSharing: (
      credential: Redacted.Redacted,
      bytes: Uint8Array
    ) => Effect.Effect<SharingSuccess, D01Error>;
    readonly executeWithEmission: ExecuteWithEmission;
    readonly executeCorrectionWithEmission: ExecuteWithEmission;
    readonly executeSharingWithEmission: ExecuteWithEmission;
  }
>()("zoen/authority/semantic/SemanticExecutor") {
  static readonly layer = Layer.effect(
    SemanticExecutor,
    Effect.gen(function* makeSemanticExecutor() {
      const presence = yield* Presence;
      const fence = yield* DisclosureFence;
      const dependencies = Context.omit(Scope.Scope)(
        yield* Effect.context<
          Effect.Services<
            | ReturnType<typeof createPersonalWorld>
            | ReturnType<typeof importEvidence>
            | ReturnType<typeof openEvidence>
            | ReturnType<typeof inspect>
            | ReturnType<typeof proposeCorrection>
            | ReturnType<typeof answerQuestion>
            | ReturnType<typeof undoCorrection>
            | ReturnType<typeof inspectWorldAccess>
            | ReturnType<typeof grantWorldReadAccess>
            | ReturnType<typeof revokeWorldReadAccess>
          >
        >()
      );
      const prepare = Effect.fn("authority.semantic.prepare")(
        function* prepare(
          family: Family,
          credential: Redacted.Redacted,
          bytes: Uint8Array
        ) {
          const request = yield* parseRequest(family, bytes);
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
              case "InspectWorldAccess": {
                return yield* inspectWorldAccess(context, request);
              }
              case "GrantWorldReadAccess": {
                return yield* grantWorldReadAccess(context, request);
              }
              case "RevokeWorldReadAccess": {
                return yield* revokeWorldReadAccess(context, request);
              }
              default: {
                return yield* new Unsupported({ code: "UNSUPPORTED" });
              }
            }
          }).pipe(withinRequestDeadline(context));
          const decoded = yield* decodeSuccess(family, result).pipe(
            Effect.catchTag("SchemaError", schemaUnavailable)
          );
          const jsonBytes = new TextEncoder().encode(
            yield* canonicalJson(decoded)
          );
          if (jsonBytes.byteLength > D01_LIMITS.responseBytes) {
            return yield* schemaUnavailable();
          }
          const worldRef =
            request.operation === "CreatePersonalWorld"
              ? (yield* Schema.decodeUnknownEffect(WorldCreated)(decoded).pipe(
                  Effect.catchTag("SchemaError", schemaUnavailable)
                )).worldRef
              : request.worldRef;
          return { context, jsonBytes, request, result: decoded, worldRef };
        },
        Effect.catchTag("SqlError", schemaUnavailable),
        Effect.timeoutOrElse({
          duration: `${D01_LIMITS.requestSeconds} seconds`,
          orElse: () => Effect.fail(new Expired({ code: "EXPIRED" })),
        }),
        Effect.provide(dependencies)
      );
      const revalidate = Effect.fn("authority.semantic.revalidate")(
        function* revalidate(
          prepared: Effect.Success<ReturnType<typeof prepare>>,
          credential: Redacted.Redacted
        ) {
          const verified = prepared.context.presence;
          const currentPresence = yield* presence.verify(credential);
          if (
            currentPresence.principalId !== verified.principalId ||
            currentPresence.sessionId !== verified.sessionId ||
            currentPresence.realm !== verified.realm
          ) {
            return yield* new Unauthenticated({ code: "PRESENCE_REQUIRED" });
          }
          const currentContext = yield* validateContext({
            ...prepared.context,
            presence: currentPresence,
          });
          yield* authorizeWorld(
            currentContext,
            prepared.worldRef,
            operationCapability(prepared.request.operation)
          );
          return currentContext;
        },
        Effect.catchTag("SqlError", schemaUnavailable),
        Effect.provide(dependencies)
      );
      const execute = Effect.fn("authority.semantic.execute")(function* execute(
        family: Family,
        credential: Redacted.Redacted,
        bytes: Uint8Array
      ) {
        const prepared = yield* prepare(family, credential, bytes);
        yield* revalidate(prepared, credential).pipe(
          withinRequestDeadline(prepared.context)
        );
        return prepared.result;
      });
      const withEmission = (
        family: Family,
        credential: Redacted.Redacted,
        bytes: Uint8Array,
        emit: Emit
      ) =>
        Effect.gen(function* emitAuthorizedResult() {
          const requestScope = yield* Scope.Scope;
          const clock = yield* Clock.Clock;
          const prepared = yield* prepare(family, credential, bytes);
          return yield* Effect.gen(function* authorizeEmission() {
            let phase: "prepared" | "attempting" | "submitted" = "prepared";
            yield* Effect.acquireRelease(
              fence
                .shared(
                  prepared.context.presence,
                  prepared.worldRef,
                  prepared.context.deadline
                )
                .pipe(Scope.provide(requestScope)),
              (permit) =>
                phase === "attempting"
                  ? Effect.void
                  : permit.acknowledge.pipe(
                      Effect.interruptible,
                      Effect.timeout("3 seconds"),
                      Effect.catch(() =>
                        Effect.logWarning({
                          event: "disclosure.acknowledgement_unavailable",
                        })
                      )
                    )
            ).pipe(Scope.provide(requestScope));
            const currentContext = yield* revalidate(prepared, credential);
            // No Effect boundary between the final time checks and the owned synchronous writer.
            yield* Effect.suspend(
              (): Effect.Effect<
                void,
                Expired | Unauthenticated | Unavailable
              > => {
                const now = clock.currentTimeMillisUnsafe();
                if (now >= Date.parse(prepared.context.deadline)) {
                  return Effect.fail(new Expired({ code: "EXPIRED" }));
                }
                if (
                  now >=
                  Math.min(
                    Date.parse(prepared.context.presence.expiresAt),
                    Date.parse(currentContext.presence.expiresAt)
                  )
                ) {
                  return Effect.fail(
                    new Unauthenticated({ code: "PRESENCE_REQUIRED" })
                  );
                }
                phase = "attempting";
                if (emit(prepared.jsonBytes) !== "submitted") {
                  return Effect.fail(schemaUnavailable());
                }
                phase = "submitted";
                return Effect.void;
              }
            );
          }).pipe(withinRequestDeadline(prepared.context));
        });
      return SemanticExecutor.of({
        execute: (credential, bytes) =>
          execute("d01", credential, bytes).pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(D01Success)),
            Effect.catchTag("SchemaError", schemaUnavailable)
          ),
        executeCorrection: (credential, bytes) =>
          execute("correction", credential, bytes).pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(CorrectionSuccess)),
            Effect.catchTag("SchemaError", schemaUnavailable)
          ),
        executeCorrectionWithEmission: (credential, bytes, emit) =>
          withEmission("correction", credential, bytes, emit),
        executeSharing: (credential, bytes) =>
          execute("sharing", credential, bytes).pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(SharingSuccess)),
            Effect.catchTag("SchemaError", schemaUnavailable)
          ),
        executeSharingWithEmission: (credential, bytes, emit) =>
          withEmission("sharing", credential, bytes, emit),
        executeWithEmission: (credential, bytes, emit) =>
          withEmission("d01", credential, bytes, emit),
      });
    })
  );
}
