import type { EveDomainToolCall } from "@zoen/contracts/eve/tools";
import { EveToolLimits } from "@zoen/contracts/eve/tools";
import { InvalidInput, Unavailable } from "@zoen/contracts/worlds/errors";
import { FrameInspected, Inspect } from "@zoen/contracts/worlds/operations";
import type { SubjectKey, WorldRef } from "@zoen/contracts/worlds/values";
import { inspect } from "@zoen/ontology/knowledge/inspect";
import type { VerifiedRequestContext } from "@zoen/ontology/ports/worlds/context";
import {
  groundedBasisFromFrame,
  parseEveDomainToolCall,
  rejectDangerousToolPayload,
} from "@zoen/ontology/semantic/grounding";
import { Effect, Schema } from "effect";
import type { Effect as EffectType } from "effect";

/**
 * Admitted Eve domain tools (ZA-19).
 * Invokes the same `inspect` handler SemanticExecutor uses — one domain path,
 * composed from the trusted root. No recursive conversation→conversation tools.
 */

type DomainToolFailure = InvalidInput | Unavailable;

const invalid = () => new InvalidInput({ code: "INVALID_INPUT" });

const mapInspectError = (error: {
  readonly _tag: string;
}): DomainToolFailure =>
  error._tag === "InvalidInput"
    ? new InvalidInput({ code: "INVALID_INPUT" })
    : new Unavailable({ code: "UNAVAILABLE" });

/**
 * Shared Inspect path used by Eve tools. Requirements (SqlClient, etc.) come
 * from SemanticExecutor's ambient context when composed for AcceptConversationTurn.
 */
export const invokeInspectSubject = (
  context: VerifiedRequestContext,
  worldRef: WorldRef,
  subjectKey: typeof SubjectKey.Type
) =>
  Effect.gen(function* inspectSubject() {
    const request = yield* Schema.decodeEffect(Inspect)({
      input: { atFrame: null, subjectKey },
      operation: "Inspect",
      purpose: context.purpose,
      schemaVersion: "worlds.v1",
      worldRef,
    }).pipe(Effect.mapError(invalid));
    const result = yield* inspect(context, request).pipe(
      Effect.mapError(mapInspectError)
    );
    const inspected = yield* Schema.decodeEffect(FrameInspected)(result).pipe(
      Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
    );
    const basis = yield* groundedBasisFromFrame(inspected);
    const encoded = yield* Schema.encodeEffect(
      Schema.fromJsonString(Schema.Unknown)
    )(basis).pipe(
      Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
    );
    if (encoded.length > EveToolLimits.maxBytesPerToolResult) {
      return yield* new Unavailable({ code: "UNAVAILABLE" });
    }
    return basis;
  });

/** Admit a single structured tool call from untrusted model JSON. */
export const admitDomainToolCall = (
  raw: unknown
): EffectType.Effect<EveDomainToolCall, InvalidInput> =>
  Effect.gen(function* admit() {
    yield* rejectDangerousToolPayload(raw);
    return yield* parseEveDomainToolCall(raw);
  });

export const invokeAdmittedDomainTool = (
  context: VerifiedRequestContext,
  worldRef: WorldRef,
  raw: unknown
) =>
  Effect.gen(function* invoke() {
    const call = yield* admitDomainToolCall(raw);
    if (call.name !== "inspect_subject") {
      return yield* invalid();
    }
    return yield* invokeInspectSubject(
      context,
      worldRef,
      call.arguments.subjectKey
    );
  });
