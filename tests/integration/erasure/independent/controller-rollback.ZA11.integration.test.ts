import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { NodeServices } from "@effect/platform-node";
import { PgClient } from "@effect/sql-pg";
import { describe, expect, it } from "@effect/vitest";
import { admitWorldContent } from "@zoen/authority/access/erasure/content";
import { AuthorityInstallation } from "@zoen/authority/commit/configuration";
import { createPersonalWorld } from "@zoen/authority/commit/genesis";
import { requestWorldErasure } from "@zoen/authority/knowledge/erasure/handlers/request";
import {
  ErasureAttemptRegister,
  blocksWorldContentAdmission,
} from "@zoen/authority/ports/erasure/attempt-register";
import {
  anchoredLocalErasureAttemptRegisterLayer,
  applyErasureAttemptSchema,
} from "@zoen/authority/ports/erasure/local-pg";
import {
  isFullIndependentControllerAdmitted,
  localNarrowControllerQualification,
  unqualifiedControllerQualification,
} from "@zoen/authority/ports/erasure/qualification";
import {
  RequestWorldErasure,
  WorldErasureRequested,
} from "@zoen/contracts/erasure/operations";
import { CreatePersonalWorld } from "@zoen/contracts/worlds/operations";
import { OperationId } from "@zoen/contracts/worlds/values";
import type { WorldRef } from "@zoen/contracts/worlds/values";
import { Config, Effect, Layer, Redacted, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { SqlClient } from "effect/unstable/sql";

import { fileErasureExternalAnchorLayer } from "../../../../apps/server/src/adapters/erasure/file-anchor.ts";
import { makeDisclosureFenceLayer } from "../../../../apps/server/src/adapters/postgres/disclosure/fence.ts";
import { withWorldsDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.ts";
import { applyErasureMigrations } from "../../../../ops/migrations/run.ts";
import { erasableConfiguration, makeContext } from "../core/fixture.ts";

class Za11ComposeFailure extends Schema.TaggedError<Za11ComposeFailure>()(
  "Za11ComposeFailure",
  { detail: Schema.String }
) {}

const repoRoot = fileURLToPath(new URL("../../../..", import.meta.url));

const profile = (url: Redacted.Redacted, name: string) => ({
  applicationName: `zoen-za11-${name}`,
  maxConnections: 4,
  url,
});

const text = <E, R>(stream: Stream.Stream<Uint8Array, E, R>) =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runCollect,
    Effect.map((parts) => parts.join(""))
  );

const composeExec = Effect.fn("ZA11.composeExec")(function* composeExec(
  ...args: string[]
) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const child = yield* spawner.spawn(
    ChildProcess.make(
      "docker",
      ["compose", "-f", "ops/compose.yaml", "exec", "-T", "postgres", ...args],
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
    return yield* new Za11ComposeFailure({
      detail: `compose exec failed (${String(result.exitCode)}): ${result.stderr || result.stdout}`,
    });
  }
  return result;
});

const databaseNameOf = (url: string): string => {
  const { pathname } = new URL(url);
  const name = pathname.replace(/^\//u, "");
  if (name.length === 0) {
    throw new Error("database name missing from URL");
  }
  return name;
};

const dumpDatabase = (url: string, dumpToken: string) =>
  Effect.gen(function* dump() {
    const database = databaseNameOf(url);
    const containerPath = `/tmp/${dumpToken}.dump`;
    yield* composeExec(
      "pg_dump",
      "-U",
      "zoen_infra",
      "-d",
      database,
      "--format=custom",
      "-f",
      containerPath
    );
    return containerPath;
  });

const restoreDatabase = (url: string, containerPath: string) =>
  Effect.gen(function* restore() {
    const database = databaseNameOf(url);
    yield* composeExec(
      "psql",
      "-U",
      "zoen_infra",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${database}' AND pid <> pg_backend_pid();`
    ).pipe(Effect.ignore);
    yield* composeExec(
      "pg_restore",
      "-U",
      "zoen_infra",
      "-d",
      database,
      "--clean",
      "--if-exists",
      containerPath
    );
    yield* composeExec("rm", "-f", containerPath).pipe(Effect.ignore);
  });

const erasureRequest = (worldRef: WorldRef, operationId: string) =>
  Schema.decodeEffect(RequestWorldErasure)({
    input: {
      confirmEntireWorld: true,
      expectedErasureRevision: null,
      policyVersion: "worlds-local-erasable-v1",
    },
    operation: "RequestWorldErasure",
    operationId,
    purpose: "personal-records",
    schemaVersion: "erasure.v1",
    worldRef,
  });

/**
 * ZA-11 local narrow seam: application store, separately owned controller store,
 * and file anchor outside both DB rollback units. Proves only the declared
 * separation — not whole-host / H-01 hosted independence.
 */
const withIndependentControllerRuntime = <A, E, R>(
  run: (handles: {
    readonly appAdminUrl: string;
    readonly controllerAdminUrl: string;
  }) => Effect.Effect<A, E, R>
) =>
  Effect.gen(function* configure() {
    const adminUrl = yield* Config.redacted("ZOEN_TEST_DATABASE_URL");
    const suffix = randomBytes(12).toString("hex");
    const controllerDb = `za11_controller_${suffix}`;
    const controllerRole = `za11_controller_${suffix}`;
    const controllerPassword = randomBytes(32).toString("hex");
    const controllerRoleUrl = (() => {
      const url = new URL(Redacted.value(adminUrl));
      url.pathname = `/${controllerDb}`;
      url.username = controllerRole;
      url.password = controllerPassword;
      return Redacted.make(url.href);
    })();
    const controllerAdminUrl = (() => {
      const url = new URL(Redacted.value(adminUrl));
      url.pathname = `/${controllerDb}`;
      return url.href;
    })();
    const anchorDir = yield* Effect.tryPromise(() =>
      mkdtemp(path.join(tmpdir(), "za11-anchor-"))
    );
    const anchorPath = path.join(anchorDir, "admitted-sequence");
    yield* Effect.tryPromise(() => writeFile(anchorPath, "0\n", "utf-8"));

    const adminLayer = PgClient.layer(profile(adminUrl, "admin"));
    // Owner of the disposable controller DB — use plain PgClient (EX31), not
    // makeWorldsPostgresLayer (rejects CREATE-on-database owners).
    const controllerPg = PgClient.layer(
      profile(controllerRoleUrl, "controller")
    );
    const register = anchoredLocalErasureAttemptRegisterLayer.pipe(
      Layer.provide(controllerPg),
      Layer.provide(fileErasureExternalAnchorLayer(anchorPath)),
      Layer.provide(NodeServices.layer)
    );

    return yield* Effect.scoped(
      Effect.gen(function* own() {
        const adminSql = yield* SqlClient.SqlClient;
        yield* Effect.acquireRelease(
          adminSql
            .unsafe(
              `CREATE ROLE "${controllerRole}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOREPLICATION PASSWORD '${controllerPassword}'`
            )
            .pipe(Effect.orDie),
          () =>
            adminSql`DROP ROLE ${adminSql(controllerRole)}`.pipe(Effect.orDie)
        );
        yield* Effect.acquireRelease(
          adminSql`CREATE DATABASE ${adminSql(controllerDb)} OWNER ${adminSql(controllerRole)}`,
          () =>
            adminSql`DROP DATABASE ${adminSql(controllerDb)} WITH (FORCE)`.pipe(
              Effect.orDie
            )
        );
        yield* Effect.acquireRelease(Effect.succeed(anchorDir), () =>
          Effect.tryPromise(() =>
            rm(anchorDir, { force: true, recursive: true })
          ).pipe(Effect.orDie)
        );
        yield* applyErasureAttemptSchema().pipe(Effect.provide(controllerPg));

        return yield* withWorldsDatabase(
          (database) => {
            const fence = makeDisclosureFenceLayer({
              applicationName: "zoen-za11-disclosure",
              maxConnections: 4,
              url: database.urls.authority,
            });
            const appAdminUrl = (() => {
              const infra = new URL(Redacted.value(adminUrl));
              const authority = new URL(
                Redacted.value(database.urls.authority)
              );
              infra.pathname = authority.pathname;
              return infra.href;
            })();
            return run({ appAdminUrl, controllerAdminUrl }).pipe(
              Effect.provide(
                Layer.mergeAll(
                  erasableConfiguration,
                  database.authority,
                  register,
                  fence,
                  NodeServices.layer
                )
              )
            );
          },
          undefined,
          (database) =>
            applyErasureMigrations(database.names).pipe(
              Effect.provide(
                Layer.mergeAll(database.migration, NodeServices.layer)
              )
            )
        );
      })
    ).pipe(Effect.provide(adminLayer));
  });

describe("ZA-11 independent erasure controller (local narrow)", () => {
  it("qualification stays fail-closed for H-01/G-OPS hosted independence", () => {
    const unqualified = unqualifiedControllerQualification();
    const local = localNarrowControllerQualification();
    expect(isFullIndependentControllerAdmitted(unqualified)).toBeFalsy();
    expect(isFullIndependentControllerAdmitted(local)).toBeFalsy();
    expect(local.localNarrowRollbackSeparation).toBeTruthy();
    expect(local.restoreAfterErasure).toBeFalsy();
    expect(local.h01Approved).toBeFalsy();
  });

  it.live(
    "ZA-11-01 restore pre-Closing application backup keeps controller attempt and closes content",
    () =>
      withIndependentControllerRuntime((handles) =>
        Effect.gen(function* appRestore() {
          const context = yield* makeContext();
          const created = yield* createPersonalWorld(
            context,
            yield* Schema.decodeEffect(CreatePersonalWorld)({
              input: {},
              operation: "CreatePersonalWorld",
              operationId: randomUUID(),
              purpose: "personal-records",
              schemaVersion: "worlds.v1",
            })
          );
          expect(
            yield* admitWorldContent(
              created.worldRef,
              context.presence.principalId
            )
          ).toBe("0");

          const preClosingDump = yield* dumpDatabase(
            handles.appAdminUrl,
            `za11-app-pre-${randomBytes(8).toString("hex")}`
          );

          const closed = yield* requestWorldErasure(
            context,
            yield* erasureRequest(created.worldRef, randomUUID())
          ).pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(WorldErasureRequested))
          );
          expect(closed).toMatchObject({
            attemptExternalState: "Confirmed",
            phase: "Closing",
            restoreAfterErasure: false,
          });
          expect(
            yield* admitWorldContent(
              created.worldRef,
              context.presence.principalId
            ).pipe(Effect.flip)
          ).toMatchObject({ code: "NOT_FOUND_OR_DENIED" });

          const register = yield* ErasureAttemptRegister;
          expect((yield* register.observeWorld(created.worldRef)).state).toBe(
            "Confirmed"
          );

          yield* restoreDatabase(handles.appAdminUrl, preClosingDump);

          expect((yield* register.observeWorld(created.worldRef)).state).toBe(
            "Confirmed"
          );
          expect(
            yield* admitWorldContent(
              created.worldRef,
              context.presence.principalId
            ).pipe(Effect.flip)
          ).toMatchObject({ code: "NOT_FOUND_OR_DENIED" });
        })
      )
  );

  it.live(
    "ZA-11-02 restored controller snapshot / old signed head is rejected against current anchor",
    () =>
      withIndependentControllerRuntime((handles) =>
        Effect.gen(function* controllerRestore() {
          const context = yield* makeContext();
          const created = yield* createPersonalWorld(
            context,
            yield* Schema.decodeEffect(CreatePersonalWorld)({
              input: {},
              operation: "CreatePersonalWorld",
              operationId: randomUUID(),
              purpose: "personal-records",
              schemaVersion: "worlds.v1",
            })
          );
          yield* requestWorldErasure(
            context,
            yield* erasureRequest(created.worldRef, randomUUID())
          );

          const controllerDump = yield* dumpDatabase(
            handles.controllerAdminUrl,
            `za11-controller-${randomBytes(8).toString("hex")}`
          );

          const otherContext = yield* makeContext();
          const other = yield* createPersonalWorld(
            otherContext,
            yield* Schema.decodeEffect(CreatePersonalWorld)({
              input: {},
              operation: "CreatePersonalWorld",
              operationId: randomUUID(),
              purpose: "personal-records",
              schemaVersion: "worlds.v1",
            })
          );
          yield* requestWorldErasure(
            otherContext,
            yield* erasureRequest(other.worldRef, randomUUID())
          );

          yield* restoreDatabase(handles.controllerAdminUrl, controllerDump);

          const register = yield* ErasureAttemptRegister;
          const stale = yield* register.observeWorld(created.worldRef);
          expect(stale.state).toBe("Unknown");
          expect(blocksWorldContentAdmission(stale)).toBeTruthy();
          expect(
            yield* admitWorldContent(
              created.worldRef,
              context.presence.principalId
            ).pipe(Effect.flip)
          ).toMatchObject({ code: "NOT_FOUND_OR_DENIED" });

          const installed = yield* AuthorityInstallation;
          const registerExit = yield* Effect.exit(
            register.register(
              {
                deploymentEpoch: `cell:${installed.cellId}:epoch:${installed.cellEpoch}`,
                operationId: Schema.decodeSync(OperationId)(randomUUID()),
                principalId: context.presence.principalId,
                worldRef: created.worldRef,
              },
              {
                confirmEntireWorld: true,
                expectedErasureRevision: null,
                policyVersion: "worlds-local-erasable-v1",
              }
            )
          );
          expect(registerExit._tag).toBe("Failure");
        })
      )
  );

  it.live(
    "ZA-11-03 crash between register and local decision leaves Registered blocked without invented Abort",
    () =>
      withIndependentControllerRuntime(() =>
        Effect.gen(function* crashWindow() {
          const context = yield* makeContext();
          const created = yield* createPersonalWorld(
            context,
            yield* Schema.decodeEffect(CreatePersonalWorld)({
              input: {},
              operation: "CreatePersonalWorld",
              operationId: randomUUID(),
              purpose: "personal-records",
              schemaVersion: "worlds.v1",
            })
          );
          const register = yield* ErasureAttemptRegister;
          const installed = yield* AuthorityInstallation;
          const operationId = Schema.decodeSync(OperationId)(randomUUID());
          const identity = {
            deploymentEpoch: `cell:${installed.cellId}:epoch:${installed.cellEpoch}`,
            operationId,
            principalId: context.presence.principalId,
            worldRef: created.worldRef,
          };
          const registered = yield* register.register(identity, {
            confirmEntireWorld: true,
            expectedErasureRevision: null,
            policyVersion: "worlds-local-erasable-v1",
          });
          expect(registered.state).toBe("Registered");

          const observed = yield* register.inspect(identity);
          expect(observed.state).toBe("Registered");
          expect(observed.state).not.toBe("Aborted");

          const worldObs = yield* register.observeWorld(created.worldRef);
          expect(worldObs.state).toBe("Registered");
          expect(blocksWorldContentAdmission(worldObs)).toBeTruthy();
          expect(
            yield* admitWorldContent(
              created.worldRef,
              context.presence.principalId
            ).pipe(Effect.flip)
          ).toMatchObject({ code: "NOT_FOUND_OR_DENIED" });
        })
      )
  );
});
