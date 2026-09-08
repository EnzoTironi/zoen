import { randomBytes, randomUUID } from "node:crypto";

import { PutBucketVersioningCommand } from "@aws-sdk/client-s3";
import { NodeHttpServer, NodeServices } from "@effect/platform-node";
import { AuthorityInstallationSchema } from "@zoen/authority/commit/configuration";
import { DataPolicySchema } from "@zoen/authority/ports/worlds/context";
import { digestBytes } from "@zoen/authority/values/canonical";
import { Effect, Layer, Redacted, Schema } from "effect";
import type { Scope } from "effect";
import {
  Cookies,
  HttpClient,
  HttpClientRequest,
  HttpRouter,
  HttpServer,
} from "effect/unstable/http";
import type { HttpClientResponse } from "effect/unstable/http";

import {
  applyErasureMigrations,
  applyIdentityBasisMigrations,
} from "../../../../../ops/migrations/run.ts";
import { makeApplication } from "../../../src/composition.ts";
import {
  sdk,
  withStorage,
} from "../../adapters/object-storage/worlds/fixture.ts";
import { withWorldsDatabase } from "../../adapters/postgres/worlds/database.ts";
import type { WorldsTestDatabase } from "../../adapters/postgres/worlds/database.ts";

export interface HttpFixture {
  readonly database: WorldsTestDatabase;
  readonly origin: string;
}

const retainedPolicy = {
  dataScope: "admitted-non-sensitive",
  enabledRealm: "live",
  erasure: false,
  legalHold: false,
  licensedExpiry: false,
  profileId: "worlds-local-retained-v1",
  restoreAfterErasure: false,
  retention: "while-pinned",
} as const;

const erasablePolicy = {
  dataScope: "admitted-non-sensitive",
  enabledRealm: "live",
  erasure: true,
  legalHold: false,
  licensedExpiry: false,
  profileId: "worlds-local-erasable-v1",
  restoreAfterErasure: false,
  retention: "while-pinned",
} as const;

export interface WithWorldsHttpOptions {
  /** When set, exercises ZA-17 key-present composition (still fail-closed). */
  readonly openCodeZen?: {
    readonly apiKey: Redacted.Redacted;
    readonly baseUrl: string;
    readonly model: string;
  };
}

export const withWorldsHttp = <A, E>(
  run: (
    fixture: HttpFixture
  ) => Effect.Effect<A, E, Scope.Scope | HttpClient.HttpClient>,
  options?: WithWorldsHttpOptions
) =>
  withWorldsDatabase(
    (database) =>
      withStorage(({ client, config: storage }) =>
        Effect.gen(function* actualHttpServer() {
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
            throw new Error("HTTP integration requires a TCP listener");
          }
          const origin = `http://127.0.0.1:${server.address.port}`;
          const policy =
            yield* Schema.decodeEffect(DataPolicySchema)(retainedPolicy);
          const releaseDescriptor = new TextEncoder().encode(
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              operations: [
                "CreatePersonalWorld",
                "ImportEvidence",
                "Inspect",
                "OpenEvidence",
              ],
              policy,
              schemaVersion: "worlds.v1",
            })
          );
          const installation = yield* Schema.decodeEffect(
            AuthorityInstallationSchema
          )({
            cellEpoch: "1",
            cellId: randomUUID(),
            generationId: randomUUID(),
            releaseDigest: digestBytes(releaseDescriptor),
          });
          const application = makeApplication({
            authorityDatabaseUrl: database.urls.authority,
            identity: {
              baseUrl: origin,
              databaseUrl: database.urls.identity,
              secret: Redacted.make(randomBytes(32).toString("hex")),
              sessionSeconds: 3600,
            },
            installation,
            ...(options?.openCodeZen === undefined
              ? {}
              : { openCodeZen: options.openCodeZen }),
            policy,
            storage,
          });
          yield* Layer.build(
            HttpRouter.serve(application, {
              disableListenLog: true,
              disableLogger: true,
            })
          );
          return yield* run({ database, origin });
        }).pipe(Effect.provide(NodeHttpServer.layerTest))
      ),
    undefined,
    (database) =>
      applyIdentityBasisMigrations(database.names).pipe(
        Effect.provide(Layer.mergeAll(database.migration, NodeServices.layer))
      )
  );

export const http = Effect.fn("test.http")(function* sendHttpRequest(
  origin: string,
  path: string,
  body?: string,
  credential?: Redacted.Redacted,
  requestOrigin: string = origin
) {
  const client = yield* HttpClient.HttpClient;
  const request = HttpClientRequest.make(body === undefined ? "GET" : "POST")(
    path
  ).pipe(
    HttpClientRequest.setHeaders({
      ...(credential === undefined
        ? {}
        : { cookie: Redacted.value(credential) }),
      origin: requestOrigin,
    })
  );
  return yield* client.execute(
    body === undefined
      ? request
      : HttpClientRequest.bodyText(request, body, "application/json")
  );
});

export const jsonBody = (response: HttpClientResponse.HttpClientResponse) =>
  response.json;

export const responseCookie = (
  response: HttpClientResponse.HttpClientResponse
) => Redacted.make(Cookies.toCookieHeader(response.cookies));

/** EX33+: compose candidate erasable profile + Closing DDL for surface journeys. */
export const withErasableHttp = <A, E>(
  run: (
    fixture: HttpFixture
  ) => Effect.Effect<A, E, Scope.Scope | HttpClient.HttpClient>
) =>
  withWorldsDatabase(
    (database) =>
      withStorage(({ client, config: storage }) =>
        Effect.gen(function* erasableHttpServer() {
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
            throw new Error("HTTP integration requires a TCP listener");
          }
          const origin = `http://127.0.0.1:${server.address.port}`;
          const policy =
            yield* Schema.decodeEffect(DataPolicySchema)(erasablePolicy);
          const releaseDescriptor = new TextEncoder().encode(
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
              operations: [
                "CreatePersonalWorld",
                "InspectWorldErasure",
                "RequestWorldErasure",
              ],
              policy,
              schemaVersion: "erasure.v1",
            })
          );
          const installation = yield* Schema.decodeEffect(
            AuthorityInstallationSchema
          )({
            cellEpoch: "1",
            cellId: randomUUID(),
            generationId: randomUUID(),
            releaseDigest: digestBytes(releaseDescriptor),
          });
          const application = makeApplication({
            authorityDatabaseUrl: database.urls.authority,
            erasureAttemptDatabaseUrl: database.urls.authority,
            identity: {
              baseUrl: origin,
              databaseUrl: database.urls.identity,
              secret: Redacted.make(randomBytes(32).toString("hex")),
              sessionSeconds: 3600,
            },
            installation,
            policy,
            storage,
          });
          yield* Layer.build(
            HttpRouter.serve(application, {
              disableListenLog: true,
              disableLogger: true,
            })
          );
          return yield* run({ database, origin });
        }).pipe(Effect.provide(NodeHttpServer.layerTest))
      ),
    undefined,
    (database) =>
      applyErasureMigrations(database.names).pipe(
        Effect.provide(Layer.mergeAll(database.migration, NodeServices.layer))
      )
  );
