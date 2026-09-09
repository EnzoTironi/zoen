import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";

import { NodeStream } from "@effect/platform-node";
import { Effect } from "effect";

import { collectText } from "../input-stream.js";
import { McpFailure } from "../output.js";

export const requirePrivateDirectory = Effect.fn(
  function* requirePrivateDirectory(target: string) {
    const stat = yield* Effect.tryPromise({
      catch: () => new McpFailure("MCP_SESSION"),
      try: () => lstat(target),
    });
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      (stat.mode & 0o777) !== 0o700 ||
      stat.uid !== process.getuid?.()
    ) {
      return yield* new McpFailure("MCP_SESSION");
    }
    return true;
  }
);

export const readNoFollow = Effect.fn(function* readNoFollow(
  target: string,
  limit: number,
  secret: boolean
) {
  return yield* Effect.scoped(
    Effect.gen(function* readDescriptor() {
      const file = yield* Effect.acquireRelease(
        Effect.tryPromise({
          catch: () => new McpFailure("MCP_INPUT"),
          try: () =>
            open(
              target,
              constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
            ),
        }),
        (handle) =>
          Effect.tryPromise({
            catch: () => new McpFailure("MCP_INPUT"),
            try: () => handle.close(),
          }).pipe(Effect.orDie)
      );
      const stat = yield* Effect.tryPromise({
        catch: () => new McpFailure("MCP_INPUT"),
        try: () => file.stat(),
      });
      if (
        !stat.isFile() ||
        (secret &&
          ((stat.mode & 0o777) !== 0o600 || stat.uid !== process.getuid?.()))
      ) {
        return yield* new McpFailure("MCP_INPUT");
      }
      return yield* collectText(
        NodeStream.fromReadable({
          evaluate: () => file.createReadStream({ autoClose: false }),
          onError: () => new McpFailure("MCP_INPUT"),
        }),
        limit
      );
    })
  );
});
