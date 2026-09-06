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

const cli = Effect.fn("subjectIdentityTest.cli")(
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

const commands = [
  "inspect-identity",
  "inspect-identity-recovery",
  "propose-same-as",
  "propose-identity-split",
  "propose-identity-undo",
  "resolve-identity",
] as const;

it.live(
  "EX28 each subject-identity command provides concrete help without a session",
  () =>
    Effect.gen(function* commandHelp() {
      for (const command of commands) {
        const output = yield* cli([command, "--help"]);
        expect(output.exitCode).toBe(0);
        expect(output.stderr).toBe("");
        expect(output.stdout).toContain("EXAMPLES");
        expect(output.stdout).toContain(
          `zoen --base-url http://localhost:3000 ${command}`
        );
      }
      const resolve = yield* cli(["resolve-identity", "--help"]);
      expect(resolve.stdout).toContain("Stale requires a new inspect");
      expect(resolve.stdout).toContain("--operation-id");
      expect(resolve.stdout).toContain("--consequence-digest");
      const recovery = yield* cli(["inspect-identity-recovery", "--help"]);
      expect(recovery.stdout).toContain("not-requested");
    }).pipe(Effect.provide(NodeServices.layer))
);

it.live(
  "EX28 invalid identity flags exit with closed JSON before session I/O",
  () =>
    Effect.gen(function* invalidFlags() {
      const cases = [
        ["inspect-identity", "--world-id", "not-a-world"],
        [
          "inspect-identity",
          "--world-id",
          "22222222-2222-4222-8222-222222222222",
          "--anchors",
          "A,B,C",
          "--valid-from",
          "2026-09-01",
          "--valid-to",
          "2026-10-01",
        ],
        [
          "propose-same-as",
          "--world-id",
          "22222222-2222-4222-8222-222222222222",
          "--frame-ref",
          "22222222-2222-4222-8222-222222222222",
          "--left",
          "A",
          "--right",
          "A",
          "--operation-id",
          "44444444-4444-4444-8444-444444444444",
        ],
        [
          "resolve-identity",
          "--world-id",
          "22222222-2222-4222-8222-222222222222",
          "--question-ref",
          "22222222-2222-4222-8222-222222222222",
          "--consequence-digest",
          "not-a-digest",
          "--answer",
          "same-as",
          "--operation-id",
          "44444444-4444-4444-8444-444444444444",
        ],
      ];
      for (const args of cases) {
        const output = yield* cli([
          "--base-url",
          "http://127.0.0.1:9",
          ...args,
        ]);
        expect(output.exitCode).not.toBe(0);
        expect(output.stderr).toContain('"code":"CLI_INPUT"');
      }
    }).pipe(Effect.provide(NodeServices.layer))
);
