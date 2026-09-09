import { Data } from "effect";

/** ActionType declares unsupported runtime binding for this runner. */
export class UnsupportedRuntimeBindingError extends Data.TaggedError(
  "UnsupportedRuntimeBindingError"
)<{
  readonly actionTypeId: string;
  readonly runtimeBinding: string;
}> {}
