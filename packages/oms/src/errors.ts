import { Data } from "effect";

export class UnknownTypeError extends Data.TaggedError("UnknownTypeError")<{
  readonly kind: "object" | "link" | "action";
  readonly typeId: string;
}> {}
