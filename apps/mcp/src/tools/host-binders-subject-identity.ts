/**
 * Subject-identity MCP tools — documented escape hatch (not OMS Action Types; W1 waived).
 * Still excluded from OMS codegen; hand binders only until SI Action Types exist.
 */

import {
  asFrameKind,
  asIdentityAnswer,
  asPartitionsByCell,
  asString,
  asStringArray,
  nullOrString,
  operationId,
  realm,
  subjectIdentityEnvelope,
  uuid,
  worldId,
  worldRef,
} from "./input-helpers.js";
import type { ToolDefinition } from "./tool-types.js";

export const subjectIdentityToolDefinitions: readonly ToolDefinition[] = [
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
];
