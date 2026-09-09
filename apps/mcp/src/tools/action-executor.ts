import { executeSemanticViaActionRunner } from "@zoen/actions/host-execute";
import type { ActionLog } from "@zoen/actions/log";
import { createMemoryActionLog } from "@zoen/actions/log-memory";
import { sessionHostActor } from "@zoen/actions/session-actor";
import type { SemanticRequest } from "@zoen/contracts/worlds/operations";
import { SemanticSuccess } from "@zoen/contracts/worlds/operations";
import { Effect, Schema } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import type { McpConfig } from "../config.js";
import { McpFailure } from "../output.js";
import { readSession } from "../session.js";
import { execute as httpExecute } from "../transport.js";

/**
 * Primary Worlds pack path: ActionRunner (OMS + Action Log) → ApplicationApi HTTP.
 * Subject-identity remains direct SemanticRequest HTTP (escape hatch; W1 waived OMS).
 */
export const makeActionRunnerHttpExecutor =
  (config: McpConfig, log: ActionLog = createMemoryActionLog()) =>
  (request: SemanticRequest) =>
    Effect.gen(function* actionRunnerHttpExecutor() {
      const cookie = yield* readSession(config.sessionDir, config.baseUrl);
      const outcome = yield* Effect.tryPromise({
        catch: () => new McpFailure("MCP_TRANSPORT"),
        try: () =>
          executeSemanticViaActionRunner({
            actor: sessionHostActor(true),
            engine: {
              execute: (encoded) =>
                // oxlint-disable-next-line effecttsgo/run-effect-inside-effect -- ActionRunner engine port is Promise-based; nest ApplicationApi Effect via runPromise.
                Effect.runPromise(
                  httpExecute(config.baseUrl, cookie, encoded).pipe(
                    Effect.provideService(FetchHttpClient.RequestInit, {
                      redirect: "error",
                    }),
                    Effect.provide(FetchHttpClient.layer)
                  )
                ),
            },
            log,
            request,
          }),
      });
      return yield* Schema.decodeUnknownEffect(SemanticSuccess)(
        outcome.result
      ).pipe(Effect.mapError(() => new McpFailure("MCP_TRANSPORT")));
    });
