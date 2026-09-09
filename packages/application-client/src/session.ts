import { Effect, FileSystem, Path, Redacted, Schema } from "effect";

import { readNoFollow, requirePrivateDirectory } from "./adapters/posix.js";
import { ApplicationClientError } from "./errors.js";

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

/** Private 0600 session.json shared by CLI (writer) and MCP (reader). */
export const readSession = Effect.fn(
  function* readSession(directory: string, baseUrl: string) {
    const target = yield* sessionPath(directory);
    const text = yield* readNoFollow(target, 16_384, true);
    const session = yield* Schema.decodeEffect(SessionJson)(text);
    if (session.baseUrl !== baseUrl || /[\r\n]/u.test(session.cookie)) {
      return yield* new ApplicationClientError("SESSION");
    }
    return Redacted.make(session.cookie);
  },
  Effect.mapError(() => new ApplicationClientError("SESSION"))
);

export const saveSession = Effect.fn(
  function* saveSession(
    directory: string,
    baseUrl: string,
    cookie: Redacted.Redacted
  ) {
    const target = yield* sessionPath(directory);
    const fs = yield* FileSystem.FileSystem;
    const json = yield* Schema.encodeEffect(SessionJson)({
      baseUrl,
      cookie: Redacted.value(cookie),
    });
    yield* Effect.scoped(
      Effect.gen(function* persistPrivateSession() {
        // Exclusive creation refuses both existing files and symlinks atomically.
        const file = yield* fs.open(target, { flag: "wx", mode: 0o600 });
        yield* file.writeAll(new TextEncoder().encode(json));
        yield* file.sync;
      })
    );
  },
  Effect.mapError(() => new ApplicationClientError("SESSION"))
);

export const removeSession = Effect.fn(
  function* removeSession(directory: string) {
    const target = yield* sessionPath(directory);
    const fs = yield* FileSystem.FileSystem;
    yield* fs.remove(target);
  },
  Effect.mapError(() => new ApplicationClientError("SESSION"))
);
