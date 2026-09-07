import { randomUUID } from "node:crypto";

import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  ListObjectVersionsCommand,
  PutBucketVersioningCommand,
  PutObjectCommand,
  PutObjectLegalHoldCommand,
  PutObjectRetentionCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { expect, it } from "@effect/vitest";
import { ErasureObjectInventory } from "@zoen/authority/ports/erasure/inventory";
import { ErasurePurgeStore } from "@zoen/authority/ports/erasure/purge";
import { StorageFailure } from "@zoen/authority/ports/worlds/storage";
import { WorldId, WorldRef } from "@zoen/contracts/worlds/values";
import { Config, Effect, Redacted, Schema } from "effect";
import type { Scope } from "effect";

import {
  worldObjectInventoryPrefixes,
  worldObjectPrefix,
} from "../../../../src/adapters/object-storage/erasure/prefix.js";
import { layer as erasureStorageLayer } from "../../../../src/adapters/object-storage/erasure/s3.js";
import type { S3EvidenceConfig } from "../../../../src/adapters/object-storage/worlds/config.js";

const sdk = <A>(run: (signal: AbortSignal) => Promise<A>) =>
  Effect.tryPromise({
    catch: () => new StorageFailure({ reason: "Unavailable" }),
    try: run,
  });

interface Fixture {
  readonly client: S3Client;
  readonly config: S3EvidenceConfig;
  readonly worldRef: WorldRef;
}

const withErasureStorage = <A, E, R = never>(
  run: (
    fixture: Fixture
  ) => Effect.Effect<
    A,
    E,
    R | ErasureObjectInventory | ErasurePurgeStore | Scope.Scope
  >
) =>
  Effect.scoped(
    Effect.gen(function* storageFixture() {
      const endpoint = yield* Config.url("ZOEN_TEST_S3_ENDPOINT");
      const accessKeyId = yield* Config.redacted("ZOEN_TEST_S3_ACCESS_KEY");
      const secretAccessKey = yield* Config.redacted("ZOEN_TEST_S3_SECRET_KEY");
      const config: S3EvidenceConfig = {
        bucket: `zoen-ex44-${randomUUID()}`,
        connectionTimeoutMillis: 3000,
        credentials: { accessKeyId, secretAccessKey },
        endpoint,
        forcePathStyle: true,
        realm: "live",
        region: "us-east-1",
        requestTimeoutMillis: 10_000,
      };
      const worldRef = Schema.decodeSync(WorldRef)({
        realm: "live",
        worldId: randomUUID(),
      });
      const client = yield* Effect.acquireRelease(
        Effect.sync(
          () =>
            new S3Client({
              credentials: {
                accessKeyId: Redacted.value(accessKeyId),
                secretAccessKey: Redacted.value(secretAccessKey),
              },
              endpoint: endpoint.href,
              forcePathStyle: true,
              maxAttempts: 1,
              region: "us-east-1",
              requestHandler: {
                connectionTimeout: 3000,
                requestTimeout: 10_000,
              },
            })
        ),
        (resource) =>
          Effect.sync(() => {
            resource.destroy();
          })
      );
      yield* sdk((signal) =>
        client.send(
          new CreateBucketCommand({
            Bucket: config.bucket,
            ObjectLockEnabledForBucket: true,
          }),
          { abortSignal: signal }
        )
      );
      yield* sdk((signal) =>
        client.send(
          new PutBucketVersioningCommand({
            Bucket: config.bucket,
            VersioningConfiguration: { Status: "Enabled" },
          }),
          { abortSignal: signal }
        )
      );
      return yield* Effect.acquireUseRelease(
        Effect.succeed(null),
        () =>
          run({ client, config, worldRef }).pipe(
            Effect.provide(erasureStorageLayer(config))
          ),
        () =>
          Effect.gen(function* removeOnlyFixtureBucket() {
            const listing = yield* sdk((signal) =>
              client.send(
                new ListObjectVersionsCommand({ Bucket: config.bucket }),
                { abortSignal: signal }
              )
            );
            for (const object of [
              ...(listing.Versions ?? []),
              ...(listing.DeleteMarkers ?? []),
            ]) {
              if (object.Key === undefined || object.VersionId === undefined) {
                continue;
              }
              const key = object.Key;
              const versionId = object.VersionId;
              // Cleanup only: clear hold then bypass governance. Not product path.
              if (object.IsLatest !== undefined) {
                yield* sdk((signal) =>
                  client.send(
                    new PutObjectLegalHoldCommand({
                      Bucket: config.bucket,
                      Key: key,
                      LegalHold: { Status: "OFF" },
                      VersionId: versionId,
                    }),
                    { abortSignal: signal }
                  )
                ).pipe(Effect.ignore);
              }
              yield* sdk((signal) =>
                client.send(
                  new DeleteObjectCommand({
                    Bucket: config.bucket,
                    BypassGovernanceRetention: true,
                    Key: key,
                    VersionId: versionId,
                  }),
                  { abortSignal: signal }
                )
              ).pipe(Effect.ignore);
            }
            yield* sdk((signal) =>
              client.send(new DeleteBucketCommand({ Bucket: config.bucket }), {
                abortSignal: signal,
              })
            ).pipe(Effect.ignore);
          }).pipe(Effect.ignore)
      );
    })
  );

const requireVersionId = (versionId: string | undefined) =>
  Effect.fromNullishOr(versionId).pipe(
    Effect.mapError(() => new StorageFailure({ reason: "Unavailable" }))
  );

it.effect(
  "EX44 inventory lists versions+markers; purge removes clear versions; holds block",
  () =>
    withErasureStorage(({ client, config, worldRef }) =>
      Effect.gen(function* proof() {
        const inventory = yield* ErasureObjectInventory;
        const purge = yield* ErasurePurgeStore;
        const prefix = worldObjectPrefix(worldRef);
        const keyA = `${prefix}captures/${randomUUID()}`;
        const keyB = `${prefix}captures/${randomUUID()}`;
        const otherWorld = Schema.decodeSync(WorldId)(randomUUID());
        const otherKey = `worlds/live/${otherWorld}/captures/${randomUUID()}`;

        yield* sdk((signal) =>
          client.send(
            new PutObjectCommand({
              Body: "world-a-v1",
              Bucket: config.bucket,
              Key: keyA,
            }),
            { abortSignal: signal }
          )
        );
        yield* sdk((signal) =>
          client.send(
            new PutObjectCommand({
              Body: "world-a-v2",
              Bucket: config.bucket,
              Key: keyA,
            }),
            { abortSignal: signal }
          )
        );
        const marker = yield* sdk((signal) =>
          client.send(
            new DeleteObjectCommand({ Bucket: config.bucket, Key: keyA }),
            { abortSignal: signal }
          )
        );
        expect(marker.DeleteMarker).toBeTruthy();

        const putB = yield* sdk((signal) =>
          client.send(
            new PutObjectCommand({
              Body: "world-b",
              Bucket: config.bucket,
              Key: keyB,
            }),
            { abortSignal: signal }
          )
        );
        const versionB = yield* requireVersionId(putB.VersionId);

        yield* sdk((signal) =>
          client.send(
            new PutObjectCommand({
              Body: "other-world",
              Bucket: config.bucket,
              Key: otherKey,
            }),
            { abortSignal: signal }
          )
        );

        yield* sdk((signal) =>
          client.send(
            new PutObjectLegalHoldCommand({
              Bucket: config.bucket,
              Key: keyB,
              LegalHold: { Status: "ON" },
              VersionId: versionB,
            }),
            { abortSignal: signal }
          )
        );

        const manifest = yield* inventory.listWorldVersions(worldRef);
        expect(manifest.prefix).toBe(prefix);
        const allowed = worldObjectInventoryPrefixes(worldRef);
        expect(
          manifest.entries.every((entry) =>
            allowed.some((allowedPrefix) => entry.key.startsWith(allowedPrefix))
          )
        ).toBeTruthy();
        expect(
          manifest.entries.some((entry) => entry.key === otherKey)
        ).toBeFalsy();
        expect(
          manifest.entries.some((entry) => entry.deleteMarker)
        ).toBeTruthy();
        expect(manifest.entries.length).toBeGreaterThanOrEqual(3);

        const held = yield* purge.inspectHold({
          deleteMarker: false,
          key: keyB,
          versionId: versionB,
        });
        expect(held).toBe("LegalHold");

        const blocked = yield* purge.purgeVersion({
          deleteMarker: false,
          key: keyB,
          versionId: versionB,
        });
        expect(blocked).toBe("Blocked");

        const clearEntries = manifest.entries.filter(
          (entry) => entry.key === keyA
        );
        const results = yield* purge.purgeManifest(clearEntries);
        expect(
          results.every(
            (row) =>
              row.outcome === "Removed" || row.outcome === "AlreadyAbsent"
          )
        ).toBeTruthy();

        const after = yield* inventory.listWorldVersions(worldRef);
        expect(after.entries.every((entry) => entry.key !== keyA)).toBeTruthy();
        expect(after.entries.some((entry) => entry.key === keyB)).toBeTruthy();

        const keyC = `${prefix}captures/${randomUUID()}`;
        const putC = yield* sdk((signal) =>
          client.send(
            new PutObjectCommand({
              Body: "retain",
              Bucket: config.bucket,
              Key: keyC,
            }),
            { abortSignal: signal }
          )
        );
        const versionC = yield* requireVersionId(putC.VersionId);
        // Wall-clock: RustFS validates RetainUntilDate against real time, not Effect Clock.
        const retainUntil = new Date(Date.now() + 3_600_000);
        yield* sdk((signal) =>
          client.send(
            new PutObjectRetentionCommand({
              Bucket: config.bucket,
              Key: keyC,
              Retention: {
                Mode: "GOVERNANCE",
                RetainUntilDate: retainUntil,
              },
              VersionId: versionC,
            }),
            { abortSignal: signal }
          )
        );
        const retentionHold = yield* purge.inspectHold({
          deleteMarker: false,
          key: keyC,
          versionId: versionC,
        });
        expect(retentionHold).toBe("Retention");
        const retentionBlocked = yield* purge.purgeVersion({
          deleteMarker: false,
          key: keyC,
          versionId: versionC,
        });
        expect(retentionBlocked).toBe("Blocked");
      })
    )
);

it.effect("EX44 unqualified inventory stays Unavailable", () =>
  Effect.gen(function* blocked() {
    const inventory = yield* ErasureObjectInventory;
    const worldRef = Schema.decodeSync(WorldRef)({
      realm: "live",
      worldId: randomUUID(),
    });
    const exit = yield* Effect.exit(inventory.listWorldVersions(worldRef));
    expect(exit._tag).toBe("Failure");
  }).pipe(Effect.provide(ErasureObjectInventory.unqualifiedLayer))
);
