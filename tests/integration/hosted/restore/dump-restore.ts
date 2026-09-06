import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

import { Config, Effect, Redacted, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const repoRoot = fileURLToPath(new URL("../../../..", import.meta.url));

export class DisposableRestoreFailure extends Schema.TaggedError<DisposableRestoreFailure>()(
  "DisposableRestoreFailure",
  { detail: Schema.String }
) {}

const text = <E, R>(stream: Stream.Stream<Uint8Array, E, R>) =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runCollect,
    Effect.map((parts) => parts.join(""))
  );

const compose = Effect.fn("EX37.compose")(function* compose(...args: string[]) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const child = yield* spawner.spawn(
    ChildProcess.make(
      "docker",
      ["compose", "-f", "ops/compose.yaml", ...args],
      { cwd: repoRoot, forceKillAfter: "60 seconds" }
    )
  );
  const result = yield* Effect.all(
    {
      exitCode: child.exitCode,
      stderr: text(child.stderr),
      stdout: text(child.stdout),
    },
    { concurrency: "unbounded" }
  );
  if (result.exitCode !== 0) {
    return yield* new DisposableRestoreFailure({
      detail: `docker compose ${args.join(" ")} failed (${String(result.exitCode)}): ${result.stderr || result.stdout}`,
    });
  }
  return result;
});

const databaseNameOf = (url: Redacted.Redacted) =>
  Effect.gen(function* parseDatabaseName() {
    const pathname = new URL(Redacted.value(url)).pathname.replace(/^\//u, "");
    if (pathname.length === 0 || pathname.includes("/")) {
      return yield* new DisposableRestoreFailure({
        detail: "Disposable database URL pathname is invalid",
      });
    }
    return pathname;
  });

const rewriteDatabase = (url: Redacted.Redacted, databaseName: string) => {
  const next = new URL(Redacted.value(url));
  next.pathname = `/${databaseName}`;
  return Redacted.make(next.href);
};

export interface RestoredDisposable {
  readonly sourceDatabase: string;
  readonly targetAdminUrl: Redacted.Redacted;
  readonly targetDatabase: string;
}

/**
 * Local stand-in for the hosted retained restore path (freeze H03):
 * logical pg_dump of a disposable source install → restore into a disposable
 * target DB on the same compose Postgres. Target is dropped after use.
 * Does not touch Fly app `zoen`, MPG, Tigris, or production secrets.
 *
 * Caller must provide NodeServices (ChildProcessSpawner) + Scope.
 */
export const withLogicalDumpRestore = <A, E, R>(
  sourceUrl: Redacted.Redacted,
  verify: (restored: RestoredDisposable) => Effect.Effect<A, E, R>
) =>
  Effect.gen(function* dumpRestore() {
    const sourceDatabase = yield* databaseNameOf(sourceUrl);
    const targetDatabase = `ex37_restore_${randomBytes(12).toString("hex")}`;
    const dumpPath = `/tmp/${targetDatabase}.sql`;
    const infra = yield* Config.redacted("ZOEN_TEST_DATABASE_URL");
    const targetAdminUrl = rewriteDatabase(infra, targetDatabase);

    yield* compose(
      "exec",
      "-T",
      "postgres",
      "pg_dump",
      "-U",
      "zoen_infra",
      "-d",
      sourceDatabase,
      "--no-owner",
      "--no-acl",
      "-f",
      dumpPath
    );
    yield* compose(
      "exec",
      "-T",
      "postgres",
      "psql",
      "-U",
      "zoen_infra",
      "-d",
      "zoen_test",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `CREATE DATABASE "${targetDatabase}"`
    );

    return yield* Effect.acquireUseRelease(
      Effect.succeed({
        dumpPath,
        sourceDatabase,
        targetAdminUrl,
        targetDatabase,
      }),
      (handles) =>
        Effect.gen(function* restoreAndVerify() {
          yield* compose(
            "exec",
            "-T",
            "postgres",
            "psql",
            "-U",
            "zoen_infra",
            "-d",
            handles.targetDatabase,
            "-v",
            "ON_ERROR_STOP=1",
            "-f",
            handles.dumpPath
          );
          return yield* verify({
            sourceDatabase: handles.sourceDatabase,
            targetAdminUrl: handles.targetAdminUrl,
            targetDatabase: handles.targetDatabase,
          });
        }),
      (handles) =>
        Effect.gen(function* cleanup() {
          yield* compose(
            "exec",
            "-T",
            "postgres",
            "psql",
            "-U",
            "zoen_infra",
            "-d",
            "zoen_test",
            "-v",
            "ON_ERROR_STOP=1",
            "-c",
            `DROP DATABASE IF EXISTS "${handles.targetDatabase}" WITH (FORCE)`
          );
          yield* compose(
            "exec",
            "-T",
            "postgres",
            "rm",
            "-f",
            handles.dumpPath
          );
        }).pipe(Effect.orDie)
    );
  });

export const roleUrlForDatabase = (
  roleUrl: Redacted.Redacted,
  databaseName: string
) => rewriteDatabase(roleUrl, databaseName);
