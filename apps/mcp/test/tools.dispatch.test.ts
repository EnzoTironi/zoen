import { describe, expect, it } from "@effect/vitest";
import { WorldCreated } from "@zoen/contracts/worlds/operations";
import type { SemanticRequest } from "@zoen/contracts/worlds/operations";
import { Effect, Schema } from "effect";

import { McpFailure } from "../src/output.ts";
import { dispatchTool, runToolCall } from "../src/tools/dispatch.ts";

const worldId = "33333333-3333-4333-8333-333333333333";
const operationId = "11111111-1111-4111-8111-111111111111";
const receiptRef = "44444444-4444-4444-8444-444444444444";

const worldCreated = Schema.decodeSync(WorldCreated)({
  _tag: "WorldCreated",
  receiptRef,
  worldRef: { realm: "live", worldId },
});

const succeedCreated = (_request: SemanticRequest) =>
  Effect.succeed(worldCreated);

describe("MCP tool dispatch", () => {
  it("decodes at the edge and forwards CreatePersonalWorld to the executor", () => {
    let seen: SemanticRequest | undefined;
    const run = (request: SemanticRequest) => {
      seen = request;
      return Effect.succeed(worldCreated);
    };
    const result = Effect.runSync(
      runToolCall("CreatePersonalWorld", { operationId }, run)
    );
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.text)).toStrictEqual(worldCreated);
    expect(seen).toMatchObject({
      operation: "CreatePersonalWorld",
      operationId,
    });
  });

  it("returns MCP_INPUT for unknown tools and decode failures", () => {
    expect(
      Effect.runSync(
        dispatchTool("NotATool", {}, succeedCreated).pipe(Effect.flip)
      )
    ).toStrictEqual(new McpFailure("MCP_INPUT"));
    // select-claim with empty/missing claimRef fails Uuid decode (structural),
    // not an MCP-edge choice↔claimRef policy guard.
    expect(
      Effect.runSync(
        dispatchTool(
          "ProposeCorrection",
          {
            choice: "select-claim",
            frameRef: "55555555-5555-4555-8555-555555555555",
            operationId,
            subjectKey: "obligation-1",
            validFrom: "2026-09-01",
            validTo: "2026-10-01",
            worldId,
          },
          succeedCreated
        ).pipe(Effect.flip)
      )
    ).toStrictEqual(new McpFailure("MCP_INPUT"));
  });

  it("smoke-dispatches Inspect through a mocked executor", () => {
    const run = (request: SemanticRequest) => {
      expect(request.operation).toBe("Inspect");
      return Effect.succeed(worldCreated);
    };
    const result = Effect.runSync(
      runToolCall("Inspect", { subjectKey: "obligation-1", worldId }, run)
    );
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.text)).toStrictEqual(worldCreated);
  });

  // confirmEntireWorld policy is owned by the shared erasure executor/server
  // (Literal(true) on RequestWorldErasure input), not by MCP dispatch.
  it("forwards RequestWorldErasure without MCP-edge confirm policy", () => {
    let seen: SemanticRequest | undefined;
    const run = (request: SemanticRequest) => {
      seen = request;
      return Effect.succeed(worldCreated);
    };
    const result = Effect.runSync(
      runToolCall(
        "RequestWorldErasure",
        {
          expectedRevision: null,
          operationId,
          worldId,
        },
        run
      )
    );
    expect(result.isError).toBeFalsy();
    expect(seen).toMatchObject({
      operation: "RequestWorldErasure",
      operationId,
    });
  });

  it("rejects realm/format/choice typos instead of coercing to live/json/unknown", () => {
    const expectInput = (name: string, args: Record<string, unknown>) => {
      expect(
        Effect.runSync(
          dispatchTool(name, args, succeedCreated).pipe(Effect.flip)
        )
      ).toStrictEqual(new McpFailure("MCP_INPUT"));
    };
    expectInput("Inspect", {
      realm: "livve",
      subjectKey: "obligation-1",
      worldId,
    });
    expectInput("ImportEvidence", {
      document: "{}",
      format: "xml",
      operationId,
      worldId,
    });
    expectInput("ProposeCorrection", {
      choice: "maybe",
      frameRef: "55555555-5555-4555-8555-555555555555",
      operationId,
      subjectKey: "obligation-1",
      validFrom: "2026-09-01",
      validTo: "2026-10-01",
      worldId,
    });
  });

  it("smoke-dispatches InspectSubjectIdentity through a mocked executor", () => {
    const run = (request: SemanticRequest) => {
      expect(request.operation).toBe("InspectSubjectIdentity");
      return Effect.succeed(worldCreated);
    };
    const result = Effect.runSync(
      runToolCall(
        "InspectSubjectIdentity",
        {
          anchors: ["A", "B"],
          validFrom: "2026-09-01",
          validTo: "2026-10-01",
          worldId,
        },
        run
      )
    );
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.text)).toStrictEqual(worldCreated);
  });

  it("rejects identity answer/frameKind typos instead of coercing", () => {
    expect(
      Effect.runSync(
        dispatchTool(
          "ResolveIdentity",
          {
            answer: "maybe",
            consequenceDigest: "a".repeat(64),
            operationId,
            questionRef: "55555555-5555-4555-8555-555555555555",
            worldId,
          },
          succeedCreated
        ).pipe(Effect.flip)
      )
    ).toStrictEqual(new McpFailure("MCP_INPUT"));
    expect(
      Effect.runSync(
        dispatchTool(
          "ProposeIdentityUndo",
          {
            frameKind: "other",
            frameRef: "55555555-5555-4555-8555-555555555555",
            operationId,
            targetDecisionRef: "66666666-6666-4666-8666-666666666666",
            worldId,
          },
          succeedCreated
        ).pipe(Effect.flip)
      )
    ).toStrictEqual(new McpFailure("MCP_INPUT"));
  });
});
