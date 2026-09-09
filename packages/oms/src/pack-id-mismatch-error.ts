import { Data } from "effect";

export class PackIdMismatchError extends Data.TaggedError(
  "PackIdMismatchError"
)<{
  readonly cardKind: "object" | "link" | "action";
  readonly declaredPackId: string;
  readonly packId: string;
  readonly typeId: string;
}> {}
