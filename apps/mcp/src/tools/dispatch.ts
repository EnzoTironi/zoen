import { decodeSemanticRequest } from "@zoen/contracts/worlds/operations";
import type {
  SemanticRequest,
  SemanticSuccess,
} from "@zoen/contracts/worlds/operations";
import { Effect, Result } from "effect";

import type { McpConfig } from "../config.js";
import { McpFailure, formatFailure, formatSuccess } from "../output.js";
import { readSession } from "../session.js";
import { execute as httpExecute } from "../transport.js";
import { toolByName } from "./definitions.js";

export type SemanticExecutor<E = McpFailure, R = never> = (
  request: SemanticRequest
) => Effect.Effect<SemanticSuccess, E, R>;

export interface DispatchResult {
  readonly isError: boolean;
  readonly text: string;
}

const asArgs = (value: unknown): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    out[key] = entry;
  }
  return out;
};

/** Parse at the MCP edge, then hand a typed SemanticRequest to the executor. */
export const dispatchTool = <E, R>(
  name: string,
  rawArgs: unknown,
  run: SemanticExecutor<E, R>
): Effect.Effect<SemanticSuccess, E | McpFailure, R> =>
  Effect.gen(function* dispatch() {
    const tool = toolByName.get(name);
    if (tool === undefined) {
      return yield* new McpFailure("MCP_INPUT");
    }
    // MCP-edge mirrors of CLI confirm-before-send flags (not a second policy
    // authority — Closing/authorization stay on the server).
    if (name === "RequestWorldErasure") {
      const args = asArgs(rawArgs);
      if (args.confirmEntireWorld !== true) {
        return yield* new McpFailure("MCP_INPUT");
      }
    }
    if (name === "ProposeCorrection") {
      const args = asArgs(rawArgs);
      const hasClaim =
        args.claimRef !== undefined &&
        args.claimRef !== null &&
        args.claimRef !== "";
      if ((args.choice === "select-claim") !== hasClaim) {
        return yield* new McpFailure("MCP_INPUT");
      }
    }
    const candidate = yield* Effect.try({
      catch: () => new McpFailure("MCP_INPUT"),
      try: () => tool.buildRequest(asArgs(rawArgs)),
    });
    const request = yield* decodeSemanticRequest(candidate).pipe(
      Effect.mapError(() => new McpFailure("MCP_INPUT"))
    );
    return yield* run(request);
  });

export const makeHttpExecutor =
  (config: McpConfig) => (request: SemanticRequest) =>
    Effect.gen(function* httpExecutor() {
      const cookie = yield* readSession(config.sessionDir, config.baseUrl);
      return yield* httpExecute(config.baseUrl, cookie, request);
    });

export const runToolCall = <E, R>(
  name: string,
  rawArgs: unknown,
  run: SemanticExecutor<E, R>
): Effect.Effect<DispatchResult, never, R> =>
  dispatchTool(name, rawArgs, run).pipe(
    Effect.result,
    Effect.map((result) => {
      if (Result.isFailure(result)) {
        return formatFailure(result.failure);
      }
      return { isError: false, text: formatSuccess(result.success) };
    })
  );
