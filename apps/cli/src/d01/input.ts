/* eslint-disable effecttsgo/node-builtin-import, effecttsgo/async-function -- Node descriptor flags O_NOFOLLOW/O_EXCL and UID checks are the credential-file boundary; native promises are enclosed in Effect.tryPromise. */
/* eslint-disable no-bitwise -- POSIX file flags and permission masks are bit fields. */
import { constants } from "node:fs";
import { open } from "node:fs/promises";

import { Effect } from "effect";

import { CliFailure } from "./output.js";

export const readInput = (path: string, limit: number, secret = false) =>
  Effect.tryPromise({
    catch: () => new CliFailure("CLI_INPUT"),
    try: async () => {
      const chunks: Buffer[] = [];
      let size = 0;
      const file =
        path === "-"
          ? undefined
          : await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        if (file) {
          const stat = await file.stat();
          if (
            !stat.isFile() ||
            (secret && (stat.mode & 0o777) !== 0o600) ||
            (secret && stat.uid !== process.getuid?.())
          ) {
            throw new CliFailure("CLI_INPUT");
          }
        } else if (process.stdin.isTTY) {
          throw new CliFailure("CLI_INPUT");
        }
        const stream = file
          ? file.createReadStream({ autoClose: false })
          : process.stdin;
        for await (const chunk of stream) {
          const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          size += bytes.byteLength;
          if (size > limit) {
            throw new CliFailure("CLI_INPUT");
          }
          chunks.push(Buffer.from(bytes as Uint8Array));
        }
        return new TextDecoder("utf-8", {
          fatal: true,
          ignoreBOM: true,
        }).decode(Buffer.concat(chunks));
      } finally {
        await file?.close();
      }
    },
  });

export const validateBaseUrl = (value: string): string => {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ))
  ) {
    throw new CliFailure("CLI_INPUT");
  }
  return url.origin;
};
