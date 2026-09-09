/**
 * Thin Worlds host binders — inputSchema + buildRequest only.
 * Tool names come from @zoen/oms MCP codegen (W4); do not re-list verbs here as a catalog.
 */

import {
  asCorrectionChoice,
  asEvidenceFormat,
  asString,
  erasureEnvelope,
  nullOrString,
  operationId,
  realm,
  sharingEnvelope,
  uuid,
  worldId,
  worldRef,
  worldsEnvelope,
} from "./input-helpers.js";
import type { ToolHostBinder } from "./tool-types.js";

export const worldsHostBinders = {
  CreatePersonalWorld: {
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
  },
  ImportEvidence: {
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
  },
  Inspect: {
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
  },
  OpenEvidence: {
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
  },
  ProposeCorrection: {
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
  },
  AnswerQuestion: {
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
  },
  UndoCorrection: {
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
  },
  InspectWorldAccess: {
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
  },
  GrantWorldReadAccess: {
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
  },
  RevokeWorldReadAccess: {
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
  },
  RequestWorldErasure: {
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
  },
  InspectWorldErasure: {
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
  },
  PurgeWorldContent: {
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
  },
} as const satisfies Record<string, ToolHostBinder>;

export type WorldsHostBinderName = keyof typeof worldsHostBinders;
