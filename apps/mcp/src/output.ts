import { SemanticError } from "@zoen/contracts/worlds/errors";
import type { SemanticSuccess } from "@zoen/contracts/worlds/operations";
import { Data, Schema } from "effect";

export type McpFailureCode =
  | "MCP_INPUT"
  | "MCP_SESSION"
  | "MCP_AUTH"
  | "MCP_TRANSPORT"
  | "MCP_CONFIG";

export class McpFailure extends Data.TaggedError("McpFailure")<{
  readonly code: McpFailureCode;
}> {
  constructor(code: McpFailureCode) {
    super({ code });
  }
}

export const formatFailure = (
  error: unknown
): {
  readonly isError: true;
  readonly text: string;
} => {
  if (Schema.is(SemanticError)(error)) {
    return {
      isError: true,
      text: JSON.stringify({ _tag: error._tag, code: error.code }),
    };
  }
  const code = error instanceof McpFailure ? error.code : "MCP_TRANSPORT";
  return {
    isError: true,
    text: JSON.stringify({ _tag: "McpFailure", code }),
  };
};

export const formatSuccess = (result: SemanticSuccess): string =>
  JSON.stringify(result);
