import { Data } from "effect";

export type ApplicationClientErrorCode = "SESSION" | "INPUT";

/** Shared Node-surface client failures (CLI/MCP map to their own codes). */
export class ApplicationClientError extends Data.TaggedError(
  "ApplicationClientError"
)<{
  readonly code: ApplicationClientErrorCode;
}> {
  constructor(code: ApplicationClientErrorCode) {
    super({ code });
  }
}
