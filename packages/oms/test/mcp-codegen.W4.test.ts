import { describe, expect, it } from "@effect/vitest";

import {
  listWorldsMcpToolNames,
  listWorldsMcpToolSpecs,
} from "../src/mcp-codegen.ts";
import { defaultOmsRegistry } from "../src/packs/default-registry.ts";
import { worldsSemanticOperations } from "../src/packs/worlds.ts";

describe("OMS W4 MCP codegen catalog", () => {
  it("lists Worlds ActionType semantic operations in inventory order", () => {
    expect(listWorldsMcpToolNames()).toStrictEqual([
      ...worldsSemanticOperations,
    ]);
    expect(listWorldsMcpToolNames(defaultOmsRegistry)).toContain(
      "CreatePersonalWorld"
    );
  });

  it("pairs each tool name with its Action Type id", () => {
    const specs = listWorldsMcpToolSpecs();
    expect(specs).toHaveLength(worldsSemanticOperations.length);
    for (const spec of specs) {
      expect(spec.actionTypeId).toBe(`worlds.${spec.name}`);
      expect(spec.actionType.semanticOperation).toBe(spec.name);
      expect(spec.actionType.packId).toBe("worlds");
      expect(spec.description.length).toBeGreaterThan(0);
    }
  });
});
