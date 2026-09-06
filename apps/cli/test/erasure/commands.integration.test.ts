import { fileURLToPath } from "node:url";

import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { Effect, FileSystem, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const executable = fileURLToPath(
  new URL("../../dist/main.js", import.meta.url)
);
const world = "22222222-2222-4222-8222-222222222222";
const operation = "44444444-4444-4444-8444-444444444444";
const read = <E, R>(stream: Stream.Stream<Uint8Array, E, R>) =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runCollect,
    Effect.map((parts) => parts.join(""))
  );

const cli = Effect.fn("erasureTest.cli")(
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

it.live(
  "EX33 each erasure command provides concrete help without a session",
  () =>
    Effect.gen(function* commandHelp() {
      for (const command of [
        "inspect-world-erasure",
        "request-world-erasure",
      ]) {
        const output = yield* cli([command, "--help"]);
        expect(output.exitCode).toBe(0);
        expect(output.stderr).toBe("");
        expect(output.stdout).toContain("EXAMPLES");
        expect(output.stdout).toContain(
          `zoen --base-url http://localhost:3000 ${command} --world-id <uuid>`
        );
      }
      const request = yield* cli(["request-world-erasure", "--help"]);
      expect(request.stdout).toContain("--confirm-entire-world");
      expect(request.stdout).toContain("Stale requires a new inspect");
      expect(request.stdout).toContain("--operation-id");
      expect(request.stdout).toContain("Does not claim Erased");
    }).pipe(Effect.provide(NodeServices.layer))
);

it.live(
  "EX33 missing confirm-entire-world or invalid flags exit with closed JSON",
  () =>
    Effect.gen(function* invalidFlags() {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* fs.makeTempDirectoryScoped({
        prefix: "zoen-erasure-cli-invalid-",
      });
      const cases = [
        [
          "request-world-erasure",
          "--world-id",
          world,
          "--expected-revision",
          "null",
          "--operation-id",
          operation,
        ],
        [
          "request-world-erasure",
          "--world-id",
          "not-a-world",
          "--expected-revision",
          "null",
          "--confirm-entire-world",
          "--operation-id",
          operation,
        ],
        ["inspect-world-erasure", "--world-id", "not-a-world"],
        [
          "request-world-erasure",
          "--world-id",
          world,
          "--expected-revision",
          "01",
          "--confirm-entire-world",
          "--operation-id",
          operation,
        ],
      ];
      for (const args of cases) {
        const output = yield* cli([
          "--base-url",
          "http://127.0.0.1:1",
          "--session-dir",
          directory,
          ...args,
        ]);
        expect(output.exitCode).not.toBe(0);
        expect(output.stderr).toContain('"code":"CLI_INPUT"');
        expect(output.stdout).toBe("");
      }
    }).pipe(Effect.provide(NodeServices.layer))
);

it.live(
  "EX33 valid erasure flags stop at the real missing-session boundary",
  () =>
    Effect.gen(function* validFlags() {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* fs.makeTempDirectoryScoped({
        prefix: "zoen-erasure-cli-no-session-",
      });
      const valid = [
        ["inspect-world-erasure", "--world-id", world],
        [
          "request-world-erasure",
          "--world-id",
          world,
          "--expected-revision",
          "null",
          "--confirm-entire-world",
          "--operation-id",
          operation,
        ],
      ];
      for (const args of valid) {
        const output = yield* cli([
          "--base-url",
          "http://127.0.0.1:1",
          "--session-dir",
          directory,
          ...args,
        ]);
        expect(output).toStrictEqual({
          exitCode: 1,
          stderr: '{"_tag":"CliFailure","code":"CLI_SESSION"}\n',
          stdout: "",
        });
      }
    }).pipe(Effect.provide(NodeServices.layer))
);
