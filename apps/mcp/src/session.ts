import { Effect, FileSystem, Path, Redacted, Schema } from "effect";

import { readNoFollow, requirePrivateDirectory } from "./adapters/posix.js";
import { McpFailure } from "./output.js";

const StoredSession = Schema.Struct({
  baseUrl: Schema.String,
  cookie: Schema.NonEmptyString,
});
const SessionJson = Schema.fromJsonString(StoredSession);

const sessionPath = Effect.fn(function* sessionPath(directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(directory, { mode: 0o700, recursive: true });
  yield* requirePrivateDirectory(directory);
  return path.join(directory, "session.json");
});

/** Same private session.json format as @zoen/cli — sign in with CLI first. */
export const readSession = Effect.fn(
  function* readSession(directory: string, baseUrl: string) {
    const target = yield* sessionPath(directory);
    const text = yield* readNoFollow(target, 16_384, true);
    const session = yield* Schema.decodeEffect(SessionJson)(text);
    if (session.baseUrl !== baseUrl || /[\r\n]/u.test(session.cookie)) {
      return yield* new McpFailure("MCP_SESSION");
    }
    return Redacted.make(session.cookie);
  },
  Effect.mapError(() => new McpFailure("MCP_SESSION"))
);
