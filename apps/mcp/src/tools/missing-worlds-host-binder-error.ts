import { Data } from "effect";

/** OMS Worlds Action Type has no MCP host binder (W4 fail-closed). */
export class MissingWorldsHostBinderError extends Data.TaggedError(
  "MissingWorldsHostBinderError"
)<{
  readonly operation: string;
}> {}
