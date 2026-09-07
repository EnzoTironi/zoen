import { Option, Schema } from "effect";

export const field = (data: FormData, name: string) =>
  Option.getOrElse(
    Schema.decodeUnknownOption(Schema.String)(data.get(name)),
    () => ""
  );
