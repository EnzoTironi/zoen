/**
 * W4 — CLI helper: Worlds pack Action Type names from OMS (same catalog as MCP codegen).
 * Command implementations stay in existing command modules; this avoids a third hand verb list for help/docs.
 */

import { listWorldsMcpToolNames } from "@zoen/oms/mcp-codegen";

/** Stable Worlds pack semantic operation names (OMS Action Types). */
export const worldsOmsActionNames = listWorldsMcpToolNames();
