import { describe, expect, it } from "@effect/vitest";
import { Conflict } from "@zoen/contracts/worlds/errors";
import { WorldCreated } from "@zoen/contracts/worlds/operations";
import { Schema } from "effect";

import { McpFailure, formatFailure, formatSuccess } from "../src/output.ts";

describe("MCP output formatting", () => {
  it("preserves SemanticSuccess JSON and typed failures without internals", () => {
    const result = Schema.decodeSync(WorldCreated)({
      _tag: "WorldCreated",
      receiptRef: "11111111-1111-4111-8111-111111111111",
      worldRef: {
        realm: "live",
        worldId: "22222222-2222-4222-8222-222222222222",
      },
    });
    expect(JSON.parse(formatSuccess(result))).toStrictEqual(result);
    expect(formatFailure(new Conflict({ code: "CONFLICT" }))).toStrictEqual({
      isError: true,
      text: '{"_tag":"Conflict","code":"CONFLICT"}',
    });
    expect(formatFailure(new McpFailure("MCP_INPUT"))).toStrictEqual({
      isError: true,
      text: '{"_tag":"McpFailure","code":"MCP_INPUT"}',
    });
    expect(formatFailure(new Error("password=do-not-print"))).toStrictEqual({
      isError: true,
      text: '{"_tag":"McpFailure","code":"MCP_TRANSPORT"}',
    });
  });
});
