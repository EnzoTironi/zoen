/* eslint-disable effecttsgo/node-builtin-import, effecttsgo/async-function -- Node descriptor flags O_NOFOLLOW/O_EXCL and UID checks are the credential-file boundary; native promises are enclosed in Effect.tryPromise. */
/* eslint-disable no-bitwise -- POSIX file flags and permission masks are bit fields. */
import { constants } from "node:fs";
import { lstat, mkdir, open, unlink } from "node:fs/promises";
import path from "node:path";

import { Effect, Redacted, Schema } from "effect";

import { CliFailure } from "./output.js";

const StoredSession = Schema.Struct({
  baseUrl: Schema.String,
  cookie: Schema.NonEmptyString,
});
const decodeSession = Schema.decodeUnknownSync(
  Schema.fromJsonString(StoredSession)
);

const encodeSession = Schema.encodeSync(Schema.fromJsonString(StoredSession));

const sessionPath = async (directory: string): Promise<string> => {
  await mkdir(directory, { mode: 0o700, recursive: true });
  const stat = await lstat(directory);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    (stat.mode & 0o777) !== 0o700 ||
    stat.uid !== process.getuid?.()
  ) {
    throw new CliFailure("CLI_SESSION");
  }
  return path.join(directory, "session.json");
};

export const readSession = (directory: string, baseUrl: string) =>
  Effect.tryPromise({
    catch: () => new CliFailure("CLI_SESSION"),
    try: async () => {
      const file = await open(
        await sessionPath(directory),
        constants.O_RDONLY | constants.O_NOFOLLOW
      );
      try {
        const stat = await file.stat();
        if (
          !stat.isFile() ||
          stat.size > 16_384 ||
          (stat.mode & 0o777) !== 0o600 ||
          stat.uid !== process.getuid?.()
        ) {
          throw new CliFailure("CLI_SESSION");
        }
        const session = decodeSession(await file.readFile("utf-8"));
        if (session.baseUrl !== baseUrl || /[\r\n]/u.test(session.cookie)) {
          throw new CliFailure("CLI_SESSION");
        }
        return Redacted.make(session.cookie);
      } finally {
        await file.close();
      }
    },
  });

export const saveSession = (
  directory: string,
  baseUrl: string,
  cookie: Redacted.Redacted
) =>
  Effect.tryPromise({
    catch: () => new CliFailure("CLI_SESSION"),
    try: async () => {
      const target = await sessionPath(directory);
      const file = await open(
        target,
        constants.O_WRONLY |
          constants.O_CREAT |
          constants.O_EXCL |
          constants.O_NOFOLLOW,
        0o600
      );
      try {
        await file.writeFile(
          encodeSession({
            baseUrl,
            cookie: Redacted.value(cookie),
          })
        );
        await file.sync();
      } finally {
        await file.close();
      }
    },
  });

export const removeSession = (directory: string) =>
  Effect.tryPromise({
    catch: () => new CliFailure("CLI_SESSION"),
    try: async () => {
      await unlink(await sessionPath(directory));
    },
  });
