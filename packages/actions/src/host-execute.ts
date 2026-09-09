import type { SemanticRequest } from "@zoen/contracts/worlds/operations";
import { defaultOmsRegistry } from "@zoen/oms/packs/default-registry";
import type { LoadedRegistry } from "@zoen/oms/registry";

import type { ActionActor } from "./criteria.js";
import type { ActionLog, ActionLogEntry } from "./log.js";
import { tryMapWorldsAction } from "./map-request.js";
import type { ActionEngine, ActionRunner } from "./runner.js";
import { createActionRunner } from "./runner.js";
import { sessionHostActor } from "./session-actor.js";

export interface HostExecuteOptions {
  readonly actor?: ActionActor;
  readonly engine: ActionEngine;
  readonly log: ActionLog;
  readonly registry?: LoadedRegistry;
  readonly request: SemanticRequest;
}

export interface HostExecuteSuccess {
  readonly logEntry: ActionLogEntry | null;
  readonly request: SemanticRequest;
  readonly result: unknown;
  /** action-runner = Worlds pack primary path; direct-engine = subject-identity escape hatch. */
  readonly via: "action-runner" | "direct-engine";
}

/**
 * Primary Worlds pack path: OMS ActionRunner (lookup → criteria → encode → engine → log).
 * Subject-identity and other non-pack ops stay on the engine directly (W1 waived; documented).
 */
export const executeSemanticViaActionRunner = async (
  options: HostExecuteOptions
): Promise<HostExecuteSuccess> => {
  const {
    engine,
    log,
    registry = defaultOmsRegistry,
    request,
    actor = sessionHostActor(true),
  } = options;
  const mapped = tryMapWorldsAction(request);
  if (mapped === null) {
    const result = await engine.execute(request);
    return {
      logEntry: null,
      request,
      result,
      via: "direct-engine",
    };
  }
  const runner: ActionRunner = createActionRunner({
    actor,
    engine,
    log,
    registry,
  });
  const success = await runner.run(mapped);
  return {
    logEntry: success.logEntry,
    request: success.request,
    result: success.result,
    via: "action-runner",
  };
};
