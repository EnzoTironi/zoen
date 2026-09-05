import { createHash, randomUUID } from "node:crypto";

import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { expect, it } from "@effect/vitest";
import { Config, Effect, Redacted } from "effect";

it.live(
  "S3 retains exact bytes and removes only the probe's object and bucket",
  () =>
    Effect.gen(function* s3Probe() {
      const endpoint = yield* Config.url("ZOEN_TEST_S3_ENDPOINT");
      const accessKey = yield* Config.redacted("ZOEN_TEST_S3_ACCESS_KEY");
      const secretKey = yield* Config.redacted("ZOEN_TEST_S3_SECRET_KEY");
      const bucket = `zoen-ex01-${randomUUID()}`;
      const key = `probe/${randomUUID()}`;
      const payload = new TextEncoder().encode(
        `Zoen infrastructure probe: ${randomUUID()} — ação`
      );
      const digest = createHash("sha256").update(payload).digest("hex");

      yield* Effect.acquireUseRelease(
        Effect.sync(
          () =>
            new S3Client({
              credentials: {
                accessKeyId: Redacted.value(accessKey),
                secretAccessKey: Redacted.value(secretKey),
              },
              endpoint: endpoint.href,
              forcePathStyle: true,
              maxAttempts: 1,
              region: "us-east-1",
              requestHandler: {
                connectionTimeout: 3000,
                requestTimeout: 3000,
              },
            })
        ),
        (client) =>
          Effect.acquireUseRelease(
            Effect.tryPromise((signal) =>
              client.send(new CreateBucketCommand({ Bucket: bucket }), {
                abortSignal: signal,
              })
            ),
            () =>
              Effect.gen(function* verifyStoredObject() {
                yield* Effect.tryPromise((signal) =>
                  client.send(
                    new PutObjectCommand({
                      Body: payload,
                      Bucket: bucket,
                      ContentType: "text/plain; charset=utf-8",
                      Key: key,
                    }),
                    { abortSignal: signal }
                  )
                );
                const response = yield* Effect.tryPromise((signal) =>
                  client.send(
                    new GetObjectCommand({ Bucket: bucket, Key: key }),
                    {
                      abortSignal: signal,
                    }
                  )
                );
                const body = yield* Effect.fromNullishOr(response.Body);
                const retrieved = yield* Effect.tryPromise(() =>
                  body.transformToByteArray()
                );
                expect(retrieved).toStrictEqual(payload);
                expect(response.ContentLength).toBe(payload.byteLength);
                expect(
                  createHash("sha256").update(retrieved).digest("hex")
                ).toBe(digest);

                yield* Effect.tryPromise((signal) =>
                  client.send(
                    new DeleteObjectCommand({ Bucket: bucket, Key: key }),
                    {
                      abortSignal: signal,
                    }
                  )
                );
                const missing = yield* Effect.tryPromise((signal) =>
                  client.send(
                    new GetObjectCommand({ Bucket: bucket, Key: key }),
                    {
                      abortSignal: signal,
                    }
                  )
                ).pipe(Effect.flip);
                expect(missing.cause).toMatchObject({
                  $metadata: { httpStatusCode: 404 },
                  name: "NoSuchKey",
                });
              }),
            () =>
              Effect.gen(function* removeProbeBucket() {
                yield* Effect.tryPromise((signal) =>
                  client.send(
                    new DeleteObjectCommand({ Bucket: bucket, Key: key }),
                    {
                      abortSignal: signal,
                    }
                  )
                );
                yield* Effect.tryPromise((signal) =>
                  client.send(new DeleteBucketCommand({ Bucket: bucket }), {
                    abortSignal: signal,
                  })
                );
              })
          ),
        (client) =>
          Effect.sync(() => {
            client.destroy();
          })
      );
    })
);
