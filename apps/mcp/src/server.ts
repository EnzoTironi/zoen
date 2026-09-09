import { NodeServices } from "@effect/platform-node";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import { loadConfig } from "./config.js";
import { formatFailure } from "./output.js";
import { toolDefinitions } from "./tools/definitions.js";
import type { DispatchResult } from "./tools/dispatch.js";
import { makeHttpExecutor, runToolCall } from "./tools/dispatch.js";

export { listToolNames } from "./tools/definitions.js";

const runtimeLayer = Layer.mergeAll(NodeServices.layer, FetchHttpClient.layer);

export const createZoenMcpServer = () => {
  const server = new Server(
    { name: "zoen", version: "0.0.0" },
    {
      capabilities: { tools: {} },
      instructions:
        "Zoen Worlds MCP v0. Tools are SemanticRequest operations (CreatePersonalWorld, ImportEvidence, Inspect, …). Authenticate with the Zoen CLI first (zoen sign-in); this server reuses ~/.config/zoen/session.json. Set ZOEN_BASE_URL to the server origin (HTTPS or loopback HTTP).",
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, () =>
    Promise.resolve({
      tools: toolDefinitions.map((tool) => ({
        description: tool.description,
        inputSchema: tool.inputSchema,
        name: tool.name,
      })),
    })
  );

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { arguments: args = {}, name } = request.params;
    const program = Effect.gen(function* call() {
      const config = yield* loadConfig();
      const executor = makeHttpExecutor(config);
      return yield* runToolCall(name, args, executor);
    }).pipe(
      Effect.provideService(FetchHttpClient.RequestInit, { redirect: "error" }),
      Effect.timeout("35 seconds"),
      Effect.catch((error): Effect.Effect<DispatchResult> =>
        Effect.succeed(formatFailure(error))
      ),
      Effect.provide(runtimeLayer)
    );

    const outcome = await Effect.runPromise(program);
    return {
      content: [{ text: outcome.text, type: "text" as const }],
      isError: outcome.isError,
    };
  });

  return server;
};

export const startStdio = async (): Promise<void> => {
  const server = createZoenMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
};
