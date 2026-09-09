/**
 * MCP tool surface types — host binders assemble SemanticRequest; OMS owns the verb list (W4).
 */

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: {
    readonly type: "object";
    readonly properties: Record<string, unknown>;
    readonly required?: readonly string[];
    readonly additionalProperties: false;
  };
  readonly buildRequest: (args: Record<string, unknown>) => unknown;
}

/** Host binder for one OMS Worlds Action Type (schema + SemanticRequest builder). */
export type ToolHostBinder = Omit<ToolDefinition, "name">;
