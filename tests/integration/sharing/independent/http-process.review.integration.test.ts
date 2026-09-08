import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { PutBucketVersioningCommand } from "@aws-sdk/client-s3";
import { NodeServices } from "@effect/platform-node";
import { PgClient } from "@effect/sql-pg";
import { expect, it } from "@effect/vitest";
import {
  PrincipalRef,
  WorldReadAccessGranted,
  WorldReadAccessRevoked,
} from "@zoen/contracts/sharing/operations";
import {
  EvidenceImported,
  EvidenceOpened,
  FrameInspected,
  WorldCreated,
} from "@zoen/contracts/worlds/operations";
import {
  AuthorityInstallation,
  AuthorityInstallationSchema,
} from "@zoen/ontology/commit/configuration";
import {
  membershipDisclosureKey,
  sessionDisclosureKey,
} from "@zoen/ontology/ports/disclosure/keys";
import {
  DataPolicy,
  DataPolicySchema,
  PrincipalId,
  VerifiedPresence,
} from "@zoen/ontology/ports/worlds/context";
import {
  Config,
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
import { withWorldsDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.ts";
import { applyIdentityBasisMigrations } from "../../../../ops/migrations/run.ts";
import { configuration } from "../../worlds/commit/fixture.ts";
import { makeHttpProcessConfiguration } from "./http-process-configuration.ts";

const json = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const waitUntil = <E, R>(probe: Effect.Effect<boolean, E, R>) =>
  probe.pipe(
    Effect.repeat({
      schedule: Schedule.spaced("20 millis"),
      until: (done) => done,
    }),
    Effect.timeout("8 seconds")
  );
const worldsBasis = { purpose: "personal-records", schemaVersion: "worlds.v1" };
const sharing = {
  purpose: "personal-records",
  schemaVersion: "sharing.v1",
};
const path = "/api/worlds/execute";
const sharingPath = "/api/sharing/execute";
const document = json({
  records: [
    {
      externalId: "order-1",
      predicate: "obligation.amount",
      subjectKey: "order-1",
      validTime: { _tag: "DateInterval", from: "2026-09-01", to: "2026-10-01" },
      value: { _tag: "Known", amount: "42.25", currency: "BRL" },
    },
  ],
  schemaVersion: "worlds.v1",
  source: {
    externalId: "orders",
    label: "Private HTTP process bytes — ação",
    namespace: "process-review",
    revision: "1",
  },
});

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

for (const mode of ["open", "inspect", "retained"] as const) {
  for (const action of ["revoke", "logout"] as const) {
    for (const stage of ["before-shared", "before-end"] as const) {
      it.live(
        `independent SH07/08 two real HTTP processes: ${stage} orders public ${action} and ${mode} emission`,
        () =>
          withWorldsDatabase(
            (database) =>
              withStorage((storage) =>
                Effect.scoped(
                  Effect.gen(function* processOrdering() {
                    const fs = yield* FileSystem.FileSystem;
                    const sql = yield* SqlClient.SqlClient;
                    const spawner =
                      yield* ChildProcessSpawner.ChildProcessSpawner;
                    const installation = yield* AuthorityInstallation;
                    const policy = yield* DataPolicy;
                    const adminUrl = yield* Config.redacted(
                      "ZOEN_TEST_DATABASE_URL"
                    );
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
                      const ReadySchema = Schema.Struct({
                        origin: Schema.String,
                        pid: Schema.Int,
                      });
                      const readReady = fs
                        .readFileString(`${file}.ready`)
                        .pipe(
                          Effect.flatMap(
                            Schema.decodeEffect(
                              Schema.fromJsonString(ReadySchema)
                            )
                          )
                        );
                      yield* waitUntil(
                        readReady.pipe(
                          Effect.as(true),
                          Effect.orElseSucceed(() => false)
                        )
                      );
                      const ready = yield* readReady;
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
                        ...worldsBasis,
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
                    const importedResponse = yield* post(
                      controller.origin,
                      path,
                      {
                        ...worldsBasis,
                        input: { document },
                        operation: "ImportEvidence",
                        operationId: randomUUID(),
                        worldRef,
                      },
                      owner.cookie
                    );
                    expect(importedResponse.status).toBe(200);
                    const imported = yield* Schema.decodeUnknownEffect(
                      EvidenceImported
                    )(importedResponse.body);
                    const grantResponse = yield* post(
                      controller.origin,
                      sharingPath,
                      {
                        ...sharing,
                        input: {
                          expectedRevision: null,
                          principalRef: viewer.principal,
                        },
                        operation: "GrantWorldReadAccess",
                        operationId: randomUUID(),
                        worldRef,
                      },
                      owner.cookie
                    );
                    expect(grantResponse.status).toBe(200);
                    const grant = yield* Schema.decodeUnknownEffect(
                      WorldReadAccessGranted
                    )(grantResponse.body);
                    expect(grant.membershipAtCommit.revision).toBe("0");
                    const sessionResponse = yield* HttpClientRequest.get(
                      `${controller.origin}/api/auth/get-session`
                    ).pipe(
                      HttpClientRequest.setHeaders({
                        cookie: Redacted.value(viewer.cookie),
                        origin: controller.origin,
                      }),
                      HttpClient.execute
                    );
                    expect(sessionResponse.status).toBe(200);
                    const session = yield* sessionResponse.json.pipe(
                      Effect.flatMap(
                        Schema.decodeUnknownEffect(
                          Schema.Struct({
                            session: Schema.Struct({
                              createdAt: Schema.String,
                              expiresAt: Schema.String,
                              id: Schema.String.check(Schema.isUUID()),
                            }),
                          })
                        )
                      )
                    );
                    const presence = yield* Schema.decodeEffect(
                      VerifiedPresence
                    )({
                      authenticatedAt: session.session.createdAt,
                      expiresAt: session.session.expiresAt,
                      principalId: viewer.principal,
                      realm: "live",
                      sessionId: session.session.id,
                    });
                    const membershipKey = membershipDisclosureKey(
                      worldRef,
                      yield* Schema.decodeEffect(PrincipalId)(viewer.principal)
                    );
                    const key =
                      action === "revoke"
                        ? membershipKey
                        : sessionDisclosureKey(presence);
                    const pending = sql<{
                      count: number;
                    }>`SELECT count(*)::int AS count FROM jobs.disclosure_pending WHERE membership_key = ${membershipKey}`;
                    const sessionRows = sql`SELECT id FROM identity.session WHERE id = ${session.session.id}`;
                    const closingRows = sql`SELECT session_key FROM jobs.disclosure_session_closing WHERE session_key = ${sessionDisclosureKey(presence)}`;
                    expect(yield* sessionRows).toStrictEqual([
                      { id: session.session.id },
                    ]);
                    expect(yield* closingRows).toStrictEqual([]);
                    const locks = sql<{
                      granted: boolean;
                      mode: string;
                      pid: number;
                    }>`SELECT granted, mode, pid FROM pg_locks WHERE locktype = 'advisory' AND database = (SELECT oid FROM pg_database WHERE datname = current_database()) AND classid::bigint = ((hashtextextended(${key}, 0) >> 32) & 4294967295) AND objid::bigint = (hashtextextended(${key}, 0) & 4294967295) AND objsubid = 1 ORDER BY pid, mode`;
                    const reference =
                      mode === "open"
                        ? null
                        : yield* post(
                            controller.origin,
                            path,
                            {
                              ...worldsBasis,
                              input: { atFrame: null, subjectKey: "order-1" },
                              operation: "Inspect",
                              worldRef,
                            },
                            viewer.cookie
                          ).pipe(
                            Effect.flatMap((response) => {
                              expect(response.status).toBe(200);
                              return Schema.decodeUnknownEffect(FrameInspected)(
                                response.body
                              );
                            })
                          );
                    // Finish the real reference Frame's permit before arming either observer.
                    yield* waitUntil(
                      pending.pipe(Effect.map((rows) => rows[0]?.count === 0))
                    );
                    const mutationState = sql`SELECT (SELECT state FROM authority.memberships WHERE world_id = ${worldRef.worldId} AND principal_id = ${viewer.principal}) AS state, (SELECT revision::text FROM authority.memberships WHERE world_id = ${worldRef.worldId} AND principal_id = ${viewer.principal}) AS revision, (SELECT count(*)::int FROM authority.receipts) AS receipts, (SELECT count(*)::int FROM authority.operations) AS operations, (SELECT count(*)::int FROM jobs.outbox) AS outbox`;
                    const before = yield* mutationState;
                    expect(before[0]).toMatchObject({
                      revision: "0",
                      state: "active",
                    });
                    const readRequest =
                      mode === "open"
                        ? {
                            ...worldsBasis,
                            input: { evidenceRef: imported.evidenceRef },
                            operation: "OpenEvidence",
                            worldRef,
                          }
                        : {
                            ...worldsBasis,
                            input: {
                              atFrame:
                                mode === "retained"
                                  ? reference?.frame.frameRef
                                  : null,
                              subjectKey: "order-1",
                            },
                            operation: "Inspect",
                            worldRef,
                          };
                    const revokeRequest = {
                      ...sharing,
                      input: {
                        expectedRevision: "0",
                        principalRef: viewer.principal,
                      },
                      operation: "RevokeWorldReadAccess",
                      operationId: randomUUID(),
                      worldRef,
                    };
                    const revoke = () =>
                      action === "revoke"
                        ? post(
                            controller.origin,
                            sharingPath,
                            revokeRequest,
                            owner.cookie
                          )
                        : post(
                            controller.origin,
                            "/api/auth/sign-out",
                            {},
                            viewer.cookie
                          );
                    const verifyRevoked = Effect.fn("review.confirmRevoked")(
                      function* verifyRevoked(body: unknown) {
                        if (action === "revoke") {
                          const receipt = yield* Schema.decodeUnknownEffect(
                            WorldReadAccessRevoked
                          )(body);
                          expect(receipt.membershipAtCommit).toMatchObject({
                            revision: "1",
                            state: "revoked",
                          });
                        } else {
                          expect(yield* sessionRows).toStrictEqual([]);
                          expect(yield* closingRows).toStrictEqual([
                            { session_key: key },
                          ]);
                          expect(yield* mutationState).toStrictEqual(before);
                        }
                      }
                    );
                    yield* fs.writeFileString(
                      `${reader.prefix}.arm`,
                      json({ key, kind: stage }),
                      { mode: 0o600 }
                    );
                    const reading = yield* post(
                      reader.origin,
                      path,
                      readRequest,
                      viewer.cookie
                    ).pipe(Effect.forkScoped);
                    yield* waitUntil(fs.exists(`${reader.prefix}.reached`));
                    expect(
                      yield* fs.exists(`${reader.prefix}.submitted`)
                    ).toBeFalsy();

                    if (stage === "before-shared") {
                      expect(yield* pending).toStrictEqual([{ count: 0 }]);
                      const revoked = yield* revoke();
                      expect(revoked.status).toBe(200);
                      yield* verifyRevoked(revoked.body);
                      yield* fs.writeFileString(
                        `${reader.prefix}.release`,
                        "release\n",
                        { mode: 0o600 }
                      );
                      const response = yield* Fiber.join(reading);
                      expect(response.status).toBe(
                        action === "revoke" ? 404 : 503
                      );
                      expect(response.body).toStrictEqual(
                        action === "revoke"
                          ? {
                              _tag: "NotFoundOrDenied",
                              code: "NOT_FOUND_OR_DENIED",
                            }
                          : { _tag: "Unavailable", code: "UNAVAILABLE" }
                      );
                      expect(response.raw).not.toContain(document);
                      yield* waitUntil(
                        pending.pipe(Effect.map((rows) => rows[0]?.count === 0))
                      );
                    } else {
                      expect(yield* pending).toStrictEqual([{ count: 1 }]);
                      if (action === "logout") {
                        yield* fs.writeFileString(
                          `${controller.prefix}.arm`,
                          json({ key, kind: "observe-exclusive" }),
                          { mode: 0o600 }
                        );
                      }
                      const revoking = yield* revoke().pipe(Effect.forkScoped);
                      // Membership uses a blocking X; logout uses a real try-X retry loop.
                      yield* action === "revoke"
                        ? waitUntil(
                            locks.pipe(
                              Effect.map((rows) =>
                                rows.some(
                                  (row) =>
                                    row.mode === "ExclusiveLock" && !row.granted
                                )
                              )
                            )
                          )
                        : waitUntil(
                            fs.exists(`${controller.prefix}.exclusive-waiting`)
                          );
                      expect(yield* mutationState).toStrictEqual(before);
                      const holders = (yield* locks).filter(
                        (row) => row.mode === "ShareLock" && row.granted
                      );
                      expect(holders).toHaveLength(1);
                      const [holder] = holders;
                      if (holder === undefined) {
                        throw new Error(
                          "Expected one physical reader lock holder"
                        );
                      }
                      // Administrative fault injection kills the observed lock holder, never a product authorization path.
                      expect(
                        yield* SqlClient.SqlClient.use(
                          (admin) =>
                            admin`SELECT pg_terminate_backend(${holder.pid}) AS killed`
                        ).pipe(
                          Effect.provide(
                            PgClient.layer({ maxConnections: 1, url: adminUrl })
                          )
                        )
                      ).toStrictEqual([{ killed: true }]);
                      const refused = yield* Fiber.join(revoking).pipe(
                        Effect.timeout("8 seconds")
                      );
                      expect(refused.status).toBe(503);
                      // Sign-out retains its existing provider-adapter envelope (EX09); semantic routes carry _tag.
                      expect(refused.body).toStrictEqual(
                        action === "revoke"
                          ? {
                              _tag: "Unavailable",
                              code: "UNAVAILABLE",
                            }
                          : { code: "UNAVAILABLE" }
                      );
                      expect(yield* pending).toStrictEqual([{ count: 1 }]);
                      expect(yield* mutationState).toStrictEqual(before);
                      expect(yield* sessionRows).toStrictEqual([
                        { id: session.session.id },
                      ]);
                      expect(yield* closingRows).toStrictEqual([]);
                      expect(
                        yield* fs.exists(`${reader.prefix}.submitted`)
                      ).toBeFalsy();
                      yield* fs.writeFileString(
                        `${reader.prefix}.release`,
                        "release\n",
                        { mode: 0o600 }
                      );
                      const response = yield* Fiber.join(reading);
                      expect(response.status).toBe(200);
                      if (mode === "open") {
                        const opened = yield* Schema.decodeUnknownEffect(
                          EvidenceOpened
                        )(response.body);
                        expect(opened.document).toBe(document);
                      } else {
                        if (reference === null) {
                          throw new Error(
                            "Inspect ordering requires its real viewer reference Frame"
                          );
                        }
                        const inspected = yield* Schema.decodeUnknownEffect(
                          FrameInspected
                        )(response.body);
                        if (mode === "retained") {
                          expect(inspected).toStrictEqual(reference);
                        } else {
                          const { frameRef: priorRef, ...prior } =
                            reference.frame;
                          const { frameRef: currentRef, ...current } =
                            inspected.frame;
                          expect(current).toStrictEqual(prior);
                          expect(currentRef).not.toBe(priorRef);
                        }
                        expect(
                          yield* sql`SELECT principal_id FROM authority.frames WHERE world_id = ${worldRef.worldId} AND realm = ${worldRef.realm} AND frame_id = ${inspected.frame.frameRef}`
                        ).toStrictEqual([{ principal_id: viewer.principal }]);
                      }
                      expect(response.headers["cache-control"]).toBe(
                        "no-store"
                      );
                      expect(response.headers["x-content-type-options"]).toBe(
                        "nosniff"
                      );
                      expect(Number(response.headers["content-length"])).toBe(
                        new TextEncoder().encode(response.raw).byteLength
                      );
                      expect(
                        (yield* fs.readFileString(`${reader.prefix}.submitted`))
                          .trim()
                          .split("\n")
                      ).toHaveLength(1);
                      // The unchanged assertion deliberately catches ACK suppression after the owner's interruption.
                      yield* waitUntil(
                        pending.pipe(Effect.map((rows) => rows[0]?.count === 0))
                      );
                      const retry = yield* revoke();
                      expect(retry.status).toBe(200);
                      yield* verifyRevoked(retry.body);
                      const denied = yield* post(
                        reader.origin,
                        path,
                        readRequest,
                        viewer.cookie
                      );
                      expect(denied.status).toBe(
                        action === "revoke" ? 404 : 401
                      );
                      expect(denied.body).toStrictEqual(
                        action === "revoke"
                          ? {
                              _tag: "NotFoundOrDenied",
                              code: "NOT_FOUND_OR_DENIED",
                            }
                          : {
                              _tag: "Unauthenticated",
                              code: "PRESENCE_REQUIRED",
                            }
                      );
                    }
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
  }
}
