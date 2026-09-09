import { describe, expect, it } from "@effect/vitest";
import { decodeSemanticRequest } from "@zoen/contracts/worlds/operations";
import { Effect, Result } from "effect";

import {
  listToolNames,
  toolByName,
  toolDefinitions,
} from "../src/tools/definitions.ts";

describe("MCP tool registry", () => {
  it("exposes Worlds contract verbs without invented product names", () => {
    expect(listToolNames()).toStrictEqual([
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
      "InspectWorldErasure",
      "RequestWorldErasure",
      "PurgeWorldContent",
      "InspectSubjectIdentity",
      "InspectIdentityRecovery",
      "ProposeIdentityResolution",
      "ProposeIdentitySplit",
      "ProposeIdentityUndo",
      "ResolveIdentity",
    ]);
    for (const tool of toolDefinitions) {
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema.additionalProperties).toBeFalsy();
      expect(toolByName.get(tool.name)?.name).toBe(tool.name);
    }
  });

  it("builds CreatePersonalWorld and ImportEvidence that decode as SemanticRequest", () => {
    const createTool = toolByName.get("CreatePersonalWorld");
    const importTool = toolByName.get("ImportEvidence");
    expect(createTool).toBeDefined();
    expect(importTool).toBeDefined();
    if (createTool === undefined || importTool === undefined) {
      return;
    }
    const create = createTool.buildRequest({
      operationId: "11111111-1111-4111-8111-111111111111",
    });
    const imported = importTool.buildRequest({
      document: '{"obligation":"rent"}',
      format: "json",
      operationId: "22222222-2222-4222-8222-222222222222",
      realm: "live",
      worldId: "33333333-3333-4333-8333-333333333333",
    });
    expect(Effect.runSync(decodeSemanticRequest(create))).toMatchObject({
      operation: "CreatePersonalWorld",
    });
    expect(Effect.runSync(decodeSemanticRequest(imported))).toMatchObject({
      operation: "ImportEvidence",
      worldRef: {
        realm: "live",
        worldId: "33333333-3333-4333-8333-333333333333",
      },
    });
  });

  it("rejects unknown tool shapes at the contract edge", () => {
    const bogus = {
      input: {},
      operation: "NotAVerb",
      purpose: "personal-records",
      schemaVersion: "worlds.v1",
    };
    expect(
      Result.isFailure(
        Effect.runSync(decodeSemanticRequest(bogus).pipe(Effect.result))
      )
    ).toBeTruthy();
  });

  it("builds InspectSubjectIdentity and ResolveIdentity that decode as SemanticRequest", () => {
    const inspectTool = toolByName.get("InspectSubjectIdentity");
    const resolveTool = toolByName.get("ResolveIdentity");
    expect(inspectTool).toBeDefined();
    expect(resolveTool).toBeDefined();
    if (inspectTool === undefined || resolveTool === undefined) {
      return;
    }
    const inspected = inspectTool.buildRequest({
      anchors: ["A", "B"],
      validFrom: "2026-09-01",
      validTo: "2026-10-01",
      worldId: "33333333-3333-4333-8333-333333333333",
    });
    const resolved = resolveTool.buildRequest({
      answer: "same-as",
      consequenceDigest: "a".repeat(64),
      operationId: "11111111-1111-4111-8111-111111111111",
      questionRef: "55555555-5555-4555-8555-555555555555",
      worldId: "33333333-3333-4333-8333-333333333333",
    });
    expect(Effect.runSync(decodeSemanticRequest(inspected))).toMatchObject({
      operation: "InspectSubjectIdentity",
      schemaVersion: "subject-identity.v1",
    });
    expect(Effect.runSync(decodeSemanticRequest(resolved))).toMatchObject({
      operation: "ResolveIdentity",
      schemaVersion: "subject-identity.v1",
    });
  });

  it("builds InspectIdentityRecovery / ProposeIdentityResolution / Split / Undo that decode as SemanticRequest", () => {
    const recoveryTool = toolByName.get("InspectIdentityRecovery");
    const resolutionTool = toolByName.get("ProposeIdentityResolution");
    const splitTool = toolByName.get("ProposeIdentitySplit");
    const undoTool = toolByName.get("ProposeIdentityUndo");
    expect(recoveryTool).toBeDefined();
    expect(resolutionTool).toBeDefined();
    expect(splitTool).toBeDefined();
    expect(undoTool).toBeDefined();
    if (
      recoveryTool === undefined ||
      resolutionTool === undefined ||
      splitTool === undefined ||
      undoTool === undefined
    ) {
      return;
    }

    const worldId = "33333333-3333-4333-8333-333333333333";
    const operationId = "11111111-1111-4111-8111-111111111111";
    const frameRef = "55555555-5555-4555-8555-555555555555";
    const decisionRef = "66666666-6666-4666-8666-666666666666";
    const cellRef = "a".repeat(64);

    const recovery = recoveryTool.buildRequest({
      anchor: "A",
      targetDecisionRef: decisionRef,
      validFrom: "2026-09-01",
      validTo: "2026-10-01",
      worldId,
    });
    expect(Effect.runSync(decodeSemanticRequest(recovery))).toMatchObject({
      input: {
        anchor: "A",
        atFrame: null,
        interval: {
          _tag: "DateInterval",
          from: "2026-09-01",
          to: "2026-10-01",
        },
        targetDecisionRef: decisionRef,
      },
      operation: "InspectIdentityRecovery",
      purpose: "personal-records",
      schemaVersion: "subject-identity.v1",
      worldRef: { realm: "live", worldId },
    });

    const resolution = resolutionTool.buildRequest({
      frameRef,
      left: "A",
      operationId,
      right: "B",
      worldId,
    });
    expect(Effect.runSync(decodeSemanticRequest(resolution))).toMatchObject({
      input: {
        frame: { frameRef, kind: "subject-identity" },
        left: "A",
        right: "B",
      },
      operation: "ProposeIdentityResolution",
      operationId,
      purpose: "personal-records",
      schemaVersion: "subject-identity.v1",
      worldRef: { realm: "live", worldId },
    });

    const split = splitTool.buildRequest({
      anchor: "A",
      frameRef,
      operationId,
      partitionsByCell: [{ blocks: [["A"], ["B"]], cellRef }],
      worldId,
    });
    expect(Effect.runSync(decodeSemanticRequest(split))).toMatchObject({
      input: {
        anchor: "A",
        frame: { frameRef, kind: "subject-identity" },
        partitionsByCell: [{ blocks: [["A"], ["B"]], cellRef }],
      },
      operation: "ProposeIdentitySplit",
      operationId,
      purpose: "personal-records",
      schemaVersion: "subject-identity.v1",
      worldRef: { realm: "live", worldId },
    });

    const undo = undoTool.buildRequest({
      frameKind: "subject-identity-recovery",
      frameRef,
      operationId,
      targetDecisionRef: decisionRef,
      worldId,
    });
    expect(Effect.runSync(decodeSemanticRequest(undo))).toMatchObject({
      input: {
        frame: { frameRef, kind: "subject-identity-recovery" },
        targetDecisionRef: decisionRef,
      },
      operation: "ProposeIdentityUndo",
      operationId,
      purpose: "personal-records",
      schemaVersion: "subject-identity.v1",
      worldRef: { realm: "live", worldId },
    });

    // Omitted frameKind must default to subject-identity (schema default).
    const undoDefaultKind = undoTool.buildRequest({
      frameRef,
      operationId,
      targetDecisionRef: decisionRef,
      worldId,
    });
    expect(
      Effect.runSync(decodeSemanticRequest(undoDefaultKind))
    ).toMatchObject({
      input: { frame: { frameRef, kind: "subject-identity" } },
      operation: "ProposeIdentityUndo",
    });
  });
});
