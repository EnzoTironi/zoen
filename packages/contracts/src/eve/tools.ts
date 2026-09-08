import { Schema } from "effect";

import {
  ClaimRef,
  EvidenceRef,
  SubjectKey,
  WorldRef,
  exact,
} from "../worlds/values.js";
import { EveSchemaVersion, UncertaintyKind } from "./values.js";

/**
 * Admitted Eve domain tools (ZA-19).
 * Exact released catalog — forged / unknown names are denied.
 * Tools invoke the shared SemanticExecutor domain path; not a second policy.
 */
export const EveDomainToolName = Schema.Literal("inspect_subject");
export type EveDomainToolName = typeof EveDomainToolName.Type;

/** Bounds for model/tool orchestration (server-enforced). */
export const EveToolLimits = {
  maxBytesPerToolResult: 65_536,
  maxToolCallsPerTurn: 4,
  maxVisibleFacts: 64,
} as const;

/** Structured tool call emitted by an untrusted model — schema-gated only. */
export const EveDomainToolCall = Schema.Struct({
  arguments: Schema.Struct({
    subjectKey: SubjectKey,
  }).annotate(exact),
  name: EveDomainToolName,
}).annotate(exact);
export type EveDomainToolCall = typeof EveDomainToolCall.Type;

/** One permitted fact projected from an authorized VisibleFrame claim. */
export const EveGroundedFact = Schema.Struct({
  claimRef: ClaimRef,
  evidenceRef: EvidenceRef,
  predicate: Schema.Literal("obligation.amount"),
  subjectKey: SubjectKey,
}).annotate(exact);
export type EveGroundedFact = typeof EveGroundedFact.Type;

/**
 * Evidence-bound basis for Eve composition (ZA-19 / F10).
 * Uncertainty is inherited from the authorized frame basis — never model prose.
 */
export const EveGroundedBasis = Schema.Struct({
  contested: Schema.Boolean,
  facts: Schema.Array(EveGroundedFact).check(
    Schema.isMaxLength(EveToolLimits.maxVisibleFacts)
  ),
  references: Schema.Array(EvidenceRef).check(
    Schema.isMaxLength(EveToolLimits.maxVisibleFacts)
  ),
  schemaVersion: EveSchemaVersion,
  subjectKey: SubjectKey,
  uncertainty: UncertaintyKind,
  worldRef: WorldRef,
}).annotate(exact);
export type EveGroundedBasis = typeof EveGroundedBasis.Type;

export const EveDomainToolResult = Schema.Struct({
  basis: EveGroundedBasis,
  name: EveDomainToolName,
}).annotate(exact);
export type EveDomainToolResult = typeof EveDomainToolResult.Type;
