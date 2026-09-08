import type {
  EveDomainToolCall,
  EveGroundedBasis,
  EveGroundedFact,
} from "@zoen/contracts/eve/tools";
import {
  EveDomainToolCall as EveDomainToolCallSchema,
  EveGroundedBasis as EveGroundedBasisSchema,
  EveToolLimits,
} from "@zoen/contracts/eve/tools";
import type {
  EveEvidenceLink,
  UncertaintyKind,
} from "@zoen/contracts/eve/values";
import { InvalidInput } from "@zoen/contracts/worlds/errors";
import type {
  VisibleClaim,
  VisibleFrame,
} from "@zoen/contracts/worlds/evidence";
// oxlint-disable-next-line typescript/consistent-type-imports -- Schema values for typeof *.Type
import { FrameInspected } from "@zoen/contracts/worlds/operations";
// oxlint-disable-next-line typescript/consistent-type-imports -- Schema value for typeof EvidenceRef.Type
import { EvidenceRef } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";
import type { Effect as EffectType } from "effect";

import { uncertaintyFromEvidenceBasis } from "../ports/eve/admission.js";

/**
 * ZA-19 evidence grounding — pure projection + tool admission.
 * Uncertainty comes from the authorized frame/evidence basis, never prose length
 * or model confidence (F10).
 */

type FrameInspectedSuccess = typeof FrameInspected.Type;
type EvidenceRefId = typeof EvidenceRef.Type;

const invalidTool = () => new InvalidInput({ code: "INVALID_INPUT" });

/** Decode untrusted model/tool JSON against the exact released tool schema. */
export const parseEveDomainToolCall = (
  raw: unknown
): EffectType.Effect<EveDomainToolCall, InvalidInput> =>
  Schema.decodeUnknownEffect(EveDomainToolCallSchema)(raw).pipe(
    Effect.mapError(invalidTool)
  );

/** Reject raw SQL / shell / credential-shaped payloads before any domain work. */
export const rejectDangerousToolPayload = (
  raw: unknown
): EffectType.Effect<void, InvalidInput> => {
  const text = typeof raw === "string" ? raw : JSON.stringify(raw);
  const lowered = text.toLowerCase();
  const banned = [
    "select ",
    "insert ",
    "update ",
    "delete ",
    "drop ",
    ";--",
    "/bin/",
    "bash -",
    "sh -c",
    "process.env",
    "zoen_opencode_api_key",
    "authorization:",
    "bearer ",
  ] as const;
  for (const token of banned) {
    if (lowered.includes(token)) {
      return Effect.fail(invalidTool());
    }
  }
  return Effect.void;
};

const coverageToUncertainty = (
  coverage: VisibleFrame["coverage"],
  contested: boolean,
  claimCount: number
): UncertaintyKind => {
  if (claimCount === 0 || coverage._tag === "Unknown") {
    return "Unknown";
  }
  if (contested || coverage._tag === "Partial") {
    return "Partial";
  }
  return "Partial";
};

/** Project an authorized FrameInspected success into Eve's grounded basis. */
export const groundedBasisFromFrame = (
  inspected: FrameInspectedSuccess
): EffectType.Effect<EveGroundedBasis, InvalidInput> => {
  const { frame } = inspected;
  const truncated = frame.claims.length > EveToolLimits.maxVisibleFacts;
  const facts: EveGroundedFact[] = frame.claims
    .slice(0, EveToolLimits.maxVisibleFacts)
    .map(({ claimRef, evidenceRef, predicate, subjectKey }: VisibleClaim) => ({
      claimRef,
      evidenceRef,
      predicate,
      subjectKey,
    }));
  const references: EvidenceRefId[] = [];
  const seen = new Set<string>();
  for (const fact of facts) {
    if (!seen.has(fact.evidenceRef)) {
      seen.add(fact.evidenceRef);
      references.push(fact.evidenceRef);
    }
  }
  // Truncation must not imply complete coverage of the authorized frame.
  const uncertainty = truncated
    ? "Partial"
    : coverageToUncertainty(frame.coverage, frame.contested, facts.length);
  return Schema.decodeEffect(EveGroundedBasisSchema)({
    contested: frame.contested,
    facts,
    references,
    schemaVersion: "eve.v1",
    subjectKey: frame.subjectKey,
    uncertainty,
    worldRef: frame.worldRef,
  }).pipe(Effect.mapError(invalidTool));
};

/** Evidence links derived from an authorized grounded basis (citationsAuthorized). */
export const evidenceLinksFromBasis = (
  basis: EveGroundedBasis
): readonly EveEvidenceLink[] =>
  basis.facts.map((fact) => ({
    claimRef: fact.claimRef,
    evidenceRef: fact.evidenceRef,
  }));

/**
 * Settle uncertainty for a grounded turn: authorized citations inherit frame
 * uncertainty; empty generation stays Unknown; never Known from prose alone.
 */
export const settleUncertaintyForGroundedTurn = (input: {
  readonly basis: EveGroundedBasis | null;
  readonly citationsAuthorized: boolean;
  readonly generatedText: string;
}): UncertaintyKind => {
  const trimmed = input.generatedText.trim();
  if (trimmed.length === 0) {
    return "Unknown";
  }
  if (input.basis === null || !input.citationsAuthorized) {
    return uncertaintyFromEvidenceBasis({
      citationsAuthorized: false,
      evidenceLinks: [],
      generatedText: trimmed,
    });
  }
  // Inherit supported basis uncertainty (contested/partial/unknown) — never upgrade.
  return input.basis.uncertainty;
};

export interface SemanticAgreement {
  readonly contestedAgree: boolean;
  readonly factRefsAgree: boolean;
  readonly referencesAgree: boolean;
  readonly subjectAgree: boolean;
  readonly uncertaintyAgree: boolean;
}

const sameStringSet = <T>(a: Set<T>, b: Set<T>): boolean => {
  if (a.size !== b.size) {
    return false;
  }
  for (const value of a) {
    if (!b.has(value)) {
      return false;
    }
  }
  return true;
};

/**
 * Compare Eve tool basis vs the same ordered, bounded projection used by
 * `groundedBasisFromFrame` (EveToolLimits.maxVisibleFacts). Full frames may
 * exceed that bound; agreement is against the defined Eve projection, not the
 * raw untruncated claim set.
 */
export const semanticAgreement = (
  basis: EveGroundedBasis,
  inspected: FrameInspectedSuccess
): SemanticAgreement => {
  const { frame } = inspected;
  const truncated = frame.claims.length > EveToolLimits.maxVisibleFacts;
  const projectedClaims = frame.claims.slice(0, EveToolLimits.maxVisibleFacts);
  const basisClaimRefs = new Set(basis.facts.map((f) => f.claimRef));
  const frameClaimRefs = new Set(
    projectedClaims.map(({ claimRef }: VisibleClaim) => claimRef)
  );
  const basisEvidence = new Set(basis.references);
  const frameEvidence = new Set(
    projectedClaims.map(({ evidenceRef }: VisibleClaim) => evidenceRef)
  );
  const expectedUncertainty = truncated
    ? "Partial"
    : coverageToUncertainty(
        frame.coverage,
        frame.contested,
        projectedClaims.length
      );
  return {
    contestedAgree: basis.contested === frame.contested,
    factRefsAgree: sameStringSet(basisClaimRefs, frameClaimRefs),
    referencesAgree: sameStringSet(basisEvidence, frameEvidence),
    subjectAgree: basis.subjectKey === frame.subjectKey,
    uncertaintyAgree: basis.uncertainty === expectedUncertainty,
  };
};

export const basesAgreeSemantically = (
  basis: EveGroundedBasis,
  inspected: FrameInspectedSuccess
): boolean => {
  const agreement = semanticAgreement(basis, inspected);
  return (
    agreement.contestedAgree &&
    agreement.factRefsAgree &&
    agreement.referencesAgree &&
    agreement.subjectAgree &&
    agreement.uncertaintyAgree
  );
};
