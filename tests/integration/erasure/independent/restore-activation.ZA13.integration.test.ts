import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { NodeServices } from "@effect/platform-node";
import { PgClient } from "@effect/sql-pg";
import { describe, expect, it } from "@effect/vitest";
import { admitWorldContent } from "@zoen/authority/access/erasure/content";
import { admitRestoredWorldAccess } from "@zoen/authority/access/erasure/restore";
import { AuthorityInstallation } from "@zoen/authority/commit/configuration";
import { createPersonalWorld } from "@zoen/authority/commit/genesis";
import { requestWorldErasure } from "@zoen/authority/knowledge/erasure/handlers/request";
import {
  currentRestoreActivationQualification,
  gatesAdmitRestorePromotion,
  linearizeErasureVersusActivation,
} from "@zoen/authority/knowledge/erasure/restore-activation";
import {
  ErasureAttemptRegister,
  blocksWorldContentAdmission,
} from "@zoen/authority/ports/erasure/attempt-register";
import {
  anchoredLocalErasureAttemptRegisterLayer,
  applyErasureAttemptSchema,
} from "@zoen/authority/ports/erasure/local-pg";
import {
  ErasureRestoreActivation,
  memoryRestoreActivationLayer,
} from "@zoen/authority/ports/erasure/restore-activation";
import { DataPolicy } from "@zoen/authority/ports/worlds/context";
import {
  RequestWorldErasure,
  WorldErasureRequested,
} from "@zoen/contracts/erasure/operations";
import { CreatePersonalWorld } from "@zoen/contracts/worlds/operations";
import { OperationId, WorldId } from "@zoen/contracts/worlds/values";
import type { WorldRef } from "@zoen/contracts/worlds/values";
import { Config, Effect, Layer, Redacted, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { SqlClient } from "effect/unstable/sql";

import { fileErasureExternalAnchorLayer } from "../../../../apps/server/src/adapters/erasure/file-anchor.ts";
import { makeDisclosureFenceLayer } from "../../../../apps/server/src/adapters/postgres/disclosure/fence.ts";
import { withWorldsDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.ts";
import { applyErasureMigrations } from "../../../../ops/migrations/run.ts";
import { erasablePolicy, installation, makeContext } from "../core/fixture.ts";

class Za13ComposeFailure extends Schema.TaggedError<Za13ComposeFailure>()(
  "Za13ComposeFailure",
  { detail: Schema.String }
) {}

const repoRoot = fileURLToPath(new URL("../../../..", import.meta.url));

const profile = (url: Redacted.Redacted, name: string) => ({
  applicationName: `zoen-za13-${name}`,
  maxConnections: 4,
  url,
});

const text = <E, R>(stream: Stream.Stream<Uint8Array, E, R>) =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runCollect,
    Effect.map((parts) => parts.join(""))
  );

const composeExec = Effect.fn("ZA13.composeExec")(function* composeExec(
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
    return yield* new Za13ComposeFailure({
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

const withRestoreActivationRuntime = <A, E, R>(
  rights: ReadonlyMap<string, "active" | "revoked" | "unknown">,
  run: (handles: {
    readonly appAdminUrl: string;
    readonly controllerAdminUrl: string;
  }) => Effect.Effect<A, E, R>
) =>
  Effect.gen(function* configure() {
    const adminUrl = yield* Config.redacted("ZOEN_TEST_DATABASE_URL");
    const suffix = randomBytes(12).toString("hex");
    const controllerDb = `za13_controller_${suffix}`;
    const controllerRole = `za13_controller_${suffix}`;
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
      mkdtemp(path.join(tmpdir(), "za13-anchor-"))
    );
    const anchorPath = path.join(anchorDir, "admitted-sequence");
    yield* Effect.tryPromise(() => writeFile(anchorPath, "0\n", "utf-8"));

    const adminLayer = PgClient.layer(profile(adminUrl, "admin"));
    const controllerPg = PgClient.layer(
      profile(controllerRoleUrl, "controller")
    );
    const register = anchoredLocalErasureAttemptRegisterLayer.pipe(
      Layer.provide(controllerPg),
      Layer.provide(fileErasureExternalAnchorLayer(anchorPath)),
      Layer.provide(NodeServices.layer)
    );
    const restoreActivation = memoryRestoreActivationLayer({ rights });

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
              applicationName: "zoen-za13-disclosure",
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
                  Layer.succeed(AuthorityInstallation, installation),
                  Layer.succeed(DataPolicy, erasablePolicy),
                  database.authority,
                  register,
                  restoreActivation,
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

describe("ZA-13 restore activation after erasure", () => {
  it("qualification stays fail-closed; Object Lock restoreAfterErasure Unknown", () => {
    const qualification = currentRestoreActivationQualification();
    expect(gatesAdmitRestorePromotion(qualification)).toBeFalsy();
    expect(qualification.restoreAfterErasure).toBeFalsy();
    expect(qualification.objectLockRestoreAfterErasure).toBe("Unknown");
    expect(qualification.h01).toBe("Blocked");
    expect(qualification.gOps).toBe("Unknown");
    expect(qualification.gStorageFence).toBe("Blocked");
  });

  it.live(
    "ZA-13-01 restore old backup after erasure keeps erased closed; revoked rights denied",
    () => {
      const viewerId = randomUUID();
      const survivingWorldId = Schema.decodeSync(WorldId)(randomUUID());
      return withRestoreActivationRuntime(
        new Map([[`live:${survivingWorldId}:${viewerId}`, "revoked"]]),
        (handles) =>
          Effect.gen(function* scenario() {
            const owner = yield* makeContext();
            const created = yield* createPersonalWorld(
              owner,
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
                owner.presence.principalId
              )
            ).toBe("0");

            const preDump = yield* dumpDatabase(
              handles.appAdminUrl,
              `za13-app-pre-${randomBytes(8).toString("hex")}`
            );

            const closed = yield* requestWorldErasure(
              owner,
              yield* erasureRequest(created.worldRef, randomUUID())
            ).pipe(
              Effect.flatMap(Schema.decodeUnknownEffect(WorldErasureRequested))
            );
            expect(closed).toMatchObject({
              attemptExternalState: "Confirmed",
              phase: "Closing",
              restoreAfterErasure: false,
            });

            const register = yield* ErasureAttemptRegister;
            expect((yield* register.observeWorld(created.worldRef)).state).toBe(
              "Confirmed"
            );

            yield* restoreDatabase(handles.appAdminUrl, preDump);

            const activation = yield* ErasureRestoreActivation;
            const started = yield* activation.beginQuarantinedRestore({
              backupGenerationId: (yield* AuthorityInstallation).generationId,
            });
            expect(started.phase).toBe("Quarantined");
            expect(started.deploymentWriterId.length).toBeGreaterThan(0);

            // Erased scope stays unavailable after restore (controller Confirmed).
            expect(
              yield* admitWorldContent(
                created.worldRef,
                owner.presence.principalId
              ).pipe(Effect.flip)
            ).toMatchObject({ code: "NOT_FOUND_OR_DENIED" });

            // Revoked principal cannot access surviving content under current rights.
            const survivingRef = {
              realm: "live" as const,
              worldId: survivingWorldId,
            };
            expect(
              yield* activation.observeCurrentRights(survivingRef, viewerId)
            ).toBe("revoked");
            expect(
              yield* Effect.exit(
                admitRestoredWorldAccess(survivingRef, viewerId)
              )
            ).toMatchObject({ _tag: "Failure" });

            expect(
              yield* Effect.exit(activation.requireContentServing)
            ).toMatchObject({ _tag: "Failure" });
            expect(
              yield* Effect.exit(activation.requireCredentialPromotion)
            ).toMatchObject({ _tag: "Failure" });

            yield* activation.enterPreparing(started.preparationId);
            expect(
              yield* Effect.exit(
                activation.requirePromotion(started.preparationId, {
                  catalogCoverage: "BoundedComplete",
                  controllerSuppression: { state: "Clear" },
                  erasureRace: {
                    kind: "erasure-admitted-before-drain",
                    suppression: { state: "Clear" },
                  },
                  principalRights: "active",
                  writersSettled: true,
                })
              )
            ).toMatchObject({ _tag: "Failure" });
            expect((yield* activation.observe).phase).toBe("PromotionBlocked");
          })
      );
    }
  );

  it.live(
    "ZA-13-02 controller Unknown / rights unknown → no content-serving or credentials",
    () =>
      withRestoreActivationRuntime(new Map(), (handles) =>
        Effect.gen(function* unknown() {
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
            `za13-controller-${randomBytes(8).toString("hex")}`
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

          const activation = yield* ErasureRestoreActivation;
          const started = yield* activation.beginQuarantinedRestore({
            backupGenerationId: null,
          });
          const rights = yield* activation.observeCurrentRights(
            created.worldRef,
            context.presence.principalId
          );
          expect(rights).toBe("unknown");

          expect(
            yield* admitWorldContent(
              created.worldRef,
              context.presence.principalId
            ).pipe(Effect.flip)
          ).toMatchObject({ code: "NOT_FOUND_OR_DENIED" });
          expect(
            yield* Effect.exit(activation.requireContentServing)
          ).toMatchObject({ _tag: "Failure" });
          expect(
            yield* Effect.exit(activation.requireCredentialPromotion)
          ).toMatchObject({ _tag: "Failure" });
          expect(
            yield* Effect.exit(
              admitRestoredWorldAccess(
                created.worldRef,
                context.presence.principalId
              )
            )
          ).toMatchObject({ _tag: "Failure" });

          yield* activation.enterPreparing(started.preparationId);
          expect(
            yield* Effect.exit(
              activation.requirePromotion(started.preparationId, {
                catalogCoverage: "Unknown",
                controllerSuppression: stale,
                erasureRace: {
                  kind: "controller-unknown-or-stale",
                  suppression: stale,
                },
                principalRights: rights,
                writersSettled: false,
              })
            )
          ).toMatchObject({ _tag: "Failure" });
        })
      )
  );

  it.live(
    "ZA-13-03 erasure race / old writer resume → one permitted order, no erased window",
    () =>
      withRestoreActivationRuntime(new Map(), () =>
        Effect.gen(function* race() {
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
          const registered = yield* register.register(
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
          );
          expect(registered.state).toBe("Registered");

          const activation = yield* ErasureRestoreActivation;
          const started = yield* activation.beginQuarantinedRestore({
            backupGenerationId: null,
          });
          yield* activation.enterPreparing(started.preparationId);

          expect(
            linearizeErasureVersusActivation({
              kind: "erasure-admitted-before-drain",
              suppression: { state: "Registered" },
            })
          ).toStrictEqual({
            contentAdmitted: false,
            order: "include-erasure-in-cut",
          });
          expect(
            linearizeErasureVersusActivation({ kind: "erasure-after-drain" })
          ).toStrictEqual({
            oldEpochAdmitted: false,
            order: "defer-erasure-to-new-epoch",
          });
          expect(
            linearizeErasureVersusActivation({
              kind: "old-writer-resume-after-seal",
            })
          ).toStrictEqual({
            contentAdmitted: false,
            order: "reject-old-writer",
          });

          expect(
            yield* admitWorldContent(
              created.worldRef,
              context.presence.principalId
            ).pipe(Effect.flip)
          ).toMatchObject({ code: "NOT_FOUND_OR_DENIED" });
          expect((yield* activation.observe).phase).toBe("Preparing");
          expect(
            yield* Effect.exit(activation.requireContentServing)
          ).toMatchObject({ _tag: "Failure" });
          expect(
            yield* Effect.exit(
              activation.requirePromotion(started.preparationId, {
                catalogCoverage: "BoundedComplete",
                controllerSuppression: { state: "Registered" },
                erasureRace: { kind: "old-writer-resume-after-seal" },
                principalRights: "active",
                writersSettled: true,
              })
            )
          ).toMatchObject({ _tag: "Failure" });
          expect((yield* activation.observe).phase).toBe("PromotionBlocked");
        })
      )
  );
});
