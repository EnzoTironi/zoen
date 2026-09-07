import { fileURLToPath } from "node:url";

import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { Effect, FileSystem, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const executable = fileURLToPath(
  new URL("../../dist/main.js", import.meta.url)
);
const world = "22222222-2222-4222-8222-222222222222";
const principal = "33333333-3333-4333-8333-333333333333";
const operation = "44444444-4444-4444-8444-444444444444";
const targetFlags = ["--world-id", world, "--principal-ref", principal];
const mutationFlags = [...targetFlags, "--operation-id", operation];
const read = <E, R>(stream: Stream.Stream<Uint8Array, E, R>) =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runCollect,
    Effect.map((parts) => parts.join(""))
  );

const cli = Effect.fn("sharingTest.cli")(
  function* cli(args: readonly string[]) {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const child = yield* spawner.spawn(
      ChildProcess.make(process.execPath, [executable, ...args], {
        stdin: "pipe",
      })
    );
    // Keep stdin open: parse failures must not wait for EOF or an interactive answer.
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
  "EX23 each sharing command provides concrete help without reading stdin or requiring a session",
  () =>
    Effect.gen(function* commandHelp() {
      for (const command of [
        "inspect-access",
        "grant-read-access",
        "revoke-read-access",
      ]) {
        const output = yield* cli([command, "--help"]);
        expect(output.exitCode).toBe(0);
        expect(output.stderr).toBe("");
        expect(output.stdout).toContain("EXAMPLES");
        expect(output.stdout).toContain(
          `zoen --base-url http://localhost:3000 ${command} --world-id <uuid>`
        );
        if (command !== "inspect-access") {
          expect(output.stdout).toContain("membershipAtCommit is historical");
          expect(output.stdout).toContain("--operation-id");
          expect(output.stdout).toContain("--expected-revision");
        }
        if (command === "grant-read-access") {
          expect(output.stdout).toContain(
            "ALL existing and future evidence and claims"
          );
          expect(output.stdout).toContain(
            "replay of an old grant does not restore access"
          );
        }
      }
      const legacy = yield* cli(["import", "--help"]);
      expect(legacy.exitCode).toBe(0);
      expect(legacy.stdout).toContain("json (legacy worlds JSON)");
      expect(legacy.stdout).toContain("--format csv --file -");
    }).pipe(Effect.provide(NodeServices.layer))
);

it.live(
  "EX23 invalid sharing flags exit with closed JSON stderr before stdin or session I/O",
  () =>
    Effect.gen(function* invalidFlags() {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* fs.makeTempDirectoryScoped({
        prefix: "zoen-sharing-cli-invalid-",
      });
      const invalid = [
        ["grant-read-access", ...mutationFlags],
        ["grant-read-access", ...targetFlags, "--expected-revision", "null"],
        [
          "grant-read-access",
          "--world-id",
          world,
          "--operation-id",
          operation,
          "--expected-revision",
          "null",
        ],
        [
          "grant-read-access",
          ...mutationFlags,
          "--expected-revision",
          "0",
          "--role",
          "owner",
        ],
        ["revoke-read-access", ...mutationFlags, "--expected-revision", "null"],
        [
          "inspect-access",
          "--world-id",
          world,
          "--principal-ref",
          "person@example.test",
        ],
        ["inspect-access", "--world-id", world, "--operation-id", operation],
        ["inspect-access", "--world-id", "not-a-world"],
        ...["-1", "1.0", "01", "1e3", "1000000000000000000"].map((revision) => [
          "grant-read-access",
          ...mutationFlags,
          "--expected-revision",
          revision,
        ]),
      ];
      for (const args of invalid) {
        const output = yield* cli([
          "--base-url",
          "http://127.0.0.1:1",
          "--session-dir",
          directory,
          ...args,
        ]);
        expect(output).toStrictEqual({
          exitCode: 2,
          stderr: '{"_tag":"CliFailure","code":"CLI_INPUT"}\n',
          stdout: "",
        });
      }
    }).pipe(Effect.provide(NodeServices.layer))
);

it.live(
  "EX23 valid explicit flags cross schema validation and stop at the real missing-session boundary",
  () =>
    Effect.gen(function* validFlags() {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* fs.makeTempDirectoryScoped({
        prefix: "zoen-sharing-cli-no-session-",
      });
      const valid = [
        ["inspect-access", "--world-id", world],
        ["inspect-access", ...targetFlags],
        ["grant-read-access", ...mutationFlags, "--expected-revision", "null"],
        ["grant-read-access", ...mutationFlags, "--expected-revision", "0"],
        [
          "grant-read-access",
          ...mutationFlags,
          "--expected-revision",
          "999999999999999999",
        ],
        ["revoke-read-access", ...mutationFlags, "--expected-revision", "0"],
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
