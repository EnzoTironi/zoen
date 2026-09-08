import { randomUUID } from "node:crypto";

import {
  AbortMultipartUploadCommand,
  CreateBucketCommand,
  CreateMultipartUploadCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  ListObjectVersionsCommand,
  PutBucketVersioningCommand,
  PutObjectCommand,
  PutObjectLegalHoldCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { expect, it } from "@effect/vitest";
import { ErasureObjectInventory } from "@zoen/authority/ports/erasure/inventory";
import { ErasurePurgeStore } from "@zoen/authority/ports/erasure/purge";
import { StorageFailure } from "@zoen/authority/ports/worlds/storage";
import { WorldRef } from "@zoen/contracts/worlds/values";
import { Config, Effect, Redacted, Schema } from "effect";
import type { Scope } from "effect";

import { worldObjectPrefix } from "../../../../src/adapters/object-storage/erasure/prefix.js";
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
        bucket: `zoen-za10-${randomUUID()}`,
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

it.live(
  "ZA-10-04: unknown multipart and legal hold block purge without elevated delete",
  () =>
    withErasureStorage(({ client, config, worldRef }) =>
      Effect.gen(function* holdAndMultipart() {
        const inventory = yield* ErasureObjectInventory;
        const purge = yield* ErasurePurgeStore;
        const prefix = worldObjectPrefix(worldRef);
        const key = `${prefix}captures/${randomUUID()}`;
        const created = yield* sdk((signal) =>
          client.send(
            new CreateMultipartUploadCommand({
              Bucket: config.bucket,
              Key: key,
            }),
            { abortSignal: signal }
          )
        );
        expect(created.UploadId).toBeTruthy();
        const part = new Uint8Array(5 * 1024 * 1024);
        part.fill(7);
        yield* sdk((signal) =>
          client.send(
            new UploadPartCommand({
              Body: part,
              Bucket: config.bucket,
              Key: key,
              PartNumber: 1,
              UploadId: created.UploadId,
            }),
            { abortSignal: signal }
          )
        );
        const multipart = yield* inventory.listWorldMultipartUploads(worldRef);
        expect(multipart.uploads).toHaveLength(1);
        expect(multipart.uploads[0]?.key).toBe(key);

        const heldKey = `${prefix}captures/${randomUUID()}`;
        const put = yield* sdk((signal) =>
          client.send(
            new PutObjectCommand({
              Body: Buffer.from("za10-hold"),
              Bucket: config.bucket,
              ContentType: "application/json",
              Key: heldKey,
            }),
            { abortSignal: signal }
          )
        );
        yield* sdk((signal) =>
          client.send(
            new PutObjectLegalHoldCommand({
              Bucket: config.bucket,
              Key: heldKey,
              LegalHold: { Status: "ON" },
              VersionId: put.VersionId,
            }),
            { abortSignal: signal }
          )
        );
        const hold = yield* purge.inspectHold({
          deleteMarker: false,
          key: heldKey,
          versionId: put.VersionId ?? "null",
        });
        expect(hold).toBe("LegalHold");
        const outcome = yield* purge.purgeVersion({
          deleteMarker: false,
          key: heldKey,
          versionId: put.VersionId ?? "null",
        });
        expect(outcome).toBe("Blocked");

        yield* sdk((signal) =>
          client.send(
            new AbortMultipartUploadCommand({
              Bucket: config.bucket,
              Key: key,
              UploadId: created.UploadId,
            }),
            { abortSignal: signal }
          )
        );
        const after = yield* inventory.listWorldMultipartUploads(worldRef);
        expect(after.uploads).toStrictEqual([]);
      })
    )
);
