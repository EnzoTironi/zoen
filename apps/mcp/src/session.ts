import { readSession as readSharedSession } from "@zoen/application-client/session";
import { Effect } from "effect";

import { McpFailure } from "./output.js";

/** Same private session.json format as @zoen/cli — sign in with CLI first. */
export const readSession = Effect.fn(function* readSession(
  directory: string,
  baseUrl: string
) {
  return yield* readSharedSession(directory, baseUrl).pipe(
    Effect.mapError(() => new McpFailure("MCP_SESSION"))
  );
});
