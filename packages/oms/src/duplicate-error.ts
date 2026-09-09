import { Data } from "effect";

export class DuplicateTypeError extends Data.TaggedError("DuplicateTypeError")<{
  readonly kind: "object" | "link" | "action" | "pack";
  readonly typeId: string;
}> {}
