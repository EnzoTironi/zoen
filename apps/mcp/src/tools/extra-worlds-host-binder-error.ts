import { Data } from "effect";

/** MCP host binder has no matching OMS Worlds Action Type (W4 fail-closed). */
export class ExtraWorldsHostBinderError extends Data.TaggedError(
  "ExtraWorldsHostBinderError"
)<{
  readonly operation: string;
}> {}
