/**
 * Worlds pack #1 — semantic operation inventory for OMS completeness checks.
 * Registry document: worlds.pack.json (loaded via default-registry).
 */

export const worldsSemanticOperations = [
  "CreatePersonalWorld",
  "ImportEvidence",
  "Inspect",
  "OpenEvidence",
  "ProposeCorrection",
  "AnswerQuestion",
  "UndoCorrection",
  "InspectWorldAccess",
  "GrantWorldReadAccess",
  "RevokeWorldReadAccess",
  "RequestWorldErasure",
  "InspectWorldErasure",
  "PurgeWorldContent",
] as const;

export type WorldsSemanticOperation = (typeof worldsSemanticOperations)[number];
