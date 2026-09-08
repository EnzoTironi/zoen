import { WorldErasureSuccess } from "@zoen/contracts/erasure/operations";
import { EveConversationSuccess } from "@zoen/contracts/eve/operations";
import { SharingSuccess } from "@zoen/contracts/sharing/operations";
import { SubjectIdentitySuccess } from "@zoen/contracts/subject-identity/operations";
import type { SemanticError } from "@zoen/contracts/worlds/errors";
import {
  InvalidInput,
  Unauthenticated,
  Unavailable,
  Expired,
  Unsupported,
} from "@zoen/contracts/worlds/errors";
import {
  CorrectionSuccess,
  WorldSuccess,
  WorldCreated,
} from "@zoen/contracts/worlds/operations";
import type { SemanticSuccess } from "@zoen/contracts/worlds/operations";
import { WorldLimits, Instant } from "@zoen/contracts/worlds/values";
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
import { importEvidence } from "../evidence/worlds/import.js";
import { openEvidence } from "../evidence/worlds/open.js";
import { answerQuestion } from "../knowledge/corrections/answer.js";
import { proposeCorrection } from "../knowledge/corrections/propose.js";
import { parseCorrectionBytes } from "../knowledge/corrections/request.js";
import { undoCorrection } from "../knowledge/corrections/undo.js";
import { inspectWorldErasure } from "../knowledge/erasure/handlers/inspect.js";
import { purgeWorldContent } from "../knowledge/erasure/handlers/purge.js";
import { requestWorldErasure } from "../knowledge/erasure/handlers/request.js";
import { parseErasureBytes } from "../knowledge/erasure/request.js";
import {
  inspectIdentityRecovery,
  inspectSubjectIdentity,
} from "../knowledge/subject-identity/handlers/inspect.js";
import {
  proposeIdentityResolution,
  proposeIdentitySplit,
  proposeIdentityUndo,
} from "../knowledge/subject-identity/handlers/propose.js";
import { resolveIdentity } from "../knowledge/subject-identity/handlers/resolve.js";
import { parseSubjectIdentityBytes } from "../knowledge/subject-identity/request.js";
import { inspect } from "../knowledge/worlds/inspect.js";
import { DisclosureFence } from "../ports/disclosure/fence.js";
import { ErasureAttemptRegister } from "../ports/erasure/attempt-register.js";
import { ErasureCopyCatalog } from "../ports/erasure/copy-catalog.js";
import { ErasureObjectInventory } from "../ports/erasure/inventory.js";
import { ErasurePurgeStore } from "../ports/erasure/purge.js";
import { ErasureRestoreActivation } from "../ports/erasure/restore-activation.js";
import {
  acceptConversationTurn,
  cancelConversationTurn,
  recoverConversationJournal,
  settleConversationMessage,
} from "../ports/eve/handlers.js";
import { EveJournal } from "../ports/eve/journal.js";
import { EveOpenCodeZen } from "../ports/eve/opencode-zen.js";
import { parseEveBytes } from "../ports/eve/request.js";
import { Presence } from "../ports/worlds/context.js";
import { canonicalJson } from "../values/canonical.js";
import { parseEnvelopeBytes } from "../values/json.js";

type Family =
  | "worlds"
  | "correction"
  | "sharing"
  | "subject-identity"
  | "erasure"
  | "eve";
type Emit = (jsonBytes: Uint8Array) => "submitted";
type ExecuteWithEmission = (
  credential: Redacted.Redacted,
  bytes: Uint8Array,
  emit: Emit
) => Effect.Effect<void, SemanticError, Scope.Scope>;

const parseRequest = (family: Family, bytes: Uint8Array) => {
  switch (family) {
    case "worlds": {
      return parseEnvelopeBytes(bytes);
    }
    case "correction": {
      return parseCorrectionBytes(bytes);
    }
    case "sharing": {
      return parseSharingBytes(bytes);
    }
    case "subject-identity": {
      return parseSubjectIdentityBytes(bytes);
    }
    case "erasure": {
      return parseErasureBytes(bytes);
    }
    case "eve": {
      return parseEveBytes(bytes);
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
    case "worlds": {
      return Schema.decodeUnknownEffect(WorldSuccess)(result);
    }
    case "correction": {
      return Schema.decodeUnknownEffect(CorrectionSuccess)(result);
    }
    case "sharing": {
      return Schema.decodeUnknownEffect(SharingSuccess)(result);
    }
    case "subject-identity": {
      return Schema.decodeUnknownEffect(SubjectIdentitySuccess)(result);
    }
    case "erasure": {
      return Schema.decodeUnknownEffect(WorldErasureSuccess)(result);
    }
    case "eve": {
      return Schema.decodeUnknownEffect(EveConversationSuccess)(result);
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
    ) => Effect.Effect<WorldSuccess, SemanticError>;
    readonly executeCorrection: (
      credential: Redacted.Redacted,
      bytes: Uint8Array
    ) => Effect.Effect<CorrectionSuccess, SemanticError>;
    readonly executeSharing: (
      credential: Redacted.Redacted,
      bytes: Uint8Array
    ) => Effect.Effect<SharingSuccess, SemanticError>;
    readonly executeSubjectIdentity: (
      credential: Redacted.Redacted,
      bytes: Uint8Array
    ) => Effect.Effect<SubjectIdentitySuccess, SemanticError>;
    readonly executeErasure: (
      credential: Redacted.Redacted,
      bytes: Uint8Array
    ) => Effect.Effect<WorldErasureSuccess, SemanticError>;
    readonly executeEve: (
      credential: Redacted.Redacted,
      bytes: Uint8Array
    ) => Effect.Effect<EveConversationSuccess, SemanticError>;
    readonly executeWithEmission: ExecuteWithEmission;
    readonly executeCorrectionWithEmission: ExecuteWithEmission;
    readonly executeSharingWithEmission: ExecuteWithEmission;
    readonly executeSubjectIdentityWithEmission: ExecuteWithEmission;
    readonly executeErasureWithEmission: ExecuteWithEmission;
    readonly executeEveWithEmission: ExecuteWithEmission;
  }
>()("zoen/authority/semantic/SemanticExecutor") {
  /** Requires EveJournal + EveOpenCodeZen from the caller (composition provides live/blocked). */
  static readonly layerWithoutEve = Layer.effect(
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
            | ReturnType<typeof inspectSubjectIdentity>
            | ReturnType<typeof inspectIdentityRecovery>
            | ReturnType<typeof proposeIdentityResolution>
            | ReturnType<typeof resolveIdentity>
            | ReturnType<typeof requestWorldErasure>
            | ReturnType<typeof inspectWorldErasure>
            | ReturnType<typeof purgeWorldContent>
            | ReturnType<typeof acceptConversationTurn>
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
              DateTime.add(now, { seconds: WorldLimits.requestSeconds })
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
              case "InspectSubjectIdentity": {
                return yield* inspectSubjectIdentity(context, request);
              }
              case "InspectIdentityRecovery": {
                return yield* inspectIdentityRecovery(context, request);
              }
              case "ProposeIdentityResolution": {
                return yield* proposeIdentityResolution(context, request);
              }
              case "ProposeIdentitySplit": {
                return yield* proposeIdentitySplit(context, request);
              }
              case "ProposeIdentityUndo": {
                return yield* proposeIdentityUndo(context, request);
              }
              case "ResolveIdentity": {
                return yield* resolveIdentity(context, request);
              }
              case "RequestWorldErasure": {
                return yield* requestWorldErasure(context, request);
              }
              case "InspectWorldErasure": {
                return yield* inspectWorldErasure(context, request);
              }
              case "PurgeWorldContent": {
                return yield* purgeWorldContent(context, request);
              }
              case "AcceptConversationTurn": {
                return yield* acceptConversationTurn(context, request);
              }
              case "CancelConversationTurn": {
                return yield* cancelConversationTurn(context, request);
              }
              case "RecoverConversationJournal": {
                return yield* recoverConversationJournal(context, request);
              }
              case "SettleConversationMessage": {
                return yield* settleConversationMessage(context, request);
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
          if (jsonBytes.byteLength > WorldLimits.responseBytes) {
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
          duration: `${WorldLimits.requestSeconds} seconds`,
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
            const permit = yield* Effect.acquireRelease(
              fence
                .shared(
                  prepared.context.presence,
                  prepared.worldRef,
                  prepared.context.deadline,
                  // prepare may already have inserted disclosure_world_closing.
                  family === "erasure"
                    ? { allowAfterWorldClosing: true }
                    : undefined
                )
                .pipe(Scope.provide(requestScope)),
              (held) =>
                phase === "attempting"
                  ? Effect.void
                  : held.acknowledge.pipe(
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
                if (permit.authorizeSend() === "retired") {
                  return Effect.fail(schemaUnavailable());
                }
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
          execute("worlds", credential, bytes).pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(WorldSuccess)),
            Effect.catchTag("SchemaError", schemaUnavailable)
          ),
        executeCorrection: (credential, bytes) =>
          execute("correction", credential, bytes).pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(CorrectionSuccess)),
            Effect.catchTag("SchemaError", schemaUnavailable)
          ),
        executeCorrectionWithEmission: (credential, bytes, emit) =>
          withEmission("correction", credential, bytes, emit),
        executeErasure: (credential, bytes) =>
          execute("erasure", credential, bytes).pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(WorldErasureSuccess)),
            Effect.catchTag("SchemaError", schemaUnavailable)
          ),
        executeErasureWithEmission: (credential, bytes, emit) =>
          withEmission("erasure", credential, bytes, emit),
        executeEve: (credential, bytes) =>
          execute("eve", credential, bytes).pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(EveConversationSuccess)),
            Effect.catchTag("SchemaError", schemaUnavailable)
          ),
        executeEveWithEmission: (credential, bytes, emit) =>
          withEmission("eve", credential, bytes, emit),
        executeSharing: (credential, bytes) =>
          execute("sharing", credential, bytes).pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(SharingSuccess)),
            Effect.catchTag("SchemaError", schemaUnavailable)
          ),
        executeSharingWithEmission: (credential, bytes, emit) =>
          withEmission("sharing", credential, bytes, emit),
        executeSubjectIdentity: (credential, bytes) =>
          execute("subject-identity", credential, bytes).pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(SubjectIdentitySuccess)),
            Effect.catchTag("SchemaError", schemaUnavailable)
          ),
        executeSubjectIdentityWithEmission: (credential, bytes, emit) =>
          withEmission("subject-identity", credential, bytes, emit),
        executeWithEmission: (credential, bytes, emit) =>
          withEmission("worlds", credential, bytes, emit),
      });
    })
  );

  /**
   * Default test/local surface: in-memory journal + fail-closed Zen +
   * unqualified erasure inventory/purge/copy-catalog (composition overrides
   * with real Object Lock / profile adapters). Copy catalog stays fail-closed
   * so Unknown/Incomplete never admit Full Erased.
   */
  static readonly layer = SemanticExecutor.layerWithoutEve.pipe(
    Layer.provide(EveJournal.stubMemoryLayer),
    Layer.provide(EveOpenCodeZen.blockedLayer),
    Layer.provide(ErasureAttemptRegister.unqualifiedLayer),
    Layer.provide(ErasureRestoreActivation.unqualifiedLayer),
    Layer.provide(ErasureObjectInventory.unqualifiedLayer),
    Layer.provide(ErasurePurgeStore.unqualifiedLayer),
    Layer.provide(ErasureCopyCatalog.unqualifiedLayer)
  );
}
