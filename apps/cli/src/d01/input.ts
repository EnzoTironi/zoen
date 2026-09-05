import { NodeStream } from "@effect/platform-node";
import { Effect } from "effect";

import { readNoFollow } from "./adapters/posix.js";
import { collectText } from "./input-stream.js";
import { CliFailure } from "./output.js";

export const readInput = (target: string, limit: number, secret = false) => {
  if (target !== "-") {
    return readNoFollow(target, limit, secret);
  }
  if (process.stdin.isTTY) {
    return Effect.fail(new CliFailure("CLI_INPUT"));
  }
  return collectText(
    NodeStream.fromReadable({
      evaluate: () => process.stdin,
      onError: () => new CliFailure("CLI_INPUT"),
    }),
    limit
  );
};

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
