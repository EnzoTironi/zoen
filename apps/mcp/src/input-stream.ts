import { Effect, Stream } from "effect";

import { McpFailure } from "./output.js";

export const collectText = Effect.fn(function* collectText<E, R>(
  stream: Stream.Stream<Uint8Array, E, R>,
  limit: number
) {
  let size = 0;
  const chunks = yield* stream.pipe(
    Stream.mapEffect((bytes) => {
      size += bytes.byteLength;
      return size > limit
        ? Effect.fail(new McpFailure("MCP_INPUT"))
        : Effect.succeed(bytes);
    }),
    Stream.runCollect
  );
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return yield* Effect.try({
    catch: () => new McpFailure("MCP_INPUT"),
    try: () =>
      new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes),
  });
});
