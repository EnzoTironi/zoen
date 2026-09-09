import { Data } from "effect";

/** Unknown Action Type id — fail closed (OMS UnknownTypeError mapped). */
export class UnknownActionTypeError extends Data.TaggedError(
  "UnknownActionTypeError"
)<{
  readonly actionTypeId: string;
}> {}
