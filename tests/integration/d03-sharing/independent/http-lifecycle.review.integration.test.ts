import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { PutBucketVersioningCommand } from "@aws-sdk/client-s3";
import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import {
  AuthorityInstallation,
  AuthorityInstallationSchema,
} from "@zoen/authority/commit/configuration";
import {
  DataPolicy,
  DataPolicySchema,
} from "@zoen/authority/ports/worlds/context";
import {
  PrincipalRef,
  WorldReadAccessGranted,
  WorldReadAccessRevoked,
} from "@zoen/contracts/sharing/operations";
import { WorldCreated } from "@zoen/contracts/worlds/operations";
import {
  Deferred,
  Effect,
  Fiber,
  FileSystem,
  Layer,
  Redacted,
  Schedule,
  Schema,
} from "effect";
import {
  Cookies,
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
} from "effect/unstable/http";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { SqlClient } from "effect/unstable/sql";

import {
  sdk,
  withStorage,
} from "../../../../apps/server/test/adapters/object-storage/worlds/fixture.ts";
import { withD01Database } from "../../../../apps/server/test/adapters/postgres/worlds/database.ts";
import { applyIdentityBasisMigrations } from "../../../../ops/migrations/run.ts";
import { configuration } from "../../worlds/commit/fixture.ts";
import { makeHttpProcessConfiguration } from "./http-process-configuration.ts";

const waitUntil = <E, R>(probe: Effect.Effect<boolean, E, R>) =>
  probe.pipe(
    Effect.repeat({
      schedule: Schedule.spaced("20 millis"),
      until: (done) => done,
    }),
    Effect.timeout("8 seconds")
  );
const d01 = { purpose: "personal-records", schemaVersion: "worlds.v1" };
const sharing = {
  purpose: "personal-records",
  schemaVersion: "d03.sharing.v1",
};
const path = "/api/worlds/execute";
const sharingPath = "/api/d03/sharing";
const post = Effect.fn("review.publicHttp")(function* post(
  origin: string,
  target: string,
  request: unknown,
  cookie?: Redacted.Redacted
) {
  const response = yield* HttpClientRequest.post(`${origin}${target}`).pipe(
    HttpClientRequest.setHeaders({
      origin,
      ...(cookie === undefined ? {} : { cookie: Redacted.value(cookie) }),
    }),
    HttpClientRequest.bodyJsonUnsafe(request),
    HttpClient.execute
  );
  const raw = yield* response.text;
  const body = yield* Schema.decodeEffect(
    Schema.fromJsonString(Schema.Unknown)
  )(raw);
  return {
    body,
    cookie: Redacted.make(Cookies.toCookieHeader(response.cookies)),
    headers: response.headers,
    raw,
    status: response.status,
  };
});

for (const intention of ["same", "distinct"] as const) {
  it.live(
    `independent SH05 two HTTP processes: ${intention} grant intentions and historical replay`,
    () =>
      withD01Database(
        (database) =>
          withStorage((storage) =>
            Effect.scoped(
              Effect.gen(function* concurrentGrants() {
                const fs = yield* FileSystem.FileSystem;
                const sql = yield* SqlClient.SqlClient;
                const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
                const installation = yield* AuthorityInstallation;
                const policy = yield* DataPolicy;
                yield* sdk((signal) =>
                  storage.client.send(
                    new PutBucketVersioningCommand({
                      Bucket: storage.config.bucket,
                      VersioningConfiguration: { Status: "Enabled" },
                    }),
                    { abortSignal: signal }
                  )
                );
                const directory = yield* fs.makeTempDirectoryScoped({
                  prefix: "zoen-disclosure-http-process-",
                });
                yield* fs.chmod(directory, 0o700);
                const secret = randomBytes(32).toString("hex");
                const spawn = Effect.fn("review.spawnHttp")(function* spawn(
                  name: string
                ) {
                  const file = `${directory}/${name}.json`;
                  const prefix = `${directory}/${name}`;
                  const config = yield* Schema.encodeEffect(
                    Schema.fromJsonString(
                      makeHttpProcessConfiguration(
                        AuthorityInstallationSchema,
                        DataPolicySchema
                      )
                    )
                  )({
                    authorityUrl: Redacted.value(database.urls.authority),
                    controlPrefix: prefix,
                    identityUrl: Redacted.value(database.urls.identity),
                    installation,
                    policy,
                    secret,
                    storage: {
                      accessKeyId: Redacted.value(
                        storage.config.credentials.accessKeyId
                      ),
                      bucket: storage.config.bucket,
                      endpoint: storage.config.endpoint.href,
                      secretAccessKey: Redacted.value(
                        storage.config.credentials.secretAccessKey
                      ),
                    },
                  });
                  yield* fs.writeFileString(file, config, { mode: 0o600 });
                  const child = yield* spawner.spawn(
                    ChildProcess.make(
                      process.execPath,
                      [
                        fileURLToPath(
                          new URL("http-process.ts", import.meta.url)
                        ),
                      ],
                      {
                        env: { ZOEN_DISCLOSURE_HTTP_CONFIG: file },
                        forceKillAfter: "500 millis",
                      }
                    )
                  );
                  yield* Effect.addFinalizer(() =>
                    fs
                      .writeFileString(`${prefix}.release`, "release\n", {
                        mode: 0o600,
                      })
                      .pipe(Effect.orDie)
                  );
                  yield* waitUntil(fs.exists(`${file}.ready`));
                  const ready = yield* fs.readFileString(`${file}.ready`).pipe(
                    Effect.flatMap(
                      Schema.decodeEffect(
                        Schema.fromJsonString(
                          Schema.Struct({
                            origin: Schema.String,
                            pid: Schema.Int,
                          })
                        )
                      )
                    )
                  );
                  return { ...ready, child, prefix };
                });
                const controller = yield* spawn("controller");
                const reader = yield* spawn("reader");
                expect(reader.pid).not.toBe(controller.pid);
                const signup = Effect.fn("review.signup")(function* signup(
                  name: string
                ) {
                  const response = yield* post(
                    controller.origin,
                    "/api/auth/sign-up/email",
                    {
                      email: `${randomUUID()}@example.test`,
                      name,
                      password: randomBytes(24).toString("base64url"),
                    }
                  );
                  expect(response.status).toBe(200);
                  const account = yield* Schema.decodeUnknownEffect(
                    Schema.Struct({
                      user: Schema.Struct({ id: PrincipalRef }),
                    })
                  )(response.body);
                  return {
                    cookie: response.cookie,
                    principal: account.user.id,
                  };
                });
                const owner = yield* signup("Process owner");
                const viewer = yield* signup("Process viewer");
                const createdResponse = yield* post(
                  controller.origin,
                  path,
                  {
                    ...d01,
                    input: {},
                    operation: "CreatePersonalWorld",
                    operationId: randomUUID(),
                  },
                  owner.cookie
                );
                expect(createdResponse.status).toBe(200);
                const { worldRef } = yield* Schema.decodeUnknownEffect(
                  WorldCreated
                )(createdResponse.body);

                const operationIds = [randomUUID(), randomUUID()];
                const requests = [0, 1].map((index) => ({
                  ...sharing,
                  input: {
                    expectedRevision: null,
                    principalRef: viewer.principal,
                  },
                  operation: "GrantWorldReadAccess",
                  operationId:
                    intention === "same"
                      ? operationIds[0]
                      : operationIds[index],
                  worldRef,
                }));
                const keys = [
                  ...new Set(
                    requests.map(
                      (request) =>
                        `operation:${worldRef.realm}:${worldRef.worldId}:${owner.principal}:${request.operation}:${request.operationId}`
                    )
                  ),
                ];
                const acquired = yield* Deferred.make<null>();
                const release = yield* Deferred.make<null>();
                // Hold only real production operation locks; no semantic state or result is injected.
                const blocker = yield* sql
                  .withTransaction(
                    Effect.gen(function* holdOperationLocks() {
                      for (const key of keys) {
                        yield* sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
                      }
                      yield* Deferred.succeed(acquired, null);
                      yield* Deferred.await(release);
                    })
                  )
                  .pipe(Effect.forkScoped);
                yield* Deferred.await(acquired);
                yield* Effect.addFinalizer(() =>
                  Deferred.succeed(release, null)
                );
                const snapshot = sql`SELECT
        (SELECT count(*)::int FROM authority.memberships WHERE world_id = ${worldRef.worldId} AND principal_id = ${viewer.principal}) AS memberships,
        (SELECT count(*)::int FROM authority.operations WHERE world_id = ${worldRef.worldId}) AS operations,
        (SELECT count(*)::int FROM authority.receipts WHERE world_id = ${worldRef.worldId}) AS receipts,
        (SELECT count(*)::int FROM jobs.outbox WHERE world_id = ${worldRef.worldId}) AS outbox,
        (SELECT version::text FROM authority.domains WHERE world_id = ${worldRef.worldId} AND domain_key = 'membership') AS version`;
                expect(yield* snapshot).toStrictEqual([
                  {
                    memberships: 0,
                    operations: 0,
                    outbox: 1,
                    receipts: 1,
                    version: "0",
                  },
                ]);
                const responses = yield* Effect.forEach(
                  [...requests],
                  (request, index) =>
                    post(
                      index === 0 ? controller.origin : reader.origin,
                      sharingPath,
                      request,
                      owner.cookie
                    ).pipe(Effect.forkScoped)
                );
                const waiters = Effect.forEach(
                  [...keys],
                  (key) => sql<{ pid: number }>`
        SELECT pid FROM pg_locks WHERE locktype = 'advisory' AND NOT granted AND mode = 'ExclusiveLock'
          AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
          AND classid::bigint = ((hashtextextended(${key}, 0) >> 32) & 4294967295)
          AND objid::bigint = (hashtextextended(${key}, 0) & 4294967295) AND objsubid = 1
      `
                ).pipe(Effect.map((rows) => rows.flat()));
                yield* waitUntil(
                  waiters.pipe(
                    Effect.map(
                      (rows) => new Set(rows.map((row) => row.pid)).size === 2
                    )
                  )
                );
                expect(yield* snapshot).toStrictEqual([
                  {
                    memberships: 0,
                    operations: 0,
                    outbox: 1,
                    receipts: 1,
                    version: "0",
                  },
                ]);
                yield* Deferred.succeed(release, null);
                yield* Fiber.join(blocker);
                const results = yield* Effect.forEach([...responses], (fiber) =>
                  Fiber.join(fiber)
                );
                expect(
                  results
                    .map((response) => response.status)
                    .toSorted((a, b) => a - b)
                ).toStrictEqual(intention === "same" ? [200, 200] : [200, 409]);
                const winnerIndex = results.findIndex(
                  (response) => response.status === 200
                );
                const winner = results[winnerIndex];
                const request = requests[winnerIndex];
                if (winner === undefined || request === undefined) {
                  throw new Error("Expected a public successful grant");
                }
                const granted = yield* Schema.decodeUnknownEffect(
                  WorldReadAccessGranted
                )(winner.body);
                expect(granted.membershipAtCommit).toStrictEqual({
                  principalRef: viewer.principal,
                  revision: "0",
                  role: "viewer",
                  state: "active",
                });
                if (intention === "same") {
                  expect(results[0]?.raw).toBe(results[1]?.raw);
                } else {
                  expect(
                    results.find((response) => response.status === 409)?.body
                  ).toStrictEqual({ _tag: "Stale", code: "STALE" });
                }
                expect(yield* snapshot).toStrictEqual([
                  {
                    memberships: 1,
                    operations: 1,
                    outbox: 2,
                    receipts: 2,
                    version: "1",
                  },
                ]);
                expect(
                  yield* sql`SELECT operation_id::text, receipt_id FROM authority.operations WHERE world_id = ${worldRef.worldId}`
                ).toStrictEqual([
                  {
                    operation_id: request.operationId,
                    receipt_id: granted.receiptRef,
                  },
                ]);
                expect(
                  yield* sql`SELECT receipt_id FROM authority.receipts WHERE world_id = ${worldRef.worldId} AND operation = 'GrantWorldReadAccess'`
                ).toStrictEqual([{ receipt_id: granted.receiptRef }]);
                expect(
                  yield* sql`SELECT receipt_id FROM jobs.outbox WHERE world_id = ${worldRef.worldId} AND receipt_id = ${granted.receiptRef}`
                ).toStrictEqual([{ receipt_id: granted.receiptRef }]);
                const revokedResponse = yield* post(
                  controller.origin,
                  sharingPath,
                  {
                    ...sharing,
                    input: {
                      expectedRevision: "0",
                      principalRef: viewer.principal,
                    },
                    operation: "RevokeWorldReadAccess",
                    operationId: randomUUID(),
                    worldRef,
                  },
                  owner.cookie
                );
                expect(revokedResponse.status).toBe(200);
                const revoked = yield* Schema.decodeUnknownEffect(
                  WorldReadAccessRevoked
                )(revokedResponse.body);
                expect(revoked.membershipAtCommit).toMatchObject({
                  revision: "1",
                  state: "revoked",
                });
                const afterRevoke = yield* snapshot;
                expect(afterRevoke).toStrictEqual([
                  {
                    memberships: 1,
                    operations: 2,
                    outbox: 3,
                    receipts: 3,
                    version: "2",
                  },
                ]);
                for (const server of [controller, reader]) {
                  const replay = yield* post(
                    server.origin,
                    sharingPath,
                    request,
                    owner.cookie
                  );
                  expect(replay.status).toBe(200);
                  expect(replay.raw).toBe(winner.raw);
                }
                expect(yield* snapshot).toStrictEqual(afterRevoke);
                expect(
                  yield* sql`SELECT state, revision::text FROM authority.memberships WHERE world_id = ${worldRef.worldId} AND principal_id = ${viewer.principal}`
                ).toStrictEqual([{ revision: "1", state: "revoked" }]);
                const inspected = yield* post(
                  reader.origin,
                  sharingPath,
                  {
                    ...sharing,
                    input: { principalRef: viewer.principal },
                    operation: "InspectWorldAccess",
                    worldRef,
                  },
                  owner.cookie
                );
                expect(inspected.status).toBe(200);
                expect(inspected.body).toMatchObject({
                  membership: revoked.membershipAtCommit,
                });
              })
            ).pipe(
              Effect.provide(
                Layer.mergeAll(
                  database.migration,
                  configuration,
                  NodeServices.layer,
                  FetchHttpClient.layer
                )
              )
            )
          ),
        undefined,
        (database) =>
          applyIdentityBasisMigrations(database.names).pipe(
            Effect.provide(
              Layer.mergeAll(database.migration, NodeServices.layer)
            )
          )
      )
  );
}
