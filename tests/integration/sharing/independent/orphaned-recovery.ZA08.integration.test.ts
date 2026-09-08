/* oxlint-disable effecttsgo/node-builtin-import */
/* oxlint-disable effecttsgo/prefer-schema-over-json */
/* oxlint-disable unicorn/import-style */
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { Instant } from "@zoen/contracts/worlds/values";
import { DisclosureFence } from "@zoen/ontology/ports/disclosure/fence";
import { VerifiedPresence } from "@zoen/ontology/ports/worlds/context";
import {
  DateTime,
  Effect,
  FileSystem,
  Layer,
  Redacted,
  Schedule,
  Schema,
} from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
} from "effect/unstable/http";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { SqlClient } from "effect/unstable/sql";

import { makeDisclosureFenceLayer } from "../../../../apps/server/src/adapters/postgres/disclosure/fence.ts";
import { withWorldsDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.ts";
import { applyDisclosureMigrations } from "../../../../ops/migrations/run.ts";

const waitUntil = <E, R>(probe: Effect.Effect<boolean, E, R>) =>
  probe.pipe(
    Effect.repeat({
      schedule: Schedule.spaced("20 millis"),
      until: (done) => done,
    }),
    Effect.timeout("12 seconds")
  );

const Ready = Schema.Struct({ origin: Schema.String, pid: Schema.Int });
const Inventory = Schema.Struct({
  permitId: Schema.String,
  pid: Schema.Int,
  writerEpoch: Schema.String,
});

it.live(
  "ZA-08 orphaned disclosure recovery: containment required, then revoke unblocks without retraction claim",
  () =>
    withWorldsDatabase(
      (database) =>
        Effect.scoped(
          Effect.gen(function* za08Acceptance() {
            const fs = yield* FileSystem.FileSystem;
            const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
            const sql = yield* SqlClient.SqlClient;
            const fence = yield* DisclosureFence;
            const now = yield* DateTime.now;
            const presence = yield* Schema.decodeEffect(VerifiedPresence)({
              authenticatedAt: DateTime.formatIso(now),
              expiresAt: DateTime.formatIso(
                DateTime.add(now, { seconds: 120 })
              ),
              principalId: randomUUID(),
              realm: "live",
              sessionId: randomUUID(),
            });
            const deadline = yield* Schema.decodeEffect(Instant)(
              DateTime.formatIso(DateTime.add(now, { seconds: 30 }))
            );
            const controlDir = join(tmpdir(), `za08-${randomUUID()}`);
            mkdirSync(controlDir, { mode: 0o700 });
            yield* Effect.addFinalizer(() =>
              Effect.sync(() => {
                rmSync(controlDir, { force: true, recursive: true });
              })
            );
            const privateBody = `private-za08-${randomUUID()}`;
            const configPath = join(controlDir, "config.json");
            writeFileSync(
              configPath,
              JSON.stringify({
                authorityUrl: Redacted.value(database.urls.authority),
                controlDir,
                membershipWorldId: randomUUID(),
                presence,
                privateBody,
              }),
              { mode: 0o600 }
            );

            const child = yield* spawner.spawn(
              ChildProcess.make(
                process.execPath,
                [
                  "--experimental-strip-types",
                  fileURLToPath(
                    new URL("orphaned-recovery-writer.ts", import.meta.url)
                  ),
                ],
                {
                  env: { ZOEN_ZA08_CONFIG: configPath },
                  forceKillAfter: "500 millis",
                }
              )
            );
            yield* Effect.addFinalizer(() =>
              Effect.sync(() => {
                try {
                  process.kill(child.pid, "SIGKILL");
                } catch {
                  /* already exited */
                }
              })
            );

            yield* waitUntil(fs.exists(`${controlDir}/ready.json`));
            const ready = yield* Schema.decodeEffect(
              Schema.fromJsonString(Ready)
            )(readFileSync(`${controlDir}/ready.json`, "utf-8"));
            expect(ready.pid).toBe(child.pid);

            // Real HTTP client against the child writer; it pauses before end.
            yield* HttpClientRequest.get(`${ready.origin}/probe`).pipe(
              HttpClient.execute,
              Effect.catch(() => Effect.void),
              Effect.forkChild
            );

            yield* waitUntil(fs.exists(`${controlDir}/paused`));
            yield* waitUntil(fs.exists(`${controlDir}/inventory.json`));
            const inventory = yield* Schema.decodeEffect(
              Schema.fromJsonString(Inventory)
            )(readFileSync(`${controlDir}/inventory.json`, "utf-8"));
            expect(inventory.pid).toBe(child.pid);
            expect(
              yield* sql`SELECT count(*)::int AS pending FROM jobs.disclosure_pending`
            ).toStrictEqual([{ pending: 1 }]);
            expect(
              yield* sql`SELECT status FROM jobs.disclosure_writer_epochs WHERE writer_epoch = ${inventory.writerEpoch}`
            ).toStrictEqual([{ status: "active" }]);
            expect(
              yield* Effect.scoped(
                fence.exclusiveSession(presence, deadline)
              ).pipe(Effect.flip)
            ).toMatchObject({ _tag: "Unavailable" });

            // ZA-08-02 — network disconnect / TTL without containment refuse.
            expect(
              yield* Effect.scoped(
                fence.recoverOrphaned(
                  {
                    _tag: "NetworkDisconnect",
                    permitId: inventory.permitId,
                    writerEpoch: inventory.writerEpoch,
                  },
                  deadline
                )
              ).pipe(Effect.flip)
            ).toMatchObject({ _tag: "Blocked" });
            expect(
              yield* Effect.scoped(
                fence.recoverOrphaned(
                  {
                    _tag: "TtlExpired",
                    permitId: inventory.permitId,
                    writerEpoch: inventory.writerEpoch,
                  },
                  deadline
                )
              ).pipe(Effect.flip)
            ).toMatchObject({ _tag: "Blocked" });
            expect(
              yield* sql`SELECT count(*)::int AS pending FROM jobs.disclosure_pending`
            ).toStrictEqual([{ pending: 1 }]);
            expect(
              yield* sql`SELECT count(*)::int AS recovery FROM jobs.disclosure_recovery`
            ).toStrictEqual([{ recovery: 0 }]);

            expect(
              yield* Effect.scoped(
                fence.recoverOrphaned(
                  {
                    _tag: "SupervisorProcessExit",
                    exitStatus: 0,
                    permitId: inventory.permitId,
                    pid: inventory.pid,
                    writerEpoch: inventory.writerEpoch,
                  },
                  deadline
                )
              ).pipe(Effect.flip)
            ).toMatchObject({ _tag: "Blocked" });

            // Bound PID required: ESRCH on an unrelated pid must not retire this epoch.
            expect(
              yield* Effect.scoped(
                fence.recoverOrphaned(
                  {
                    _tag: "SupervisorProcessExit",
                    exitStatus: 9,
                    permitId: inventory.permitId,
                    pid: 2_147_483_646,
                    writerEpoch: inventory.writerEpoch,
                  },
                  deadline
                )
              ).pipe(Effect.flip)
            ).toMatchObject({ _tag: "Unavailable" });
            expect(
              yield* sql`SELECT count(*)::int AS pending FROM jobs.disclosure_pending`
            ).toStrictEqual([{ pending: 1 }]);

            // ZA-08-01 — kill writer before send; prove ESRCH; recover.
            process.kill(inventory.pid, "SIGKILL");
            yield* waitUntil(
              Effect.sync(() => {
                try {
                  process.kill(inventory.pid, 0);
                  return false;
                } catch (error) {
                  return (
                    typeof error === "object" &&
                    error !== null &&
                    "code" in error &&
                    error.code === "ESRCH"
                  );
                }
              })
            );

            yield* Effect.scoped(
              fence.recoverOrphaned(
                {
                  _tag: "SupervisorProcessExit",
                  exitStatus: 9,
                  permitId: inventory.permitId,
                  pid: inventory.pid,
                  writerEpoch: inventory.writerEpoch,
                },
                deadline
              )
            );

            expect(
              yield* sql`SELECT count(*)::int AS pending FROM jobs.disclosure_pending`
            ).toStrictEqual([{ pending: 0 }]);
            expect(
              yield* sql`SELECT status FROM jobs.disclosure_writer_epochs WHERE writer_epoch = ${inventory.writerEpoch}`
            ).toStrictEqual([{ status: "retired" }]);
            const recovery = yield* sql<{
              containment_kind: string;
              permit_id: string;
              writer_epoch: string;
            }>`SELECT permit_id, writer_epoch, containment_kind FROM jobs.disclosure_recovery`;
            expect(recovery).toStrictEqual([
              {
                containment_kind: "supervisor_process_exit",
                permit_id: inventory.permitId,
                writer_epoch: inventory.writerEpoch,
              },
            ]);
            expect(
              Object.keys(recovery[0] ?? {}).some((key) =>
                key.toLowerCase().includes("retract")
              )
            ).toBeFalsy();

            yield* Effect.scoped(fence.exclusiveSession(presence, deadline));
            expect(
              yield* sql`SELECT count(*)::int AS closing FROM jobs.disclosure_session_closing`
            ).toStrictEqual([{ closing: 1 }]);

            // ZA-08-03 — killed writer cannot resume/end; send-gate covered in send-gate.ZA08.test.ts.
            writeFileSync(`${controlDir}/resume`, "1", { mode: 0o600 });
            yield* Effect.sleep("200 millis");
            expect(existsSync(`${controlDir}/submitted`)).toBeFalsy();
            expect(existsSync(`${controlDir}/send-error`)).toBeFalsy();
            expect(privateBody.length).toBeGreaterThan(0);

            expect(
              yield* Effect.scoped(
                fence.recoverOrphaned(
                  {
                    _tag: "SupervisorProcessExit",
                    exitStatus: 9,
                    permitId: inventory.permitId,
                    pid: inventory.pid,
                    writerEpoch: inventory.writerEpoch,
                  },
                  deadline
                )
              ).pipe(Effect.flip)
            ).toMatchObject({ _tag: "Unavailable" });
          })
        ).pipe(
          Effect.provide(
            Layer.mergeAll(
              makeDisclosureFenceLayer({
                applicationName: "za08-recovery-supervisor",
                maxConnections: 4,
                url: database.urls.authority,
              }),
              database.authority,
              FetchHttpClient.layer,
              NodeServices.layer
            )
          )
        ),
      undefined,
      (database) =>
        applyDisclosureMigrations(database.names).pipe(
          Effect.provide(Layer.mergeAll(database.migration, NodeServices.layer))
        )
    )
);
