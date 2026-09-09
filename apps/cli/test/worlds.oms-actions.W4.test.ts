import { describe, expect, it } from "@effect/vitest";
import { worldsSemanticOperations } from "@zoen/oms/packs/worlds";

import {
  worldsOmsActionHelpSuffix,
  worldsOmsActionNames,
} from "../src/worlds/oms-actions.ts";

describe("CLI W4 OMS action name helper", () => {
  it("matches Worlds pack ActionType semantic operations", () => {
    expect(worldsOmsActionNames).toStrictEqual([...worldsSemanticOperations]);
  });

  it("builds the production root help suffix from the shared OMS catalog", () => {
    expect(worldsOmsActionHelpSuffix).toContain("CreatePersonalWorld");
    expect(worldsOmsActionHelpSuffix).toContain("ImportEvidence");
    for (const name of worldsOmsActionNames) {
      expect(worldsOmsActionHelpSuffix).toContain(name);
    }
  });
});
