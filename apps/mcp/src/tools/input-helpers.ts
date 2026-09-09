/**
 * Shared MCP arg coercions for host binders (Worlds + subject-identity escape hatch).
 */

import { Data } from "effect";

export const uuid = {
  description: "UUID",
  format: "uuid",
  type: "string",
} as const;

export const realm = {
  default: "live",
  description: "World realm; initial profile enables live only",
  enum: ["live", "evaluation"],
  type: "string",
} as const;

export const worldId = {
  ...uuid,
  description: "World UUID",
} as const;

export const operationId = {
  ...uuid,
  description: "Stable UUID; reuse the same value for retries",
} as const;

export const worldsEnvelope = {
  purpose: "personal-records",
  schemaVersion: "worlds.v1",
} as const;

export const sharingEnvelope = {
  purpose: "personal-records",
  schemaVersion: "sharing.v1",
} as const;

export const erasureEnvelope = {
  purpose: "personal-records",
  schemaVersion: "erasure.v1",
} as const;

export const subjectIdentityEnvelope = {
  purpose: "personal-records",
  schemaVersion: "subject-identity.v1",
} as const;

export const asString = (value: unknown, fallback?: string): string => {
  if (typeof value === "string") {
    return value;
  }
  if (fallback !== undefined) {
    return fallback;
  }
  return "";
};

export class McpInputError extends Data.TaggedError("McpInputError")<{
  readonly field: string;
}> {
  constructor(field: string) {
    super({ field });
  }
}

/** Omitted → live (schema default); typos fail closed — never coerce to live. */
export const asRealm = (value: unknown): "live" | "evaluation" => {
  if (value === undefined || value === null || value === "") {
    return "live";
  }
  if (value === "live" || value === "evaluation") {
    return value;
  }
  throw new McpInputError("realm");
};

export const asEvidenceFormat = (value: unknown): "json" | "csv" => {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    value === "json"
  ) {
    return "json";
  }
  if (value === "csv") {
    return "csv";
  }
  throw new McpInputError("format");
};

export const asCorrectionChoice = (
  value: unknown
): "select-claim" | "unknown" => {
  if (value === "select-claim" || value === "unknown") {
    return value;
  }
  throw new McpInputError("choice");
};

export const worldRef = (args: Record<string, unknown>) => ({
  realm: asRealm(args.realm),
  worldId: asString(args.worldId),
});

export const nullOrString = (value: unknown): string | null =>
  value === null || value === undefined || value === ""
    ? null
    : asString(value);

export const asIdentityAnswer = (
  value: unknown
): "same-as" | "different-from" | "confirm" | "unknown" => {
  if (
    value === "same-as" ||
    value === "different-from" ||
    value === "confirm" ||
    value === "unknown"
  ) {
    return value;
  }
  throw new McpInputError("answer");
};

export const asFrameKind = (
  value: unknown
): "subject-identity" | "subject-identity-recovery" => {
  if (value === undefined || value === null || value === "") {
    return "subject-identity";
  }
  if (value === "subject-identity" || value === "subject-identity-recovery") {
    return value;
  }
  throw new McpInputError("frameKind");
};

export const asStringArray = (value: unknown, field: string): string[] => {
  if (!Array.isArray(value)) {
    throw new McpInputError(field);
  }
  return value.map((entry, index) => {
    if (typeof entry !== "string" || entry.length === 0) {
      throw new McpInputError(`${field}[${index}]`);
    }
    return entry;
  });
};

const isPartitionCell = (
  value: unknown
): value is { readonly blocks: unknown; readonly cellRef: unknown } =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  "blocks" in value &&
  "cellRef" in value;

export const asPartitionsByCell = (value: unknown): unknown => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new McpInputError("partitionsByCell");
  }
  return value.map((cell, index) => {
    if (!isPartitionCell(cell)) {
      throw new McpInputError(`partitionsByCell[${index}]`);
    }
    const blocksRaw = cell.blocks;
    if (!Array.isArray(blocksRaw) || blocksRaw.length === 0) {
      throw new McpInputError(`partitionsByCell[${index}].blocks`);
    }
    return {
      blocks: blocksRaw.map((block, blockIndex) =>
        asStringArray(block, `partitionsByCell[${index}].blocks[${blockIndex}]`)
      ),
      cellRef: asString(cell.cellRef),
    };
  });
};
