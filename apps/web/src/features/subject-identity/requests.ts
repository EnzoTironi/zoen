import { InvalidInput } from "@zoen/contracts/d01/errors";
import type { WorldRef } from "@zoen/contracts/d01/values";
import {
  InspectIdentityRecovery,
  InspectSubjectIdentity,
  ProposeIdentityResolution,
  ProposeIdentitySplit,
  ProposeIdentityUndo,
  ResolveIdentity,
} from "@zoen/contracts/subject-identity/operations";
import { IdentityPartitions } from "@zoen/contracts/subject-identity/question";
import { Effect, Schema } from "effect";

import { newOperationId } from "../d01/requests.ts";
import type { IdentityAnswerValue, IdentityInspectedFrame } from "./model.ts";

const envelope = {
  purpose: "personal-records",
  schemaVersion: "subject-identity.v1",
} as const;

const invalid = () => new InvalidInput({ code: "INVALID_INPUT" });

export const inspectIdentityRequest = (
  worldRef: WorldRef,
  anchors: readonly string[],
  from: string,
  to: string,
  atFrame: string | null
) =>
  Schema.decodeEffect(InspectSubjectIdentity)({
    ...envelope,
    input: {
      anchors,
      atFrame,
      interval: { _tag: "DateInterval", from, to },
    },
    operation: "InspectSubjectIdentity",
    worldRef,
  }).pipe(Effect.mapError(invalid));

export const inspectIdentityRecoveryRequest = (
  worldRef: WorldRef,
  anchor: string,
  from: string,
  to: string,
  targetDecisionRef: string | null,
  atFrame: string | null = null
) =>
  Schema.decodeEffect(InspectIdentityRecovery)({
    ...envelope,
    input: {
      anchor,
      atFrame,
      interval: { _tag: "DateInterval", from, to },
      targetDecisionRef,
    },
    operation: "InspectIdentityRecovery",
    worldRef,
  }).pipe(Effect.mapError(invalid));

/** Called only by explicit confirmation. Retry retains the resulting request unchanged. */
export const proposeSameAsRequest = Effect.fn("web.proposeSameAs")(
  function* proposeSameAsRequest(
    worldRef: WorldRef,
    frame: IdentityInspectedFrame,
    left: string,
    right: string
  ) {
    if (frame.kind !== "subject-identity") {
      return yield* invalid();
    }
    return yield* Schema.decodeEffect(ProposeIdentityResolution)({
      ...envelope,
      input: {
        frame: { frameRef: frame.frameRef, kind: "subject-identity" },
        left,
        right,
      },
      operation: "ProposeIdentityResolution",
      operationId: yield* newOperationId,
      worldRef,
    }).pipe(Effect.mapError(invalid));
  }
);

export const proposeSplitRequest = Effect.fn("web.proposeIdentitySplit")(
  function* proposeSplitRequest(
    worldRef: WorldRef,
    frame: IdentityInspectedFrame,
    anchor: string,
    partitionsByCell: IdentityPartitions
  ) {
    return yield* Schema.decodeEffect(ProposeIdentitySplit)({
      ...envelope,
      input: {
        anchor,
        frame: { frameRef: frame.frameRef, kind: frame.kind },
        partitionsByCell,
      },
      operation: "ProposeIdentitySplit",
      operationId: yield* newOperationId,
      worldRef,
    }).pipe(Effect.mapError(invalid));
  }
);

export const proposeUndoRequest = Effect.fn("web.proposeIdentityUndo")(
  function* proposeUndoRequest(
    worldRef: WorldRef,
    frame: IdentityInspectedFrame,
    targetDecisionRef: string
  ) {
    return yield* Schema.decodeEffect(ProposeIdentityUndo)({
      ...envelope,
      input: {
        frame: { frameRef: frame.frameRef, kind: frame.kind },
        targetDecisionRef,
      },
      operation: "ProposeIdentityUndo",
      operationId: yield* newOperationId,
      worldRef,
    }).pipe(Effect.mapError(invalid));
  }
);

export const resolveIdentityRequest = Effect.fn("web.resolveIdentity")(
  function* resolveIdentityRequest(
    worldRef: WorldRef,
    questionRef: string,
    consequenceDigest: string,
    answer: IdentityAnswerValue
  ) {
    return yield* Schema.decodeEffect(ResolveIdentity)({
      ...envelope,
      input: { answer, consequenceDigest, questionRef },
      operation: "ResolveIdentity",
      operationId: yield* newOperationId,
      worldRef,
    }).pipe(Effect.mapError(invalid));
  }
);

/** Prefer splitting the named anchor away from its component peers in every cell. */
export const partitionAnchorAway = (
  frame: IdentityInspectedFrame,
  anchor: string
): IdentityPartitions =>
  Schema.decodeSync(IdentityPartitions)(
    frame.cells.map((cell) => {
      const component = cell.components.find((item) =>
        (item.members as readonly string[]).includes(anchor)
      );
      const members = [...(component?.members ?? [anchor])];
      const others = members.filter((member) => member !== anchor);
      const blocks = others.length === 0 ? [members] : [[anchor], others];
      return { blocks, cellRef: cell.cellRef };
    })
  );
