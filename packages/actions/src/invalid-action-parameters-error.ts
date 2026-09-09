import { Data } from "effect";

/** Parameter failed ActionType schema validation. */
export class InvalidActionParametersError extends Data.TaggedError(
  "InvalidActionParametersError"
)<{
  readonly actionTypeId: string;
  readonly field: string;
  readonly reason:
    | "missing"
    | "unexpected"
    | "null-not-allowed"
    | "kind-mismatch"
    | "empty";
}> {}
