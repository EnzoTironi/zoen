import { Data } from "effect";

export class InvalidReferenceError extends Data.TaggedError(
  "InvalidReferenceError"
)<{
  readonly field: string;
  readonly kind: "object-property" | "action-parameter";
  readonly reason: "kind-mismatch" | "unknown-target";
  readonly typeId: string;
}> {}
