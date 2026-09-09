import { describe, expect, it } from "@effect/vitest";
import type { SemanticRequest } from "@zoen/contracts/worlds/operations";
import { WorldCreated } from "@zoen/contracts/worlds/operations";
import { listWorldsMcpToolNames } from "@zoen/oms/mcp-codegen";
import { worldsSemanticOperations } from "@zoen/oms/packs/worlds";
import { Effect, Schema } from "effect";

import {
  listToolNames,
  toolByName,
  toolDefinitions,
} from "../src/tools/definitions.ts";
import { runToolCall } from "../src/tools/dispatch.ts";
import {
  ExtraWorldsHostBinderError,
  MissingWorldsHostBinderError,
  generateWorldsToolsFromOms,
} from "../src/tools/from-oms.ts";
import { worldsHostBinders } from "../src/tools/host-binders-worlds.ts";

const operationId = "11111111-1111-4111-8111-111111111111";
const worldId = "33333333-3333-4333-8333-333333333333";
const receiptRef = "44444444-4444-4444-8444-444444444444";

const worldCreated = Schema.decodeSync(WorldCreated)({
  _tag: "WorldCreated",
  receiptRef,
  worldRef: { realm: "live", worldId },
});

describe("MCP W4 OMS ActionType codegen", () => {
  it("generated Worlds tool names match OMS Worlds ActionTypes", () => {
    const omsNames = listWorldsMcpToolNames();
    expect(omsNames).toStrictEqual([...worldsSemanticOperations]);
    const worldsTools = generateWorldsToolsFromOms();
    expect(worldsTools.map((t) => t.name)).toStrictEqual(omsNames);
    for (const name of omsNames) {
      expect(toolByName.get(name)?.name).toBe(name);
    }
  });

  it("fail-closed when a Worlds Action Type lacks a host binder", () => {
    const incomplete = { ...worldsHostBinders };
    delete (incomplete as { CreatePersonalWorld?: unknown })
      .CreatePersonalWorld;
    expect(() => generateWorldsToolsFromOms(incomplete)).toThrow(
      MissingWorldsHostBinderError
    );
  });

  it("fail-closed when a host binder has no OMS Action Type", () => {
    expect(() =>
      generateWorldsToolsFromOms({
        ...worldsHostBinders,
        NotAnOmsAction: worldsHostBinders.CreatePersonalWorld,
      })
    ).toThrow(ExtraWorldsHostBinderError);
  });

  it("dispatch still works for CreatePersonalWorld via generated tool", () => {
    expect(
      toolDefinitions.some((t) => t.name === "CreatePersonalWorld")
    ).toBeTruthy();
    const run = (_request: SemanticRequest) => Effect.succeed(worldCreated);
    const result = Effect.runSync(
      runToolCall("CreatePersonalWorld", { operationId }, run)
    );
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.text)).toStrictEqual(worldCreated);
  });

  it("subject-identity tools remain escape-hatch entries after OMS Worlds tools", () => {
    const names = listToolNames();
    const worldsCount = worldsSemanticOperations.length;
    expect(names.slice(0, worldsCount)).toStrictEqual([
      ...worldsSemanticOperations,
    ]);
    expect(names.slice(worldsCount)).toContain("InspectSubjectIdentity");
    expect(names.slice(worldsCount)).toContain("ResolveIdentity");
  });
});
