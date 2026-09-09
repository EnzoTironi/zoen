/**
 * W4 — assemble MCP Worlds tools from OMS Action Type registry + thin host binders.
 * Adding a Worlds Action Type requires a binder entry; the tool name is never a third hand copy.
 */

import { listWorldsMcpToolSpecs } from "@zoen/oms/mcp-codegen";
import { defaultOmsRegistry } from "@zoen/oms/packs/default-registry";
import type { LoadedRegistry } from "@zoen/oms/registry";

import { ExtraWorldsHostBinderError } from "./extra-worlds-host-binder-error.js";
import { worldsHostBinders } from "./host-binders-worlds.js";
import { MissingWorldsHostBinderError } from "./missing-worlds-host-binder-error.js";
import type { ToolDefinition, ToolHostBinder } from "./tool-types.js";

export { ExtraWorldsHostBinderError } from "./extra-worlds-host-binder-error.js";
export { MissingWorldsHostBinderError } from "./missing-worlds-host-binder-error.js";

/**
 * Generate Worlds pack MCP ToolDefinitions from OMS.
 * Descriptions/schemas come from host binders (rich MCP surface);
 * names are OMS semanticOperation literals.
 */
export const generateWorldsToolsFromOms = (
  binders: Record<string, ToolHostBinder> = worldsHostBinders,
  registry: LoadedRegistry = defaultOmsRegistry
): readonly ToolDefinition[] => {
  const specs = listWorldsMcpToolSpecs(registry);
  const used = new Set<string>();
  const tools: ToolDefinition[] = [];

  for (const spec of specs) {
    const binder = binders[spec.name];
    if (binder === undefined) {
      throw new MissingWorldsHostBinderError({ operation: spec.name });
    }
    used.add(spec.name);
    tools.push({
      buildRequest: binder.buildRequest,
      description: binder.description,
      inputSchema: binder.inputSchema,
      name: spec.name,
    });
  }

  for (const key of Object.keys(binders)) {
    if (!used.has(key)) {
      throw new ExtraWorldsHostBinderError({ operation: key });
    }
  }

  return tools;
};
