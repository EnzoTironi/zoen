import { D01Error } from "@zoen/contracts/worlds/errors";
import type { SemanticSuccess } from "@zoen/contracts/worlds/operations";
import { Data, Schema } from "effect";

export type CliFailureCode =
  | "CLI_INPUT"
  | "CLI_SESSION"
  | "CLI_AUTH"
  | "CLI_TRANSPORT";

export class CliFailure extends Data.TaggedError("CliFailure")<{
  readonly code: CliFailureCode;
}> {
  constructor(code: CliFailureCode) {
    super({ code });
  }
}

export const formatFailure = (
  error: unknown
): {
  json: string;
  exitCode: number;
} => {
  if (Schema.is(D01Error)(error)) {
    return {
      exitCode: 1,
      json: JSON.stringify({ _tag: error._tag, code: error.code }),
    };
  }
  const code = error instanceof CliFailure ? error.code : "CLI_TRANSPORT";
  return {
    exitCode: code === "CLI_INPUT" ? 2 : 1,
    json: JSON.stringify({ _tag: "CliFailure", code }),
  };
};

export const formatSuccess = (result: SemanticSuccess): string =>
  JSON.stringify(result);
