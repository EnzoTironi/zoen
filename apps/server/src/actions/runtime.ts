import type { ActionActor } from "@zoen/actions/criteria";
import type { ActionLog } from "@zoen/actions/log";
import { createPgActionLog } from "@zoen/actions/log-pg";
import type { ActionEngine, ActionRunner } from "@zoen/actions/runner";
import { createActionRunner } from "@zoen/actions/runner";
import { defaultOmsRegistry } from "@zoen/oms/packs/default-registry";
import { Context, Effect, Layer } from "effect";
import { SqlClient } from "effect/unstable/sql";

export interface ActionRuntimeService {
  readonly createRunner: (
    actor: ActionActor,
    engine: ActionEngine
  ) => ActionRunner;
  readonly log: ActionLog;
}

/**
 * Server Action runtime (W3): OMS ActionRunner factory + durable PG Action Log
 * (migration 021). Dual path: HTTP Worlds groups still use SemanticExecutor
 * emission; MCP/CLI primary path is ActionRunner → ApplicationApi.
 */
export class ActionRuntime extends Context.Service<
  ActionRuntime,
  ActionRuntimeService
>()("zoen/server/actions/ActionRuntime") {}

const rowRecord = (row: object): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = value;
  }
  return out;
};

export const makeActionRuntimeLayer: Layer.Layer<
  ActionRuntime,
  never,
  SqlClient.SqlClient
> = Layer.effect(
  ActionRuntime,
  Effect.gen(function* buildActionRuntime() {
    const sql = yield* SqlClient.SqlClient;
    const log = createPgActionLog({
      execute: (statement, params) =>
        // oxlint-disable-next-line effecttsgo/run-effect-inside-effect -- ActionLogSqlDriver is Promise-based; bridge SqlClient Effect.
        Effect.runPromise(
          sql
            .unsafe(statement, [...params])
            .pipe(
              Effect.asVoid,
              Effect.orDie,
              Effect.provideService(SqlClient.SqlClient, sql)
            )
        ),
      query: (statement, params = []) =>
        // oxlint-disable-next-line effecttsgo/run-effect-inside-effect -- ActionLogSqlDriver is Promise-based; bridge SqlClient Effect.
        Effect.runPromise(
          sql.unsafe(statement, [...params]).pipe(
            Effect.map((rows) => rows.map(rowRecord)),
            Effect.orDie,
            Effect.provideService(SqlClient.SqlClient, sql)
          )
        ),
    });
    return ActionRuntime.of({
      createRunner: (actor, engine) =>
        createActionRunner({
          actor,
          engine,
          log,
          registry: defaultOmsRegistry,
        }),
      log,
    });
  })
);
