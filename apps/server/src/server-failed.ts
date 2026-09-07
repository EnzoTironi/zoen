import { Effect } from "effect";
import type { Cause } from "effect/Cause";

/** Log Cause on server.failed so Fly boot diagnostics keep the defect text. */
export const logServerFailed = (cause: Cause<unknown>): Effect.Effect<void> =>
  Effect.logError({ cause: String(cause), event: "server.failed" });

/**
 * Options for NodeRuntime.runMain.
 * Omit disableErrorReporting so Effect keeps pretty-printing defects for Fly.
 */
export const serverMainRuntimeOptions: {
  readonly disableErrorReporting?: boolean;
} = {};
