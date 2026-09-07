import { fileURLToPath } from "node:url";

import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { Effect, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const executable = fileURLToPath(
  new URL("../../dist/main.js", import.meta.url)
);
const read = <E, R>(stream: Stream.Stream<Uint8Array, E, R>) =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runCollect,
    Effect.map((parts) => parts.join(""))
  );

const cli = Effect.fn("eveTest.cli")(
  function* cli(args: readonly string[]) {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const child = yield* spawner.spawn(
      ChildProcess.make(process.execPath, [executable, ...args], {
        stdin: "pipe",
      })
    );
    return yield* Effect.all(
      {
        exitCode: child.exitCode,
        stderr: read(child.stderr),
        stdout: read(child.stdout),
      },
      { concurrency: "unbounded" }
    );
  },
  Effect.scoped,
  Effect.timeout("3 seconds")
);

it.live("EX44 each Eve command provides concrete help without a session", () =>
  Effect.gen(function* commandHelp() {
    for (const command of ["eve-turn", "eve-cancel", "eve-recover"]) {
      const output = yield* cli([command, "--help"]);
      expect(output.exitCode).toBe(0);
      expect(output.stderr).toBe("");
      expect(output.stdout).toContain("EXAMPLES");
      expect(output.stdout).toContain(
        `zoen --base-url http://localhost:3000 ${command}`
      );
    }
    const turn = yield* cli(["eve-turn", "--help"]);
    expect(turn.stdout).toContain("OpenCode Zen");
    expect(turn.stdout).toContain("Blocked");
    expect(turn.stdout).toContain("--ingress-id");
  }).pipe(Effect.provide(NodeServices.layer))
);
