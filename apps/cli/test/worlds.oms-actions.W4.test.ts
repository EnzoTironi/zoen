import { describe, expect, it } from "@effect/vitest";
import { worldsSemanticOperations } from "@zoen/oms/packs/worlds";

import { worldsOmsActionNames } from "../src/worlds/oms-actions.ts";

describe("CLI W4 OMS action name helper", () => {
  it("matches Worlds pack ActionType semantic operations", () => {
    expect(worldsOmsActionNames).toStrictEqual([...worldsSemanticOperations]);
  });
});
