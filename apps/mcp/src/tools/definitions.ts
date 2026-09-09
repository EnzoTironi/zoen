/**
 * MCP tool registry — Worlds tools generated from OMS Action Types (W4);
 * subject-identity remains a documented hand-maintained escape hatch.
 */

import { generateWorldsToolsFromOms } from "./from-oms.js";
import { subjectIdentityToolDefinitions } from "./host-binders-subject-identity.js";
import type { ToolDefinition } from "./tool-types.js";

export type { ToolDefinition } from "./tool-types.js";

/** Worlds (OMS) + subject-identity (escape hatch) tool table for ListTools / dispatch. */
export const toolDefinitions: readonly ToolDefinition[] = [
  ...generateWorldsToolsFromOms(),
  ...subjectIdentityToolDefinitions,
];

export const toolByName = new Map(
  toolDefinitions.map((tool) => [tool.name, tool] as const)
);

export const listToolNames = (): readonly string[] =>
  toolDefinitions.map((tool) => tool.name);
