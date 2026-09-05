import { randomUUID } from "node:crypto";
import { createServer } from "node:net";

import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { PgClient } from "@effect/sql-pg";
import { expect, it } from "@effect/vitest";
import { Cause, Config, Effect, Redacted, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

const SocketAddress = Schema.Struct({ port: Schema.Int });

const closedLoopbackPort = Effect.fn("closedLoopbackPort")(
  function* reserveAndClose() {
    const listener = createServer();
    const address = yield* Effect.acquireUseRelease(
      Effect.callback<null, Cause.UnknownError>((resume) => {
        listener.once("error", (error) => {
          resume(Effect.fail(new Cause.UnknownError(error)));
        });
        listener.listen(0, "127.0.0.1", () => {
          resume(Effect.succeed(null));
        });
      }),
      () => Schema.decodeUnknownEffect(SocketAddress)(listener.address()),
      () =>
        Effect.callback<null, Cause.UnknownError>((resume) => {
          listener.close((error) => {
            resume(
              error
                ? Effect.fail(new Cause.UnknownError(error))
                : Effect.succeed(null)
            );
          });
        })
    );
    return address.port;
  }
);

it.live(
  "PostgreSQL reports a real refused connection instead of a successful result",
  () =>
    Effect.gen(function* postgresRefusal() {
      const configuredUrl = yield* Config.redacted("ZOEN_TEST_DATABASE_URL");
      const port = yield* closedLoopbackPort();
      const url = new URL(Redacted.value(configuredUrl));
      url.hostname = "127.0.0.1";
      url.port = String(port);
      const failure = yield* Effect.gen(function* queryUnavailableDatabase() {
        const sql = yield* SqlClient.SqlClient;
        return yield* sql`SELECT current_database()`;
      }).pipe(
        Effect.provide(
          PgClient.layer({
            connectTimeout: "3 seconds",
            url: Redacted.make(url.href),
          })
        ),
        Effect.flip
      );
      expect(failure).toMatchObject({
        _tag: "SqlError",
        reason: { cause: { code: "ECONNREFUSED" } },
      });
    })
);

it.live("S3 reports a real refused connection after one request attempt", () =>
  Effect.gen(function* s3Refusal() {
    const accessKey = yield* Config.redacted("ZOEN_TEST_S3_ACCESS_KEY");
    const secretKey = yield* Config.redacted("ZOEN_TEST_S3_SECRET_KEY");
    const port = yield* closedLoopbackPort();
    yield* Effect.acquireUseRelease(
      Effect.sync(
        () =>
          new S3Client({
            credentials: {
              accessKeyId: Redacted.value(accessKey),
              secretAccessKey: Redacted.value(secretKey),
            },
            endpoint: `http://127.0.0.1:${port}`,
            forcePathStyle: true,
            maxAttempts: 1,
            region: "us-east-1",
            requestHandler: { connectionTimeout: 3000, requestTimeout: 3000 },
          })
      ),
      (client) =>
        Effect.gen(function* requestUnavailableStorage() {
          const failure = yield* Effect.tryPromise((signal) =>
            client.send(
              new HeadBucketCommand({ Bucket: `zoen-ex01-${randomUUID()}` }),
              {
                abortSignal: signal,
              }
            )
          ).pipe(Effect.flip);
          expect(failure.cause).toMatchObject({
            $metadata: { attempts: 1 },
            code: "ECONNREFUSED",
          });
        }),
      (client) =>
        Effect.sync(() => {
          client.destroy();
        })
    );
  })
);
