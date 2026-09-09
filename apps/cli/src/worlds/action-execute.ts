import { executeSemanticViaActionRunner } from "@zoen/actions/host-execute";
import type { ActionLog } from "@zoen/actions/log";
import { createMemoryActionLog } from "@zoen/actions/log-memory";
import { sessionHostActor } from "@zoen/actions/session-actor";
import type { SemanticRequest } from "@zoen/contracts/worlds/operations";
import { SemanticSuccess } from "@zoen/contracts/worlds/operations";
import { Effect, Schema } from "effect";
import type { Redacted } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import { CliFailure } from "./output.js";
import { execute as httpExecute } from "./transport.js";

/**
 * Primary CLI Worlds path: ActionRunner (OMS + Action Log) → ApplicationApi.
 * Subject-identity / non-pack ops use direct SemanticRequest HTTP (documented escape hatch).
 * Pass a shared ActionLog in tests to assert log entries.
 */
export const executeViaActionRunner = Effect.fn(
  function* executeViaActionRunner(
    baseUrl: string,
    cookie: Redacted.Redacted,
    payload: SemanticRequest,
    log: ActionLog = createMemoryActionLog()
  ) {
    const outcome = yield* Effect.tryPromise({
      catch: () => new CliFailure("CLI_TRANSPORT"),
      try: () =>
        executeSemanticViaActionRunner({
          actor: sessionHostActor(true),
          engine: {
            execute: (encoded) =>
              // oxlint-disable-next-line effecttsgo/run-effect-inside-effect -- ActionRunner engine port is Promise-based; nest ApplicationApi Effect via runPromise.
              Effect.runPromise(
                httpExecute(baseUrl, cookie, encoded).pipe(
                  Effect.provideService(FetchHttpClient.RequestInit, {
                    redirect: "error",
                  }),
                  Effect.provide(FetchHttpClient.layer)
                )
              ),
          },
          log,
          request: payload,
        }),
    });
    return yield* Schema.decodeUnknownEffect(SemanticSuccess)(
      outcome.result
    ).pipe(Effect.mapError(() => new CliFailure("CLI_TRANSPORT")));
  }
);
