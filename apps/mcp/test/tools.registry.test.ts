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
});
