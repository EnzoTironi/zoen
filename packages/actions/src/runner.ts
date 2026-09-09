import type { SemanticRequest } from "@zoen/contracts/worlds/operations";
import type { LoadedRegistry } from "@zoen/oms/registry";
import { UnknownTypeError, lookupActionType } from "@zoen/oms/registry";
import { DateTime } from "effect";

import { evaluateSubmissionCriteria } from "./criteria.js";
import type { ActionActor } from "./criteria.js";
import {
  encodeSemanticRequest,
  extractOperationId,
  extractReceiptRef,
  extractWorldScope,
} from "./encode.js";
import type { ActionLog, ActionLogAppendInput, ActionLogEntry } from "./log.js";
import { validateActionParameters } from "./parameters.js";
import { UnknownActionTypeError } from "./unknown-action-type-error.js";
import { UnsupportedRuntimeBindingError } from "./unsupported-runtime-binding-error.js";

/** Engine behind the Action card — tip SemanticExecutor / ApplicationApi adapter. */
export interface ActionEngine {
  readonly execute: (request: SemanticRequest) => Promise<unknown>;
}

export interface ActionRunnerOptions {
  readonly actor: ActionActor;
  readonly engine: ActionEngine;
  readonly log: ActionLog;
  readonly registry: LoadedRegistry;
}

export interface RunActionInput {
  readonly actionTypeId: string;
  readonly parameters: Readonly<Record<string, unknown>>;
}

export interface ActionRunSuccess {
  readonly actionTypeId: string;
  readonly logEntry: ActionLogEntry;
  readonly request: SemanticRequest;
  readonly result: unknown;
}

const nowIso = (): string => DateTime.formatIso(DateTime.nowUnsafe());

const supportedBindings = new Set(["action-runtime", "semantic-executor"]);

const rejectionCodeOf = (error: unknown): string => {
  if (
    typeof error === "object" &&
    error !== null &&
    "_tag" in error &&
    typeof error._tag === "string"
  ) {
    return error._tag;
  }
  if (error instanceof Error) {
    return error.name;
  }
  return "UnknownError";
};

/**
 * Action runtime (W2): OMS lookup → param validation → submission criteria →
 * SemanticExecutor/ApplicationApi engine → Action Log (append-only).
 * Dual path OK: does not replace tip SemanticExecutor public API.
 */
export const createActionRunner = (options: ActionRunnerOptions) => {
  const { actor, engine, log, registry } = options;

  const run = async (input: RunActionInput): Promise<ActionRunSuccess> => {
    const attemptedAt = nowIso();
    const { actionTypeId: requestedActionTypeId, parameters } = input;
    let actionTypeId = requestedActionTypeId;
    let semanticOperation = "unknown";
    let operationId = extractOperationId(parameters);
    const world = extractWorldScope(parameters);
    let outcomeLogged = false;

    const baseLog = (): Omit<
      ActionLogAppendInput,
      "completedAt" | "outcome" | "receiptRef" | "rejectionCode" | "result"
    > => ({
      actionTypeId,
      actorPrincipalId: actor.principalId,
      attemptedAt,
      operationId,
      realm: world.realm,
      semanticOperation,
      worldId: world.worldId,
    });

    try {
      let actionType;
      try {
        actionType = lookupActionType(registry, requestedActionTypeId);
      } catch (error) {
        if (error instanceof UnknownTypeError) {
          throw new UnknownActionTypeError({
            actionTypeId: requestedActionTypeId,
          });
        }
        throw error;
      }
      const { id, runtimeBinding, semanticOperation: operation } = actionType;
      actionTypeId = id;
      semanticOperation = operation;
      operationId = extractOperationId(parameters);

      if (!supportedBindings.has(runtimeBinding)) {
        throw new UnsupportedRuntimeBindingError({
          actionTypeId: id,
          runtimeBinding,
        });
      }

      validateActionParameters(actionType, parameters);
      evaluateSubmissionCriteria(actionType, actor);

      const request = encodeSemanticRequest(actionType, parameters);

      // Durable attempt before engine work (crash / timeout still leaves a row).
      await log.append({
        ...baseLog(),
        completedAt: attemptedAt,
        outcome: "accepted",
        receiptRef: null,
        rejectionCode: null,
        result: null,
      });
      outcomeLogged = true;

      let result: unknown;
      try {
        result = await engine.execute(request);
      } catch (engineError) {
        const completedAt = nowIso();
        await log.append({
          ...baseLog(),
          completedAt,
          outcome: "failed",
          receiptRef: null,
          rejectionCode: rejectionCodeOf(engineError),
          result: null,
        });
        throw engineError;
      }

      // Committed append is outside the preflight rejection catch so a log
      // failure after a successful engine mutation is not rewritten as rejected.
      const completedAt = nowIso();
      const logEntry = await log.append({
        ...baseLog(),
        completedAt,
        outcome: "committed",
        receiptRef: extractReceiptRef(result),
        rejectionCode: null,
        result,
      });

      return {
        actionTypeId: id,
        logEntry,
        request,
        result,
      };
    } catch (error) {
      if (!outcomeLogged) {
        const completedAt = nowIso();
        await log.append({
          ...baseLog(),
          completedAt,
          outcome: "rejected",
          receiptRef: null,
          rejectionCode: rejectionCodeOf(error),
          result: null,
        });
      }
      throw error;
    }
  };

  return { run };
};

export type ActionRunner = ReturnType<typeof createActionRunner>;
