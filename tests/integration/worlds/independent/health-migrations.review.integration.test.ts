import { randomBytes } from "node:crypto";

import { PutBucketVersioningCommand } from "@aws-sdk/client-s3";
import { NodeHttpServer, NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { AuthorityInstallation } from "@zoen/authority/commit/configuration";
import { DataPolicy } from "@zoen/authority/ports/worlds/context";
import { Effect, Layer, Redacted } from "effect";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import { SqlClient } from "effect/unstable/sql";

import { S3Health } from "../../../../apps/server/src/adapters/object-storage/worlds/health.ts";
import { layer } from "../../../../apps/server/src/adapters/object-storage/worlds/s3.ts";
import { makeApplication } from "../../../../apps/server/src/composition.ts";
import {
  sdk,
  withStorage,
} from "../../../../apps/server/test/adapters/object-storage/worlds/fixture.ts";
import { withWorldsDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.ts";
import {
  http,
  jsonBody,
  withWorldsHttp,
} from "../../../../apps/server/test/composition/worlds/fixture.ts";
import { applyWorldsBaselineMigrations } from "../../../../ops/migrations/run.ts";
import { configuration } from "../commit/fixture.ts";

it.live(
  "independent EX10 readiness observes loss of authority write rights on the live pool",
  () =>
    withWorldsHttp(({ database, origin }) =>
      Effect.gen(function* revokedAuthorityGrant() {
        const ready = yield* http(origin, "/ready");
        expect(ready.status).toBe(200);
        yield* SqlClient.SqlClient.use(
          (sql) =>
            sql`REVOKE INSERT ON authority.worlds FROM ${sql(database.names.authority)}`
        ).pipe(Effect.provide(database.migration));
        const unavailable = yield* http(origin, "/ready");
        expect({
          body: yield* jsonBody(unavailable),
          status: unavailable.status,
        }).toStrictEqual({ body: { status: "unavailable" }, status: 503 });
      })
    )
);

it.live(
  "independent EX10 health rejects an unversioned or suspended real bucket and accepts enabled versioning",
  () =>
    withStorage(({ client, config }) =>
      Effect.gen(function* versionedHealth() {
        const health = yield* S3Health;
        expect(yield* health.check.pipe(Effect.result)).toMatchObject({
          _tag: "Failure",
          failure: { _tag: "StorageFailure", reason: "Unavailable" },
        });
        yield* sdk((signal) =>
          client.send(
            new PutBucketVersioningCommand({
              Bucket: config.bucket,
              VersioningConfiguration: { Status: "Enabled" },
            }),
            { abortSignal: signal }
          )
        );
        expect(yield* health.check.pipe(Effect.result)).toMatchObject({
          _tag: "Success",
        });
        yield* sdk((signal) =>
          client.send(
            new PutBucketVersioningCommand({
              Bucket: config.bucket,
              VersioningConfiguration: { Status: "Suspended" },
            }),
            { abortSignal: signal }
          )
        );
        expect(yield* health.check.pipe(Effect.result)).toMatchObject({
          _tag: "Failure",
          failure: { _tag: "StorageFailure", reason: "Unavailable" },
        });
      }).pipe(Effect.provide(layer(config)))
    )
);

it.live(
  "independent EX10 rejects identity credentials supplied to the authority pool before serving the application",
  () =>
    withWorldsDatabase(
      (database) =>
        withStorage(({ client, config: storage }) =>
          Effect.gen(function* authorityRoleAdmission() {
            yield* sdk((signal) =>
              client.send(
                new PutBucketVersioningCommand({
                  Bucket: storage.bucket,
                  VersioningConfiguration: { Status: "Enabled" },
                }),
                { abortSignal: signal }
              )
            );
            const server = yield* HttpServer.HttpServer;
            if (server.address._tag !== "TcpAddress") {
              throw new Error("Review requires a real TCP listener");
            }
            const origin = `http://127.0.0.1:${server.address.port}`;
            const application = makeApplication({
              authorityDatabaseUrl: database.urls.identity,
              identity: {
                baseUrl: origin,
                databaseUrl: database.urls.identity,
                secret: Redacted.make(randomBytes(32).toString("hex")),
                sessionSeconds: 3600,
              },
              installation: yield* AuthorityInstallation,
              policy: yield* DataPolicy,
              storage,
            });
            const outcome = yield* Layer.build(
              HttpRouter.serve(application, {
                disableListenLog: true,
                disableLogger: true,
              })
            ).pipe(Effect.result);
            expect(outcome).toMatchObject({ _tag: "Failure" });
          }).pipe(
            Effect.provide(
              Layer.mergeAll(configuration, NodeHttpServer.layerTest)
            )
          )
        ),
      undefined,
      (database) =>
        applyWorldsBaselineMigrations(database.names).pipe(
          Effect.provide(Layer.mergeAll(database.migration, NodeServices.layer))
        )
    )
);

it.live(
  "independent EX10 numbered migrations replay without duplication and preserve runtime role separation",
  () =>
    withWorldsDatabase(
      (database) =>
        Effect.gen(function* migrationReplay() {
          const repeat = yield* applyWorldsBaselineMigrations(
            database.names
          ).pipe(
            Effect.provide(
              Layer.mergeAll(database.migration, NodeServices.layer)
            )
          );
          expect(repeat).toStrictEqual([]);
          const metadata = yield* SqlClient.SqlClient.use(
            (sql) =>
              sql`SELECT migration_id, name FROM public.effect_sql_migrations ORDER BY migration_id`
          ).pipe(Effect.provide(database.migration));
          expect(metadata).toStrictEqual([
            { migration_id: 1, name: "authority" },
            { migration_id: 2, name: "identity" },
            { migration_id: 3, name: "scoped_corrections" },
          ]);
          const authority = yield* SqlClient.SqlClient.use(
            (sql) =>
              sql`SELECT has_schema_privilege(current_user, 'identity', 'USAGE') AS identity_access, has_table_privilege(current_user, 'authority.worlds', 'INSERT') AS create_world, has_database_privilege(current_user, current_database(), 'TEMPORARY') AS temporary`
          ).pipe(Effect.provide(database.authority));
          expect(authority).toStrictEqual([
            { create_world: true, identity_access: false, temporary: false },
          ]);
          const identity = yield* SqlClient.SqlClient.use(
            (sql) =>
              sql`SELECT has_schema_privilege(current_user, 'authority', 'USAGE') AS authority_access, has_table_privilege(current_user, 'identity."user"', 'INSERT') AS create_user, has_database_privilege(current_user, current_database(), 'TEMPORARY') AS temporary`
          ).pipe(Effect.provide(database.identity));
          expect(identity).toStrictEqual([
            { authority_access: false, create_user: true, temporary: false },
          ]);
        }),
      undefined,
      (database) =>
        applyWorldsBaselineMigrations(database.names).pipe(
          Effect.provide(Layer.mergeAll(database.migration, NodeServices.layer))
        )
    )
);
