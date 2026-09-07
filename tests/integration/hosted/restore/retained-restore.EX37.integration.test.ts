import { randomUUID } from "node:crypto";

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { NodeServices } from "@effect/platform-node";
import { PgClient } from "@effect/sql-pg";
import { expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import type { Redacted } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { grantWorldsRoles } from "../../../../apps/server/sql/proposals/worlds/grants.js";
import { withStorage } from "../../../../apps/server/test/adapters/object-storage/worlds/fixture.js";
import { withWorldsDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.js";
import { authorizeWorld } from "../../../../packages/authority/src/access/world.js";
import { createPersonalWorld } from "../../../../packages/authority/src/commit/genesis.js";
import { HostedRetainedDataPolicySchema } from "../../../../packages/authority/src/ports/worlds/context.js";
import {
  DisposableRestoreFailure,
  roleUrlForDatabase,
  withLogicalDumpRestore,
} from "./dump-restore.js";
import {
  hostedConfiguration,
  hostedRetainedPolicy,
  localRetainedConfiguration,
  localRetainedPolicy,
  makeContext,
  makeCreateWorld,
} from "./fixture.js";

const requireDefined = <A>(value: A | undefined, detail: string): A => {
  if (value === undefined) {
    throw new DisposableRestoreFailure({ detail });
  }
  return value;
};

const MarkerSchema = Schema.Struct({
  profileId: Schema.Literal("d04-hosted-retained-v1"),
  restoreAfterErasure: Schema.Literal(false),
  worldId: Schema.String,
});

const adminLayer = (url: Redacted.Redacted) =>
  PgClient.layer({
    applicationName: "zoen-ex37-restore-admin",
    maxConnections: 2,
    url,
  });

/** Restored disposable targets skip the production runtime privilege gate. */
const authorityOn = (url: Redacted.Redacted) =>
  PgClient.layer({
    applicationName: "zoen-ex37-restore-authority",
    maxConnections: 4,
    url,
  });

const s3Send = <A>(run: (signal: AbortSignal) => Promise<A>) =>
  Effect.tryPromise({
    catch: (cause) =>
      new DisposableRestoreFailure({
        detail: `S3 failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      }),
    try: run,
  });

it.live(
  "EX37 disposable dump→restore reproduces hosted-retained World install only under enabled scope",
  () =>
    withWorldsDatabase((database) =>
      Effect.gen(function* hostedRoundTrip() {
        const context = yield* makeContext();
        const request = yield* makeCreateWorld();
        const created = yield* createPersonalWorld(context, request);

        const sql = yield* SqlClient.SqlClient;
        const before = yield* sql`
          SELECT world_id::text AS world_id, data_policy_id
          FROM authority.worlds
          WHERE world_id = ${created.worldRef.worldId}
        `;
        expect(before).toStrictEqual([
          {
            data_policy_id: "d04-hosted-retained-v1",
            world_id: created.worldRef.worldId,
          },
        ]);

        expect(hostedRetainedPolicy.erasure).toBeFalsy();
        expect(hostedRetainedPolicy.restoreAfterErasure).toBeFalsy();
        expect(
          Schema.is(HostedRetainedDataPolicySchema)(hostedRetainedPolicy)
        ).toBeTruthy();

        yield* withLogicalDumpRestore(database.urls.migration, (restored) =>
          Effect.gen(function* verifyTarget() {
            yield* grantWorldsRoles({
              authority: database.names.authority,
              identity: database.names.identity,
              progress: database.names.progress,
            }).pipe(Effect.provide(adminLayer(restored.targetAdminUrl)));

            const targetAuthority = authorityOn(
              roleUrlForDatabase(
                database.urls.authority,
                restored.targetDatabase
              )
            );

            const rows = yield* Effect.gen(function* readRestored() {
              const targetSql = yield* SqlClient.SqlClient;
              return yield* targetSql`
                SELECT world_id::text AS world_id, data_policy_id, realm
                FROM authority.worlds
                WHERE world_id = ${created.worldRef.worldId}
              `;
            }).pipe(Effect.provide(targetAuthority));
            expect(rows).toStrictEqual([
              {
                data_policy_id: "d04-hosted-retained-v1",
                realm: "live",
                world_id: created.worldRef.worldId,
              },
            ]);

            const access = yield* authorizeWorld(
              context,
              created.worldRef,
              "read"
            ).pipe(
              Effect.provide(
                Layer.mergeAll(hostedConfiguration, targetAuthority)
              )
            );
            expect(access.data_policy_id).toBe("d04-hosted-retained-v1");
            expect(access.role).toBe("owner");

            const blocked = yield* authorizeWorld(
              context,
              created.worldRef,
              "read"
            ).pipe(
              Effect.flip,
              Effect.provide(
                Layer.mergeAll(localRetainedConfiguration, targetAuthority)
              )
            );
            expect(blocked).toMatchObject({
              _tag: "Blocked",
              code: "PROFILE_BLOCKED",
            });

            expect(hostedRetainedPolicy.restoreAfterErasure).toBeFalsy();
          })
        );
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            hostedConfiguration,
            database.authority,
            NodeServices.layer
          )
        )
      )
    )
);

it.live(
  "EX37 scoped restore excludes local-retained World content outside enabled hosted scope",
  () =>
    withWorldsDatabase((source) =>
      Effect.gen(function* scopedRestore() {
        const hostedCtx = yield* makeContext();
        const localCtx = yield* makeContext();
        const hostedWorld = yield* createPersonalWorld(
          hostedCtx,
          yield* makeCreateWorld()
        ).pipe(
          Effect.provide(Layer.mergeAll(hostedConfiguration, source.authority))
        );
        const localWorld = yield* createPersonalWorld(
          localCtx,
          yield* makeCreateWorld()
        ).pipe(
          Effect.provide(
            Layer.mergeAll(localRetainedConfiguration, source.authority)
          )
        );

        const sql = yield* SqlClient.SqlClient;
        const policies = yield* sql`
          SELECT data_policy_id, count(*)::int AS count
          FROM authority.worlds
          GROUP BY data_policy_id
          ORDER BY data_policy_id
        `;
        expect(policies).toStrictEqual([
          { count: 1, data_policy_id: "d04-hosted-retained-v1" },
          { count: 1, data_policy_id: "worlds-local-retained-v1" },
        ]);

        const world = requireDefined(
          (yield* sql`
          SELECT world_id::text AS world_id, realm, cell_id::text AS cell_id,
            cell_epoch::text AS cell_epoch, release_digest,
            generation_id::text AS generation_id,
            security_revision::text AS security_revision,
            emergency_deny, data_policy_id, created_at::text AS created_at
          FROM authority.worlds
          WHERE world_id = ${hostedWorld.worldRef.worldId}
        `)[0],
          "hosted World row missing before scoped restore"
        );
        expect(world.data_policy_id).toBe("d04-hosted-retained-v1");

        const membership = requireDefined(
          (yield* sql`
          SELECT world_id::text AS world_id, realm, principal_id::text AS principal_id,
            state, revision::text AS revision, role
          FROM authority.memberships
          WHERE world_id = ${hostedWorld.worldRef.worldId}
        `)[0],
          "hosted membership row missing before scoped restore"
        );
        const domains = yield* sql`
          SELECT world_id::text AS world_id, realm, domain_key, version::text AS version
          FROM authority.domains
          WHERE world_id = ${hostedWorld.worldRef.worldId}
          ORDER BY domain_key
        `;

        yield* withWorldsDatabase((target) =>
          Effect.gen(function* copyHostedScope() {
            const admin = yield* SqlClient.SqlClient;
            yield* admin.unsafe(`
              TRUNCATE jobs.outbox, authority.bootstrap_operations, authority.receipts,
                authority.domains, authority.memberships, authority.worlds CASCADE
            `);

            yield* admin`
              INSERT INTO authority.worlds
                (world_id, realm, cell_id, cell_epoch, release_digest, generation_id,
                 security_revision, emergency_deny, data_policy_id, created_at)
              VALUES (
                ${world.world_id}::uuid, ${world.realm}, ${world.cell_id}::uuid,
                ${world.cell_epoch}::bigint, ${world.release_digest},
                ${world.generation_id}::uuid, ${world.security_revision}::bigint,
                ${world.emergency_deny}, ${world.data_policy_id},
                ${world.created_at}::timestamptz
              )
            `;
            yield* admin`
              INSERT INTO authority.memberships
                (world_id, realm, principal_id, state, revision, role)
              VALUES (
                ${membership.world_id}::uuid, ${membership.realm},
                ${membership.principal_id}::uuid, ${membership.state},
                ${membership.revision}::bigint, ${membership.role}
              )
            `;
            for (const domain of domains) {
              yield* admin`
                INSERT INTO authority.domains (world_id, realm, domain_key, version)
                VALUES (
                  ${domain.world_id}::uuid, ${domain.realm}, ${domain.domain_key},
                  ${domain.version}::bigint
                )
              `;
            }

            const restored = yield* admin`
              SELECT world_id::text AS world_id, data_policy_id
              FROM authority.worlds
              ORDER BY data_policy_id
            `;
            expect(restored).toStrictEqual([
              {
                data_policy_id: "d04-hosted-retained-v1",
                world_id: hostedWorld.worldRef.worldId,
              },
            ]);

            const leaked = yield* admin`
              SELECT count(*)::int AS count FROM authority.worlds
              WHERE world_id = ${localWorld.worldRef.worldId}
                 OR data_policy_id = ${localRetainedPolicy.profileId}
            `;
            expect(leaked).toStrictEqual([{ count: 0 }]);

            const access = yield* authorizeWorld(
              hostedCtx,
              hostedWorld.worldRef,
              "read"
            ).pipe(
              Effect.provide(
                Layer.mergeAll(hostedConfiguration, target.authority)
              )
            );
            expect(access.data_policy_id).toBe("d04-hosted-retained-v1");
          }).pipe(Effect.provide(target.migration))
        );
      }).pipe(Effect.provide(source.authority))
    )
);

it.live(
  "EX37 disposable S3 object round-trip under hosted-retained World key (no Fly/Tigris)",
  () =>
    withStorage((storage) =>
      Effect.gen(function* objectRoundTrip() {
        const worldId = randomUUID();
        const key = `hosted-retained/${worldId}/marker.json`;
        const bodyJson = yield* Schema.encodeEffect(
          Schema.fromJsonString(MarkerSchema)
        )({
          profileId: "d04-hosted-retained-v1",
          restoreAfterErasure: false,
          worldId,
        }).pipe(
          Effect.mapError(
            (cause) =>
              new DisposableRestoreFailure({
                detail: `marker encode failed: ${String(cause)}`,
              })
          )
        );
        const body = Buffer.from(bodyJson, "utf-8");

        yield* s3Send((signal) =>
          storage.client.send(
            new PutObjectCommand({
              Body: body,
              Bucket: storage.config.bucket,
              ContentType: "application/json",
              Key: key,
            }),
            { abortSignal: signal }
          )
        );

        const backupKey = `hosted-retained-backup/${worldId}/marker.json`;
        yield* s3Send((signal) =>
          storage.client.send(
            new CopyObjectCommand({
              Bucket: storage.config.bucket,
              CopySource: `${storage.config.bucket}/${key}`,
              Key: backupKey,
            }),
            { abortSignal: signal }
          )
        );

        yield* s3Send((signal) =>
          storage.client.send(
            new DeleteObjectCommand({
              Bucket: storage.config.bucket,
              Key: key,
            }),
            { abortSignal: signal }
          )
        );

        yield* s3Send((signal) =>
          storage.client.send(
            new CopyObjectCommand({
              Bucket: storage.config.bucket,
              CopySource: `${storage.config.bucket}/${backupKey}`,
              Key: key,
            }),
            { abortSignal: signal }
          )
        );

        const got = yield* s3Send((signal) =>
          storage.client.send(
            new GetObjectCommand({
              Bucket: storage.config.bucket,
              Key: key,
            }),
            { abortSignal: signal }
          )
        );
        const bodyStream = requireDefined(
          got.Body,
          "S3 get returned empty body"
        );
        const bytes = Buffer.from(
          yield* s3Send(() => bodyStream.transformToByteArray())
        );
        expect(bytes.equals(body)).toBeTruthy();
        const restoredMarker = yield* Schema.decodeEffect(
          Schema.fromJsonString(MarkerSchema)
        )(bytes.toString("utf-8")).pipe(
          Effect.mapError(
            (cause) =>
              new DisposableRestoreFailure({
                detail: `marker decode failed: ${String(cause)}`,
              })
          )
        );
        expect(restoredMarker.restoreAfterErasure).toBeFalsy();

        const missing = yield* Effect.exit(
          s3Send((signal) =>
            storage.client.send(
              new GetObjectCommand({
                Bucket: storage.config.bucket,
                Key: `local-retained/${worldId}/should-not-exist.json`,
              }),
              { abortSignal: signal }
            )
          )
        );
        expect(missing._tag).toBe("Failure");
      })
    )
);
