/**
 * MCP tool registry = Worlds semantic verbs already in contracts/CLI.
 * Names match SemanticRequest.operation literals — no invented product verbs.
 */

import { Data } from "effect";

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: {
    readonly type: "object";
    readonly properties: Record<string, unknown>;
    readonly required?: readonly string[];
    readonly additionalProperties: false;
  };
  readonly buildRequest: (args: Record<string, unknown>) => unknown;
}

const uuid = {
  description: "UUID",
  format: "uuid",
  type: "string",
} as const;

const realm = {
  default: "live",
  description: "World realm; initial profile enables live only",
  enum: ["live", "evaluation"],
  type: "string",
} as const;

const worldId = {
  ...uuid,
  description: "World UUID",
} as const;

const operationId = {
  ...uuid,
  description: "Stable UUID; reuse the same value for retries",
} as const;

const worldsEnvelope = {
  purpose: "personal-records",
  schemaVersion: "worlds.v1",
} as const;

const sharingEnvelope = {
  purpose: "personal-records",
  schemaVersion: "sharing.v1",
} as const;

const erasureEnvelope = {
  purpose: "personal-records",
  schemaVersion: "erasure.v1",
} as const;

const subjectIdentityEnvelope = {
  purpose: "personal-records",
  schemaVersion: "subject-identity.v1",
} as const;

const asString = (value: unknown, fallback?: string): string => {
  if (typeof value === "string") {
    return value;
  }
  if (fallback !== undefined) {
    return fallback;
  }
  return "";
};

class McpInputError extends Data.TaggedError("McpInputError")<{
  readonly field: string;
}> {
  constructor(field: string) {
    super({ field });
  }
}

/** Omitted → live (schema default); typos fail closed — never coerce to live. */
const asRealm = (value: unknown): "live" | "evaluation" => {
  if (value === undefined || value === null || value === "") {
    return "live";
  }
  if (value === "live" || value === "evaluation") {
    return value;
  }
  throw new McpInputError("realm");
};

const asEvidenceFormat = (value: unknown): "json" | "csv" => {
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

const asCorrectionChoice = (value: unknown): "select-claim" | "unknown" => {
  if (value === "select-claim" || value === "unknown") {
    return value;
  }
  throw new McpInputError("choice");
};

const worldRef = (args: Record<string, unknown>) => ({
  realm: asRealm(args.realm),
  worldId: asString(args.worldId),
});

const nullOrString = (value: unknown): string | null =>
  value === null || value === undefined || value === ""
    ? null
    : asString(value);

const asIdentityAnswer = (
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

const asFrameKind = (
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

const asStringArray = (value: unknown, field: string): string[] => {
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

const asPartitionsByCell = (value: unknown): unknown => {
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

export const toolDefinitions: readonly ToolDefinition[] = [
  {
    buildRequest: (args) => ({
      ...worldsEnvelope,
      input: {},
      operation: "CreatePersonalWorld",
      operationId: asString(args.operationId),
    }),
    description:
      "Create a private World (genesis). Caller supplies operationId for retries. Empty input; seed comes from the admitted image/profile.",
    inputSchema: {
      additionalProperties: false,
      properties: { operationId },
      required: ["operationId"],
      type: "object",
    },
    name: "CreatePersonalWorld",
  },
  {
    buildRequest: (args) => ({
      ...worldsEnvelope,
      input:
        asEvidenceFormat(args.format) === "csv"
          ? { document: asString(args.document), format: "worlds.csv.v1" }
          : { document: asString(args.document) },
      operation: "ImportEvidence",
      operationId: asString(args.operationId),
      worldRef: worldRef(args),
    }),
    description:
      "Import authorized evidence (JSON or Zoen CSV dialect). Bytes are not normalized by the client; the public executor authorizes admission.",
    inputSchema: {
      additionalProperties: false,
      properties: {
        document: {
          description: "Original UTF-8 document text",
          type: "string",
        },
        format: {
          default: "json",
          description:
            "json = legacy worlds JSON; csv = worlds.csv.v1 with explicit selector",
          enum: ["json", "csv"],
          type: "string",
        },
        operationId,
        realm,
        worldId,
      },
      required: ["document", "operationId", "worldId"],
      type: "object",
    },
    name: "ImportEvidence",
  },
  {
    buildRequest: (args) => ({
      ...worldsEnvelope,
      input: {
        atFrame: nullOrString(args.atFrame),
        subjectKey: asString(args.subjectKey),
      },
      operation: "Inspect",
      worldRef: worldRef(args),
    }),
    description:
      "Inspect a subject at a recorded frame or the current authorized frame.",
    inputSchema: {
      additionalProperties: false,
      properties: {
        atFrame: {
          ...uuid,
          description: "Optional FrameRef; omit/null for current frame",
        },
        realm,
        subjectKey: {
          description: "Subject key to inspect",
          minLength: 1,
          type: "string",
        },
        worldId,
      },
      required: ["subjectKey", "worldId"],
      type: "object",
    },
    name: "Inspect",
  },
  {
    buildRequest: (args) => ({
      ...worldsEnvelope,
      input: { evidenceRef: asString(args.evidenceRef) },
      operation: "OpenEvidence",
      worldRef: worldRef(args),
    }),
    description: "Read authorized evidence through the server.",
    inputSchema: {
      additionalProperties: false,
      properties: {
        evidenceRef: { ...uuid, description: "Evidence reference UUID" },
        realm,
        worldId,
      },
      required: ["evidenceRef", "worldId"],
      type: "object",
    },
    name: "OpenEvidence",
  },
  {
    buildRequest: (args) => {
      const choice =
        asCorrectionChoice(args.choice) === "select-claim"
          ? { _tag: "selectClaim", claimRef: asString(args.claimRef) }
          : { _tag: "unknown" };
      return {
        ...worldsEnvelope,
        input: {
          consequence: {
            choice,
            subjectKey: asString(args.subjectKey),
            validTime: {
              _tag: "DateInterval",
              from: asString(args.validFrom),
              to: asString(args.validTo),
            },
          },
          frameRef: asString(args.frameRef),
        },
        operation: "ProposeCorrection",
        operationId: asString(args.operationId),
        worldRef: worldRef(args),
      };
    },
    description:
      "Propose a decision for one obligation and interval; returns a Question and exact consequence digest.",
    inputSchema: {
      additionalProperties: false,
      properties: {
        choice: {
          description: "select-claim requires claimRef; unknown marks unknown",
          enum: ["select-claim", "unknown"],
          type: "string",
        },
        claimRef: {
          ...uuid,
          description: "Required only for choice select-claim",
        },
        frameRef: { ...uuid, description: "Retained Frame reference" },
        operationId,
        realm,
        subjectKey: { minLength: 1, type: "string" },
        validFrom: {
          description: "Inclusive civil date YYYY-MM-DD",
          type: "string",
        },
        validTo: {
          description: "Exclusive civil date YYYY-MM-DD",
          type: "string",
        },
        worldId,
      },
      required: [
        "choice",
        "frameRef",
        "operationId",
        "subjectKey",
        "validFrom",
        "validTo",
        "worldId",
      ],
      type: "object",
    },
    name: "ProposeCorrection",
  },
  {
    buildRequest: (args) => ({
      ...worldsEnvelope,
      input: {
        answer: asString(args.answer),
        consequenceDigest: asString(args.consequenceDigest),
        questionRef: asString(args.questionRef),
      },
      operation: "AnswerQuestion",
      operationId: asString(args.operationId),
      worldRef: worldRef(args),
    }),
    description:
      "Answer the exact retained Question; stale consent is rejected by the server.",
    inputSchema: {
      additionalProperties: false,
      properties: {
        answer: {
          enum: ["confirm", "unknown"],
          type: "string",
        },
        consequenceDigest: {
          description: "Exact digest returned with the Question",
          type: "string",
        },
        operationId,
        questionRef: { ...uuid },
        realm,
        worldId,
      },
      required: [
        "answer",
        "consequenceDigest",
        "operationId",
        "questionRef",
        "worldId",
      ],
      type: "object",
    },
    name: "AnswerQuestion",
  },
  {
    buildRequest: (args) => ({
      ...worldsEnvelope,
      input: {
        correctionRef: asString(args.correctionRef),
        frameRef: asString(args.frameRef),
      },
      operation: "UndoCorrection",
      operationId: asString(args.operationId),
      worldRef: worldRef(args),
    }),
    description:
      "Append an undo event for the effective scoped decision; retain previous receipts and Frames.",
    inputSchema: {
      additionalProperties: false,
      properties: {
        correctionRef: { ...uuid },
        frameRef: { ...uuid },
        operationId,
        realm,
        worldId,
      },
      required: ["correctionRef", "frameRef", "operationId", "worldId"],
      type: "object",
    },
    name: "UndoCorrection",
  },
  {
    buildRequest: (args) => ({
      ...sharingEnvelope,
      input: { principalRef: nullOrString(args.principalRef) },
      operation: "InspectWorldAccess",
      worldRef: worldRef(args),
    }),
    description:
      "Read current membership. Omit principalRef for your own access; only an owner may inspect an exact recipient. No member listing.",
    inputSchema: {
      additionalProperties: false,
      properties: {
        principalRef: {
          ...uuid,
          description: "Optional recipient account UUID",
        },
        realm,
        worldId,
      },
      required: ["worldId"],
      type: "object",
    },
    name: "InspectWorldAccess",
  },
  {
    buildRequest: (args) => ({
      ...sharingEnvelope,
      input: {
        expectedRevision:
          args.expectedRevision === null || args.expectedRevision === "null"
            ? null
            : asString(args.expectedRevision),
        principalRef: asString(args.principalRef),
      },
      operation: "GrantWorldReadAccess",
      operationId: asString(args.operationId),
      worldRef: worldRef(args),
    }),
    description:
      "Owner: grant viewer access to ALL existing and future evidence and claims in this World. Private corrections, Questions and Frames are excluded.",
    inputSchema: {
      additionalProperties: false,
      properties: {
        expectedRevision: {
          description:
            "Revision from InspectWorldAccess; null means no membership exists",
          oneOf: [{ type: "string", pattern: "^[0-9]+$" }, { type: "null" }],
        },
        operationId,
        principalRef: { ...uuid },
        realm,
        worldId,
      },
      required: ["expectedRevision", "operationId", "principalRef", "worldId"],
      type: "object",
    },
    name: "GrantWorldReadAccess",
  },
  {
    buildRequest: (args) => ({
      ...sharingEnvelope,
      input: {
        expectedRevision: asString(args.expectedRevision),
        principalRef: asString(args.principalRef),
      },
      operation: "RevokeWorldReadAccess",
      operationId: asString(args.operationId),
      worldRef: worldRef(args),
    }),
    description:
      "Owner: revoke a viewer's reading access using its exact current revision. Evidence and copies already received are retained.",
    inputSchema: {
      additionalProperties: false,
      properties: {
        expectedRevision: {
          description: "Exact decimal revision from InspectWorldAccess",
          pattern: "^[0-9]+$",
          type: "string",
        },
        operationId,
        principalRef: { ...uuid },
        realm,
        worldId,
      },
      required: ["expectedRevision", "operationId", "principalRef", "worldId"],
      type: "object",
    },
    name: "RevokeWorldReadAccess",
  },
  {
    buildRequest: (args) => ({
      ...erasureEnvelope,
      input: { operationId: nullOrString(args.operationId) },
      operation: "InspectWorldErasure",
      worldRef: worldRef(args),
    }),
    description:
      "Owner: read narrow administrative erasure progress. Not content disclosure. Restore-after-erasure remains false.",
    inputSchema: {
      additionalProperties: false,
      properties: {
        operationId: {
          ...uuid,
          description: "Optional Closing operation UUID to narrow inspect",
        },
        realm,
        worldId,
      },
      required: ["worldId"],
      type: "object",
    },
    name: "InspectWorldErasure",
  },
  {
    buildRequest: (args) => ({
      ...erasureEnvelope,
      input: {
        confirmEntireWorld: true,
        expectedErasureRevision:
          args.expectedRevision === null || args.expectedRevision === "null"
            ? null
            : asString(args.expectedRevision),
        policyVersion: asString(args.policyVersion, "worlds-local-erasable-v1"),
      },
      operation: "RequestWorldErasure",
      operationId: asString(args.operationId),
      worldRef: worldRef(args),
    }),
    description:
      "Owner: request World-scoped Closing after inspect. Requires confirmEntireWorld=true. Does not claim Erased or restore.",
    inputSchema: {
      additionalProperties: false,
      properties: {
        confirmEntireWorld: {
          const: true,
          description:
            "Required explicit confirmation for entire-World Closing",
          type: "boolean",
        },
        expectedRevision: {
          description:
            "Revision from InspectWorldErasure; null means Active with no progress row",
          oneOf: [{ type: "string", pattern: "^[0-9]+$" }, { type: "null" }],
        },
        operationId,
        policyVersion: {
          default: "worlds-local-erasable-v1",
          enum: ["worlds-local-erasable-v1"],
          type: "string",
        },
        realm,
        worldId,
      },
      required: [
        "confirmEntireWorld",
        "expectedRevision",
        "operationId",
        "worldId",
      ],
      type: "object",
    },
    name: "RequestWorldErasure",
  },
  {
    buildRequest: (args) => ({
      ...erasureEnvelope,
      input: {
        closingOperationId: asString(args.closingOperationId),
        expectedErasureRevision: asString(args.expectedRevision),
      },
      operation: "PurgeWorldContent",
      operationId: asString(args.operationId),
      worldRef: worldRef(args),
    }),
    description:
      "Owner: purge local controlled SQL content + World object versions after Closing+Confirmed. restore-after-erasure stays false.",
    inputSchema: {
      additionalProperties: false,
      properties: {
        closingOperationId: {
          ...uuid,
          description: "Closing operation UUID from RequestWorldErasure",
        },
        expectedRevision: {
          description: "Erasure revision while phase is Closing/Purging",
          pattern: "^[0-9]+$",
          type: "string",
        },
        operationId,
        realm,
        worldId,
      },
      required: [
        "closingOperationId",
        "expectedRevision",
        "operationId",
        "worldId",
      ],
      type: "object",
    },
    name: "PurgeWorldContent",
  },
  {
    buildRequest: (args) => ({
      ...subjectIdentityEnvelope,
      input: {
        anchors: asStringArray(args.anchors, "anchors"),
        atFrame: nullOrString(args.atFrame),
        interval: {
          _tag: "DateInterval",
          from: asString(args.validFrom),
          to: asString(args.validTo),
        },
      },
      operation: "InspectSubjectIdentity",
      worldRef: worldRef(args),
    }),
    description:
      "Inspect the private subject-identity graph for 1–2 anchors and an interval. Prints closure, cells and comparisons; no mutation.",
    inputSchema: {
      additionalProperties: false,
      properties: {
        anchors: {
          description: "1 or 2 subject keys to seed the private graph",
          items: { minLength: 1, type: "string" },
          maxItems: 2,
          minItems: 1,
          type: "array",
        },
        atFrame: {
          ...uuid,
          description: "Optional retained Frame reference",
        },
        realm,
        validFrom: {
          description: "Inclusive civil date YYYY-MM-DD",
          type: "string",
        },
        validTo: {
          description: "Exclusive civil date YYYY-MM-DD",
          type: "string",
        },
        worldId,
      },
      required: ["anchors", "validFrom", "validTo", "worldId"],
      type: "object",
    },
    name: "InspectSubjectIdentity",
  },
  {
    buildRequest: (args) => ({
      ...subjectIdentityEnvelope,
      input: {
        anchor: asString(args.anchor),
        atFrame: nullOrString(args.atFrame),
        interval: {
          _tag: "DateInterval",
          from: asString(args.validFrom),
          to: asString(args.validTo),
        },
        targetDecisionRef: nullOrString(args.targetDecisionRef),
      },
      operation: "InspectIdentityRecovery",
      worldRef: worldRef(args),
    }),
    description:
      "Inspect structural recovery only. comparison is not-requested; no value comparisons. Use before split/undo when claims exceed comparative quota.",
    inputSchema: {
      additionalProperties: false,
      properties: {
        anchor: { minLength: 1, type: "string" },
        atFrame: {
          ...uuid,
          description: "Optional retained Frame reference",
        },
        realm,
        targetDecisionRef: {
          ...uuid,
          description: "Optional decision to center recovery/undo inspection",
        },
        validFrom: {
          description: "Inclusive civil date YYYY-MM-DD",
          type: "string",
        },
        validTo: {
          description: "Exclusive civil date YYYY-MM-DD",
          type: "string",
        },
        worldId,
      },
      required: ["anchor", "validFrom", "validTo", "worldId"],
      type: "object",
    },
    name: "InspectIdentityRecovery",
  },
  {
    buildRequest: (args) => ({
      ...subjectIdentityEnvelope,
      input: {
        frame: {
          frameRef: asString(args.frameRef),
          kind: "subject-identity",
        },
        left: asString(args.left),
        right: asString(args.right),
      },
      operation: "ProposeIdentityResolution",
      operationId: asString(args.operationId),
      worldRef: worldRef(args),
    }),
    description:
      "Propose same-as/different-from for two anchors against an inspected identity Frame. Reuse operationId on transport retry; Stale requires a new inspect and a new operation.",
    inputSchema: {
      additionalProperties: false,
      properties: {
        frameRef: { ...uuid, description: "Retained identity Frame reference" },
        left: { minLength: 1, type: "string" },
        operationId,
        realm,
        right: { minLength: 1, type: "string" },
        worldId,
      },
      required: ["frameRef", "left", "operationId", "right", "worldId"],
      type: "object",
    },
    name: "ProposeIdentityResolution",
  },
  {
    buildRequest: (args) => ({
      ...subjectIdentityEnvelope,
      input: {
        anchor: asString(args.anchor),
        frame: {
          frameRef: asString(args.frameRef),
          kind: asFrameKind(args.frameKind),
        },
        partitionsByCell: asPartitionsByCell(args.partitionsByCell),
      },
      operation: "ProposeIdentitySplit",
      operationId: asString(args.operationId),
      worldRef: worldRef(args),
    }),
    description:
      "Propose a full structural split against an inspected Frame. Confirmation applies the entire partition; Stale needs a fresh inspect and new operationId.",
    inputSchema: {
      additionalProperties: false,
      properties: {
        anchor: { minLength: 1, type: "string" },
        frameKind: {
          default: "subject-identity",
          description: "Frame kind returned by the preceding inspect",
          enum: ["subject-identity", "subject-identity-recovery"],
          type: "string",
        },
        frameRef: { ...uuid },
        operationId,
        partitionsByCell: {
          description:
            "Array of {cellRef, blocks: string[][]} covering each cell",
          items: {
            additionalProperties: false,
            properties: {
              blocks: {
                items: {
                  items: { minLength: 1, type: "string" },
                  type: "array",
                },
                type: "array",
              },
              cellRef: { type: "string" },
            },
            required: ["blocks", "cellRef"],
            type: "object",
          },
          type: "array",
        },
        realm,
        worldId,
      },
      required: [
        "anchor",
        "frameRef",
        "operationId",
        "partitionsByCell",
        "worldId",
      ],
      type: "object",
    },
    name: "ProposeIdentitySplit",
  },
  {
    buildRequest: (args) => ({
      ...subjectIdentityEnvelope,
      input: {
        frame: {
          frameRef: asString(args.frameRef),
          kind: asFrameKind(args.frameKind),
        },
        targetDecisionRef: asString(args.targetDecisionRef),
      },
      operation: "ProposeIdentityUndo",
      operationId: asString(args.operationId),
      worldRef: worldRef(args),
    }),
    description:
      "Propose undoing one identity decision using a comparative or recovery Frame. Recovery Questions declare comparison not-requested.",
    inputSchema: {
      additionalProperties: false,
      properties: {
        frameKind: {
          default: "subject-identity",
          description: "Frame kind returned by the preceding inspect",
          enum: ["subject-identity", "subject-identity-recovery"],
          type: "string",
        },
        frameRef: { ...uuid },
        operationId,
        realm,
        targetDecisionRef: { ...uuid },
        worldId,
      },
      required: ["frameRef", "operationId", "targetDecisionRef", "worldId"],
      type: "object",
    },
    name: "ProposeIdentityUndo",
  },
  {
    buildRequest: (args) => ({
      ...subjectIdentityEnvelope,
      input: {
        answer: asIdentityAnswer(args.answer),
        consequenceDigest: asString(args.consequenceDigest),
        questionRef: asString(args.questionRef),
      },
      operation: "ResolveIdentity",
      operationId: asString(args.operationId),
      worldRef: worldRef(args),
    }),
    description:
      "Confirm or abandon a proposed identity Question. Reuse operationId/digest on Unavailable retry. Stale requires a new inspect and explicit new confirmation.",
    inputSchema: {
      additionalProperties: false,
      properties: {
        answer: {
          enum: ["same-as", "different-from", "confirm", "unknown"],
          type: "string",
        },
        consequenceDigest: {
          description: "Exact digest returned with the Question",
          type: "string",
        },
        operationId,
        questionRef: { ...uuid },
        realm,
        worldId,
      },
      required: [
        "answer",
        "consequenceDigest",
        "operationId",
        "questionRef",
        "worldId",
      ],
      type: "object",
    },
    name: "ResolveIdentity",
  },
] as const;

export const toolByName = new Map(
  toolDefinitions.map((tool) => [tool.name, tool] as const)
);

export const listToolNames = (): readonly string[] =>
  toolDefinitions.map((tool) => tool.name);
