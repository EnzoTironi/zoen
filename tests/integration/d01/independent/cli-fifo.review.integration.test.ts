import { fileURLToPath } from "node:url";

import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { Config, Effect, FileSystem, Path, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

// Baseline c60ff1f blocked on a FIFO until an external writer opened it.
// The independent process test failed at its 5-second deadline before 2bf56d7.
// SIGTERM alone could not release the pending POSIX open; forceKillAfter bounds cleanup.
it.live(
  "independent CLI rejects a named password pipe without waiting for a writer",
  () =>
    Effect.scoped(
      Effect.gen(function* noFifoWriter() {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        const directory = yield* fs.makeTempDirectoryScoped({
          prefix: "zoen-cli-fifo-review-",
        });
        const fifo = path.join(directory, "password");
        const created = yield* spawner.exitCode(
          ChildProcess.make("mkfifo", ["-m", "600", fifo])
        );
        expect(created).toBe(0);
        const entrypoint = yield* Config.string("ZOEN_CLI_REVIEW_ENTRY").pipe(
          Config.withDefault(
            fileURLToPath(
              new URL("../../../../apps/cli/dist/main.js", import.meta.url)
            )
          )
        );
        const child = yield* spawner.spawn(
          ChildProcess.make(
            process.execPath,
            [
              entrypoint,
              "--base-url",
              "http://localhost:1",
              "sign-in",
              "--email",
              "fifo-review@example.test",
              "--password-file",
              fifo,
            ],
            { forceKillAfter: "500 millis" }
          )
        );
        // The deadline belongs to the parent process; it interrupts and kills a hung child.
        const result = yield* Effect.all(
          {
            exitCode: child.exitCode,
            stderr: child.stderr.pipe(
              Stream.decodeText(),
              Stream.runCollect,
              Effect.map((parts) => parts.join(""))
            ),
            stdout: child.stdout.pipe(
              Stream.decodeText(),
              Stream.runCollect,
              Effect.map((parts) => parts.join(""))
            ),
          },
          { concurrency: "unbounded" }
        ).pipe(Effect.timeout("5 seconds"));
        expect(result).toStrictEqual({
          exitCode: 2,
          stderr: '{"_tag":"CliFailure","code":"CLI_INPUT"}\n',
          stdout: "",
        });
      })
    ).pipe(Effect.provide(NodeServices.layer))
);
