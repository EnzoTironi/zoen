/* oxlint-disable effecttsgo/node-builtin-import */
import { spawn } from "node:child_process";

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import {
  proveProcessExited,
  requireSupervisorContainment,
} from "../../../src/ports/disclosure/containment.ts";

describe("ZA-08 containment gate", () => {
  it.effect("refuses network disconnect and TTL as containment", () =>
    Effect.gen(function* refuseWeakClaims() {
      const network = yield* requireSupervisorContainment({
        _tag: "NetworkDisconnect",
        permitId: "00000000-0000-4000-8000-000000000001",
        writerEpoch: "00000000-0000-4000-8000-000000000002",
      }).pipe(Effect.flip);
      const ttl = yield* requireSupervisorContainment({
        _tag: "TtlExpired",
        permitId: "00000000-0000-4000-8000-000000000001",
        writerEpoch: "00000000-0000-4000-8000-000000000002",
      }).pipe(Effect.flip);
      expect(network._tag).toBe("Blocked");
      expect(ttl._tag).toBe("Blocked");
    })
  );

  it.effect("accepts supervisor exit shape then proves ESRCH", () =>
    Effect.gen(function* supervisorProof() {
      const child = spawn(
        process.execPath,
        ["-e", "setInterval(() => {}, 1000)"],
        { stdio: "ignore" }
      );
      const { pid } = child;
      expect(pid).toBeTypeOf("number");
      if (pid === undefined) {
        throw new Error("child pid missing");
      }
      const live = yield* proveProcessExited(pid).pipe(Effect.flip);
      expect(live._tag).toBe("Blocked");
      child.kill("SIGKILL");
      yield* Effect.callback<null>((resume) => {
        child.once("exit", () => {
          resume(Effect.succeed(null));
        });
      });
      yield* proveProcessExited(pid);
      const proven = yield* requireSupervisorContainment({
        _tag: "SupervisorProcessExit",
        exitStatus: child.exitCode ?? 0,
        permitId: "00000000-0000-4000-8000-000000000001",
        pid,
        writerEpoch: "00000000-0000-4000-8000-000000000002",
      });
      expect(proven._tag).toBe("SupervisorProcessExit");
    })
  );
});
