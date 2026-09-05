import { randomUUID } from "node:crypto";

import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  ListObjectVersionsCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { EvidenceObjectStore } from "@zoen/authority/ports/d01/storage";
import { CaptureId, StorageFailure } from "@zoen/authority/ports/d01/storage";
import { digestBytes } from "@zoen/authority/values/canonical";
import { WorldRef } from "@zoen/contracts/d01/values";
import { Config, Effect, Redacted, Schema, Stream } from "effect";
import type { Scope } from "effect";

import type { S3EvidenceConfig } from "../../../../src/adapters/object-storage/d01/s3.js";
import { layer } from "../../../../src/adapters/object-storage/d01/s3.js";

export const sdk = <A>(run: (signal: AbortSignal) => Promise<A>) =>
  Effect.tryPromise({
    catch: () => new StorageFailure({ reason: "Unavailable" }),
    try: run,
  });

export const createClient = (config: S3EvidenceConfig) =>
  Effect.acquireRelease(
    Effect.sync(
      () =>
        new S3Client({
          credentials: {
            accessKeyId: Redacted.value(config.credentials.accessKeyId),
            secretAccessKey: Redacted.value(config.credentials.secretAccessKey),
          },
          endpoint: config.endpoint.href,
          forcePathStyle: config.forcePathStyle,
          maxAttempts: 1,
          region: config.region,
          requestHandler: {
            connectionTimeout: config.connectionTimeoutMillis,
            requestTimeout: config.requestTimeoutMillis,
          },
        })
    ),
    (client) =>
      Effect.sync(() => {
        client.destroy();
      })
  );

interface Fixture {
  readonly config: S3EvidenceConfig;
  readonly client: S3Client;
}

export const withStorage = <A, E>(
  use: (
    fixture: Fixture
  ) => Effect.Effect<A, E, EvidenceObjectStore | Scope.Scope>
) =>
  Effect.scoped(
    Effect.gen(function* storageFixture() {
      const endpoint = yield* Config.url("ZOEN_TEST_S3_ENDPOINT");
      const accessKeyId = yield* Config.redacted("ZOEN_TEST_S3_ACCESS_KEY");
      const secretAccessKey = yield* Config.redacted("ZOEN_TEST_S3_SECRET_KEY");
      const config: S3EvidenceConfig = {
        bucket: `zoen-ex07-${randomUUID()}`,
        connectionTimeoutMillis: 3000,
        credentials: { accessKeyId, secretAccessKey },
        endpoint,
        forcePathStyle: true,
        realm: "live",
        region: "us-east-1",
        requestTimeoutMillis: 5000,
      };
      const client = yield* createClient(config);
      return yield* Effect.acquireUseRelease(
        sdk((signal) =>
          client.send(new CreateBucketCommand({ Bucket: config.bucket }), {
            abortSignal: signal,
          })
        ),
        () => use({ client, config }).pipe(Effect.provide(layer(config))),
        () =>
          Effect.gen(function* removeOnlyFixtureBucket() {
            // A newly created UUID bucket belongs solely to this test, including unexpected partial uploads.
            const listing = yield* sdk((signal) =>
              client.send(
                new ListObjectVersionsCommand({ Bucket: config.bucket }),
                { abortSignal: signal }
              )
            );
            if (listing.IsTruncated === true) {
              return yield* new StorageFailure({ reason: "Unavailable" });
            }
            for (const object of [
              ...(listing.Versions ?? []),
              ...(listing.DeleteMarkers ?? []),
            ]) {
              if (object.Key === undefined) {
                return yield* new StorageFailure({ reason: "Unavailable" });
              }
              yield* sdk((signal) =>
                client.send(
                  new DeleteObjectCommand({
                    Bucket: config.bucket,
                    Key: object.Key,
                    VersionId: object.VersionId,
                  }),
                  { abortSignal: signal }
                )
              );
            }
            yield* sdk((signal) =>
              client.send(new DeleteBucketCommand({ Bucket: config.bucket }), {
                abortSignal: signal,
              })
            );
            return yield* Effect.void;
          })
      );
    })
  );

export const payload = new TextEncoder().encode(
  '{"message":"Zoen — ação","value":"0.10"}'
);
export const stageInput = (content: Uint8Array = payload) => ({
  captureId: Schema.decodeSync(CaptureId)(randomUUID()),
  content: Stream.make(content.subarray(0, 7), content.subarray(7)),
  expectedBytes: content.byteLength,
  expectedDigest: digestBytes(content),
  worldRef: Schema.decodeSync(WorldRef)({
    realm: "live",
    worldId: randomUUID(),
  }),
});

export const reservation = (input: ReturnType<typeof stageInput>) => ({
  captureId: input.captureId,
  expectedBytes: input.expectedBytes,
  expectedDigest: input.expectedDigest,
  worldRef: input.worldRef,
});
