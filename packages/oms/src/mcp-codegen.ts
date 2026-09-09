/**
 * W4 — MCP tool catalog from OMS Action Types (Language plane → surface).
 * Hosts supply inputSchema/buildRequest binders; this module owns which Worlds
 * verbs appear as tools (no hand-duplicated verb list in apps/mcp).
 */

import { defaultOmsRegistry } from "./packs/default-registry.js";
import { worldsSemanticOperations } from "./packs/worlds.js";
import type { LoadedRegistry } from "./registry.js";
import type { ActionType } from "./schemas.js";

export interface WorldsMcpToolSpec {
  readonly actionTypeId: string;
  /** Tip SemanticRequest.operation / MCP tool name. */
  readonly name: string;
  readonly description: string;
  readonly actionType: ActionType;
}

/**
 * Worlds pack Action Types in stable semantic-operation inventory order.
 * Fail closed if an inventory op lacks an Action Type (OMS incompleteness).
 */
export const listWorldsMcpToolSpecs = (
  loaded: LoadedRegistry = defaultOmsRegistry
): readonly WorldsMcpToolSpec[] => {
  const byOperation = new Map<string, ActionType>();
  for (const action of loaded.actionTypes.values()) {
    if (action.packId !== "worlds") {
      continue;
    }
    byOperation.set(action.semanticOperation, action);
  }

  const specs: WorldsMcpToolSpec[] = [];
  for (const operation of worldsSemanticOperations) {
    const actionType = byOperation.get(operation);
    if (actionType === undefined) {
      throw new Error(
        `OMS Worlds pack missing Action Type for semantic operation ${operation}`
      );
    }
    specs.push({
      actionType,
      actionTypeId: actionType.id,
      description: actionType.description,
      name: actionType.semanticOperation,
    });
  }
  return specs;
};

/** Stable MCP / CLI help names for Worlds pack Action Types. */
export const listWorldsMcpToolNames = (
  loaded: LoadedRegistry = defaultOmsRegistry
): readonly string[] => listWorldsMcpToolSpecs(loaded).map((spec) => spec.name);
