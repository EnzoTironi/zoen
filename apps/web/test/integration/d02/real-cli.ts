import { NodeServices } from "@effect/platform-node";
import { Config, Effect, FileSystem, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const read = <E, R>(stream: Stream.Stream<Uint8Array, E, R>) =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runCollect,
    Effect.map((parts) => parts.join(""))
  );

export const makeSessionDirectory = () =>
  Effect.runPromise(
    FileSystem.FileSystem.use((fs) =>
      fs.makeTempDirectory({ prefix: "zoen-ex14-browser-cli-" })
    ).pipe(Effect.provide(NodeServices.layer))
  );
export const removeSessionDirectory = (directory: string) =>
  Effect.runPromise(
    FileSystem.FileSystem.use((fs) =>
      fs.remove(directory, { recursive: true })
    ).pipe(Effect.provide(NodeServices.layer))
  );

export const cli = (
  origin: string,
  directory: string,
  args: readonly string[],
  input?: string
) =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* actualCli() {
        const entry = yield* Config.string("ZOEN_CLI_REVIEW_ENTRY").pipe(
          Config.withDefault("apps/cli/dist/main.js")
        );
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        const child = yield* spawner.spawn(
          ChildProcess.make(
            process.execPath,
            [entry, "--base-url", origin, "--session-dir", directory, ...args],
            {
              env: { FORCE_COLOR: undefined, NO_COLOR: "1" },
              forceKillAfter: "500 millis",
              stdin:
                input === undefined
                  ? "ignore"
                  : Stream.make(new TextEncoder().encode(input)),
            }
          )
        );
        return yield* Effect.all(
          {
            exitCode: child.exitCode,
            stderr: read(child.stderr),
            stdout: read(child.stdout),
          },
          { concurrency: "unbounded" }
        );
      })
    ).pipe(Effect.provide(NodeServices.layer))
  );
