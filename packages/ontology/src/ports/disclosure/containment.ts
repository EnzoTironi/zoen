import { Blocked } from "@zoen/contracts/worlds/errors";
import { Effect } from "effect";

import type { WriterContainment } from "./fence.js";

/**
 * Only supervisor-proven process exit is admissible on this runtime.
 * Scope finalizers, network loss, and TTL are not crash containment.
 */
export const requireSupervisorContainment = (
  containment: WriterContainment
): Effect.Effect<
  Extract<WriterContainment, { readonly _tag: "SupervisorProcessExit" }>,
  Blocked
> => {
  if (containment._tag !== "SupervisorProcessExit") {
    return Effect.fail(new Blocked({ code: "PROFILE_BLOCKED" }));
  }
  if (
    !Number.isSafeInteger(containment.pid) ||
    containment.pid <= 0 ||
    !Number.isSafeInteger(containment.exitStatus)
  ) {
    return Effect.fail(new Blocked({ code: "PROFILE_BLOCKED" }));
  }
  return Effect.succeed(containment);
};

/** Prove the OS process is gone. A live/stopped process is not contained. */
export const proveProcessExited = (pid: number): Effect.Effect<void, Blocked> =>
  Effect.sync(() => {
    try {
      process.kill(pid, 0);
      return false;
    } catch (error) {
      return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ESRCH"
      );
    }
  }).pipe(
    Effect.flatMap((exited) =>
      exited
        ? Effect.void
        : Effect.fail(new Blocked({ code: "PROFILE_BLOCKED" }))
    )
  );
