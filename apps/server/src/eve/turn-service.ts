import type { EveGroundedBasis } from "@zoen/contracts/eve/tools";
import { EveToolLimits } from "@zoen/contracts/eve/tools";
import type { EveEvidenceLink } from "@zoen/contracts/eve/values";
import type {
  Blocked,
  Conflict,
  InvalidInput,
  NotFoundOrDenied,
  Unavailable as UnavailableError,
} from "@zoen/contracts/worlds/errors";
import {
  Blocked as BlockedError,
  Conflict as ConflictError,
  InvalidInput as InvalidInputError,
  NotFoundOrDenied as NotFoundOrDeniedError,
  Unavailable,
} from "@zoen/contracts/worlds/errors";
import type { WorldRef } from "@zoen/contracts/worlds/values";
import { SubjectKey } from "@zoen/contracts/worlds/values";
import { uncertaintyFromEvidenceBasis } from "@zoen/ontology/ports/eve/admission";
import { EveJournal } from "@zoen/ontology/ports/eve/journal";
import { EveOpenCodeZen } from "@zoen/ontology/ports/eve/opencode-zen";
import type {
  RunEveTurnInput,
  RunEveTurnResult,
} from "@zoen/ontology/ports/eve/turn";
import type { GroundSubjectInput } from "@zoen/ontology/ports/eve/turn-service";
import { EveTurnService } from "@zoen/ontology/ports/eve/turn-service";
import {
  evidenceLinksFromBasis,
  settleUncertaintyForGroundedTurn,
} from "@zoen/ontology/semantic/grounding";
import { Effect, Layer, Schema } from "effect";
import type { Effect as EffectType } from "effect";

import {
  admitDomainToolCall,
  invokeAdmittedDomainTool,
  invokeInspectSubject,
} from "./domain-tools.ts";

type TurnFailure =
  | Blocked
  | Conflict
  | InvalidInput
  | NotFoundOrDenied
  | UnavailableError;

const signalAborted = (signal: AbortSignal | undefined): boolean =>
  signal !== undefined && signal.aborted;

const assertProfileAdmission = (
  input: RunEveTurnInput
): EffectType.Effect<void, Blocked> => {
  if (
    input.providerAdmission === "voice-blocked" ||
    input.providerAdmission === "real-model-blocked"
  ) {
    return Effect.fail(new BlockedError({ code: "PROFILE_BLOCKED" }));
  }
  if (
    input.providerAdmission === "opencode-zen" &&
    input.profileId !== "eve-opencode-zen-v1"
  ) {
    return Effect.fail(new BlockedError({ code: "PROFILE_BLOCKED" }));
  }
  if (
    input.providerAdmission === "web-speech" &&
    input.profileId !== "eve-web-speech-v1"
  ) {
    return Effect.fail(new BlockedError({ code: "PROFILE_BLOCKED" }));
  }
  if (
    input.providerAdmission === "stub-local" &&
    input.profileId !== "eve-local-stub-v1"
  ) {
    return Effect.fail(new BlockedError({ code: "PROFILE_BLOCKED" }));
  }
  return Effect.void;
};

const collectGroundedBasis = (input: RunEveTurnInput, worldRef: WorldRef) =>
  Effect.gen(function* collect() {
    const requestContext = input.verifiedContext;
    if (requestContext === undefined) {
      return null;
    }
    let basis: EveGroundedBasis | null = null;
    let toolCount = 0;
    if (input.groundSubjectKey !== undefined) {
      const subjectKey = yield* Schema.decodeEffect(SubjectKey)(
        input.groundSubjectKey
      ).pipe(
        Effect.mapError(() => new InvalidInputError({ code: "INVALID_INPUT" }))
      );
      basis = yield* invokeInspectSubject(requestContext, worldRef, subjectKey);
      toolCount += 1;
    }
    if (input.toolCalls === undefined) {
      return basis;
    }
    for (const raw of input.toolCalls) {
      if (toolCount >= EveToolLimits.maxToolCallsPerTurn) {
        return yield* new InvalidInputError({ code: "INVALID_INPUT" });
      }
      yield* admitDomainToolCall(raw);
      basis = yield* invokeAdmittedDomainTool(requestContext, worldRef, raw);
      toolCount += 1;
      if (signalAborted(input.signal)) {
        return yield* new Unavailable({ code: "UNAVAILABLE" });
      }
    }
    return basis;
  });

const settleVisible = (
  input: RunEveTurnInput,
  worldRef: WorldRef | null,
  evidenceLinks: readonly EveEvidenceLink[],
  uncertainty: "Known" | "Partial" | "Unknown",
  visibleText: string
) =>
  Effect.gen(function* settle() {
    const journal = yield* EveJournal;
    return yield* journal.settleMessage({
      attemptId: input.attemptId,
      conversationId: input.conversationId,
      evidenceLinks: [...evidenceLinks],
      messageId: input.messageId,
      ownerPrincipalId: input.ownerPrincipalId,
      purpose: input.purpose,
      turnId: input.turnId,
      uncertainty,
      visibleText,
      worldRef,
    });
  });

/**
 * Grounded product turn: optional Inspect tools → model → settle with
 * authorized citations. ModelPort may be blocked (G-PROVIDER); tools still
 * work for evidence agreement proofs.
 */
export const runGroundedEveTurn = (input: RunEveTurnInput) =>
  Effect.gen(function* groundedTurn() {
    const journal = yield* EveJournal;
    const model = yield* EveOpenCodeZen;
    const worldRef = input.worldRef ?? null;
    yield* assertProfileAdmission(input);

    const accepted = yield* journal.acceptTurn({
      attemptId: input.attemptId,
      conversationId: input.conversationId,
      ingressId: input.ingressId,
      ownerPrincipalId: input.ownerPrincipalId,
      profileId: input.profileId,
      providerAdmission: input.providerAdmission,
      purpose: input.purpose,
      relationshipId: input.relationshipId,
      turnId: input.turnId,
      userText: input.userText,
      worldRef,
    });

    if (signalAborted(input.signal)) {
      yield* journal
        .cancelTurn({
          conversationId: input.conversationId,
          ownerPrincipalId: input.ownerPrincipalId,
          purpose: input.purpose,
          turnId: input.turnId,
          worldRef,
        })
        .pipe(Effect.ignore);
      return yield* new Unavailable({ code: "UNAVAILABLE" });
    }

    let basis: EveGroundedBasis | null = null;
    if (worldRef !== null) {
      const collected = yield* collectGroundedBasis(input, worldRef).pipe(
        Effect.catchTag("Unavailable", (error) =>
          Effect.gen(function* onToolAbort() {
            yield* journal
              .cancelTurn({
                conversationId: input.conversationId,
                ownerPrincipalId: input.ownerPrincipalId,
                purpose: input.purpose,
                turnId: input.turnId,
                worldRef,
              })
              .pipe(Effect.ignore);
            return yield* error;
          })
        )
      );
      basis = collected;
    }

    const citationsAuthorized = basis !== null;
    const evidenceLinks =
      basis === null
        ? [...(input.evidenceLinks ?? [])]
        : [...evidenceLinksFromBasis(basis)];

    if (input.providerAdmission === "stub-local") {
      const visibleText =
        basis === null
          ? "[stub-local] offline proof — not a live model reply"
          : `[stub-local] contested=${String(basis.contested)} facts=${String(basis.facts.length)} uncertainty=${basis.uncertainty}`;
      const message = yield* settleVisible(
        input,
        worldRef,
        evidenceLinks,
        settleUncertaintyForGroundedTurn({
          basis,
          citationsAuthorized,
          generatedText: visibleText,
        }),
        visibleText
      );
      return {
        message,
        turn: { ...accepted, phase: "Settled" as const },
      };
    }

    const groundedSystem =
      basis === null
        ? input.systemText
        : [
            input.systemText ?? "",
            "Authorized frame basis (do not invent facts):",
            `contested=${String(basis.contested)};facts=${String(basis.facts.length)};uncertainty=${basis.uncertainty};subject=${basis.subjectKey}`,
          ]
            .filter((part) => part.length > 0)
            .join("\n");

    const chatInput = {
      conversationId: input.conversationId,
      userText: input.userText,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
      ...(groundedSystem === undefined || groundedSystem.length === 0
        ? {}
        : { systemText: groundedSystem }),
    };

    const completion = yield* model.completeChat(chatInput).pipe(
      Effect.catch((error) =>
        Effect.gen(function* onModelFail() {
          yield* journal
            .cancelTurn({
              conversationId: input.conversationId,
              ownerPrincipalId: input.ownerPrincipalId,
              purpose: input.purpose,
              turnId: input.turnId,
              worldRef,
            })
            .pipe(Effect.ignore);
          return yield* error;
        })
      )
    );

    if (signalAborted(input.signal)) {
      yield* journal
        .cancelTurn({
          conversationId: input.conversationId,
          ownerPrincipalId: input.ownerPrincipalId,
          purpose: input.purpose,
          turnId: input.turnId,
          worldRef,
        })
        .pipe(Effect.ignore);
      return yield* new Unavailable({ code: "UNAVAILABLE" });
    }

    const snapshot = yield* journal.recover({
      conversationId: input.conversationId,
      ownerPrincipalId: input.ownerPrincipalId,
      purpose: input.purpose,
      worldRef,
    });
    const current = snapshot.turns.find((t) => t.turnId === input.turnId);
    if (current === undefined) {
      return yield* new NotFoundOrDeniedError({ code: "NOT_FOUND_OR_DENIED" });
    }
    if (current.phase === "Cancelled") {
      return yield* new ConflictError({ code: "CONFLICT" });
    }

    const uncertainty =
      basis === null
        ? uncertaintyFromEvidenceBasis({
            citationsAuthorized: false,
            evidenceLinks,
            generatedText: completion.visibleText,
          })
        : settleUncertaintyForGroundedTurn({
            basis,
            citationsAuthorized,
            generatedText: completion.visibleText,
          });

    const message = yield* settleVisible(
      input,
      worldRef,
      evidenceLinks,
      uncertainty,
      completion.visibleText
    );

    return {
      message,
      turn: { ...accepted, phase: "Settled" as const },
    };
  });

const groundSubjectEffect = (input: GroundSubjectInput) =>
  invokeInspectSubject(input.context, input.worldRef, input.subjectKey);

/**
 * Product grounded TurnService layer (ZA-19).
 * Domain-tool Inspect requirements (SqlClient, etc.) are satisfied by
 * SemanticExecutor ambient context when AcceptConversationTurn runs.
 */
/** Narrow R for model-only / cancel proofs (no Inspect tools). */
export const runGroundedModelTurn = (
  input: RunEveTurnInput
): EffectType.Effect<
  RunEveTurnResult,
  TurnFailure,
  EveJournal | EveOpenCodeZen
> =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion, effecttsgo/unsafe-effect-type-assertion -- conditional Inspect R not used when worldRef/tools absent
  runGroundedEveTurn(input) as EffectType.Effect<
    RunEveTurnResult,
    TurnFailure,
    EveJournal | EveOpenCodeZen
  >;

export const groundedEveTurnServiceLayer: Layer.Layer<EveTurnService> =
  Layer.succeed(
    EveTurnService,
    EveTurnService.of({
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- ambient SqlClient from SemanticExecutor
      groundSubject: ((input: GroundSubjectInput) =>
        groundSubjectEffect(
          input
        )) as EveTurnService["Service"]["groundSubject"],
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- ambient SqlClient from SemanticExecutor
      run: ((input: RunEveTurnInput) =>
        runGroundedEveTurn(input)) as EveTurnService["Service"]["run"],
    })
  );
