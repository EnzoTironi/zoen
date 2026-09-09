import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import {
  listWorldsMcpToolNames,
  listWorldsMcpToolSpecs,
} from "../src/mcp-codegen.ts";
import { defaultOmsRegistry } from "../src/packs/default-registry.ts";
import { worldsSemanticOperations } from "../src/packs/worlds.ts";
import type { LoadedRegistry } from "../src/registry.ts";
import type { ActionType } from "../src/schemas.ts";
import { TypeId } from "../src/values.ts";

const decodeTypeId = Schema.decodeUnknownSync(TypeId);

const cloneWithActionTypes = (
  actionTypes: ReadonlyMap<string, ActionType>
): LoadedRegistry => ({
  actionTypes,
  linkTypes: defaultOmsRegistry.linkTypes,
  objectTypes: defaultOmsRegistry.objectTypes,
  packs: defaultOmsRegistry.packs,
  registry: defaultOmsRegistry.registry,
});

const sampleWorldsAction = (): ActionType => {
  const found = defaultOmsRegistry.actionTypes.get(
    "worlds.CreatePersonalWorld"
  );
  if (found === undefined) {
    throw new Error("expected worlds.CreatePersonalWorld in default registry");
  }
  return found;
};

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

  it("fail-closed when inventory operation lacks an Action Type", () => {
    const incomplete = new Map(defaultOmsRegistry.actionTypes);
    incomplete.delete("worlds.Inspect");
    expect(() =>
      listWorldsMcpToolSpecs(cloneWithActionTypes(incomplete))
    ).toThrow(/missing Action Type for semantic operation Inspect/u);
  });

  it("includes registered Worlds Action Types beyond the inventory", () => {
    const base = sampleWorldsAction();
    const extra: ActionType = {
      ...base,
      description: "Extra Worlds Action Type for codegen coverage.",
      id: decodeTypeId("worlds.ExtraWorldsVerb"),
      semanticOperation: "ExtraWorldsVerb",
    };
    const loaded = cloneWithActionTypes(
      new Map([...defaultOmsRegistry.actionTypes, [extra.id, extra]])
    );
    const names = listWorldsMcpToolNames(loaded);
    expect(names).toStrictEqual([
      ...worldsSemanticOperations,
      "ExtraWorldsVerb",
    ]);
    expect(
      listWorldsMcpToolSpecs(loaded).find((s) => s.name === "ExtraWorldsVerb")
        ?.actionTypeId
    ).toBe("worlds.ExtraWorldsVerb");
  });

  it("fail-closed on duplicate Worlds semanticOperation values", () => {
    const base = sampleWorldsAction();
    const duplicate: ActionType = {
      ...base,
      id: decodeTypeId("worlds.CreatePersonalWorldAlt"),
    };
    const loaded = cloneWithActionTypes(
      new Map([...defaultOmsRegistry.actionTypes, [duplicate.id, duplicate]])
    );
    expect(() => listWorldsMcpToolSpecs(loaded)).toThrow(
      /duplicate semantic operation CreatePersonalWorld/u
    );
  });
});
