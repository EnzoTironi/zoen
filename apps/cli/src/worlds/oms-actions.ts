/**
 * W4 — CLI helper: Worlds pack Action Type names from OMS (same catalog as MCP codegen).
 * Command implementations stay in existing command modules; root help surfaces this list.
 */

import { listWorldsMcpToolNames } from "@zoen/oms/mcp-codegen";

/** Stable Worlds pack semantic operation names (OMS Action Types). */
export const worldsOmsActionNames = listWorldsMcpToolNames();

/** Surfaced on `rootCommand` help so the shared OMS catalog reaches operators. */
export const worldsOmsActionHelpSuffix = `Worlds OMS Action Types (shared catalog): ${worldsOmsActionNames.join(", ")}.`;
