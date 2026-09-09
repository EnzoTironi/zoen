import {
  readNoFollow as readSharedNoFollow,
  requirePrivateDirectory as requireSharedPrivateDirectory,
} from "@zoen/application-client/adapters/posix";
import { ApplicationClientError } from "@zoen/application-client/errors";
import { Effect } from "effect";

import { CliFailure } from "../output.js";

const mapInput = (error: unknown) =>
  error instanceof ApplicationClientError
    ? new CliFailure(error.code === "SESSION" ? "CLI_SESSION" : "CLI_INPUT")
    : new CliFailure("CLI_INPUT");

export const requirePrivateDirectory = Effect.fn(
  function* requirePrivateDirectory(target: string) {
    return yield* requireSharedPrivateDirectory(target).pipe(
      Effect.mapError(mapInput)
    );
  }
);

export const readNoFollow = Effect.fn(function* readNoFollow(
  target: string,
  limit: number,
  secret: boolean
) {
  return yield* readSharedNoFollow(target, limit, secret).pipe(
    Effect.mapError(mapInput)
  );
});
