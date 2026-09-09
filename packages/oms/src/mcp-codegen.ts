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

const toSpec = (actionType: ActionType): WorldsMcpToolSpec => ({
  actionType,
  actionTypeId: actionType.id,
  description: actionType.description,
  name: actionType.semanticOperation,
});

/**
 * Worlds pack Action Types: inventory order first, then any additional registered
 * Worlds operations (localeCompare). Fail closed on inventory gaps and on
 * duplicate semanticOperation values across distinct Action Type ids.
 */
export const listWorldsMcpToolSpecs = (
  loaded: LoadedRegistry = defaultOmsRegistry
): readonly WorldsMcpToolSpec[] => {
  const byOperation = new Map<string, ActionType>();
  for (const action of loaded.actionTypes.values()) {
    if (action.packId !== "worlds") {
      continue;
    }
    const existing = byOperation.get(action.semanticOperation);
    if (existing !== undefined) {
      throw new Error(
        `OMS Worlds pack duplicate semantic operation ${action.semanticOperation}: ${existing.id} and ${action.id}`
      );
    }
    byOperation.set(action.semanticOperation, action);
  }

  const specs: WorldsMcpToolSpec[] = [];
  const used = new Set<string>();
  for (const operation of worldsSemanticOperations) {
    const actionType = byOperation.get(operation);
    if (actionType === undefined) {
      throw new Error(
        `OMS Worlds pack missing Action Type for semantic operation ${operation}`
      );
    }
    used.add(operation);
    specs.push(toSpec(actionType));
  }

  const remaining = [...byOperation.keys()]
    .filter((operation) => !used.has(operation))
    .toSorted((left, right) => left.localeCompare(right));
  for (const operation of remaining) {
    const actionType = byOperation.get(operation);
    if (actionType === undefined) {
      continue;
    }
    specs.push(toSpec(actionType));
  }
  return specs;
};

/** Stable MCP / CLI help names for Worlds pack Action Types. */
export const listWorldsMcpToolNames = (
  loaded: LoadedRegistry = defaultOmsRegistry
): readonly string[] => listWorldsMcpToolSpecs(loaded).map((spec) => spec.name);
