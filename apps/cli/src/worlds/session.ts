import {
  readSession as readSharedSession,
  removeSession as removeSharedSession,
  saveSession as saveSharedSession,
} from "@zoen/application-client/session";
import { Effect } from "effect";
import type { Redacted } from "effect";

import { CliFailure } from "./output.js";

export const readSession = Effect.fn(function* readSession(
  directory: string,
  baseUrl: string
) {
  return yield* readSharedSession(directory, baseUrl).pipe(
    Effect.mapError(() => new CliFailure("CLI_SESSION"))
  );
});

export const saveSession = Effect.fn(function* saveSession(
  directory: string,
  baseUrl: string,
  cookie: Redacted.Redacted
) {
  return yield* saveSharedSession(directory, baseUrl, cookie).pipe(
    Effect.mapError(() => new CliFailure("CLI_SESSION"))
  );
});

export const removeSession = Effect.fn(function* removeSession(
  directory: string
) {
  return yield* removeSharedSession(directory).pipe(
    Effect.mapError(() => new CliFailure("CLI_SESSION"))
  );
});
