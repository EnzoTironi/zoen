// Native barriers observe the real HTTP writer; filesystem control is intentional.
/* oxlint-disable effecttsgo/node-builtin-import */
/* oxlint-disable effecttsgo/global-date-in-effect */
/* oxlint-disable effecttsgo/prefer-schema-over-json */
/* oxlint-disable effecttsgo/try-catch-in-effect-gen */
/**
 * Real HTTP disclosure writer process for ZA-08 kill/containment races.
 * Controlled by filesystem barriers under ZOEN_ZA08_CONTROL.
 * Type imports from source for lint; runtime loads built dist like http-process.ts.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";

import {
  NodeHttpServer,
  NodeRuntime,
  NodeServices,
} from "@effect/platform-node";
import { Config, DateTime, Effect, Layer, Redacted, Schema } from "effect";
import {
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";

import { makeDisclosureFenceLayer } from "../../../../apps/server/src/adapters/postgres/disclosure/fence.ts";
import { makePrivateJsonEmitter } from "../../../../apps/server/src/http/disclosure.ts";
import { ResponseSecurityHeaders } from "../../../../apps/server/src/http/security.ts";
import type * as FenceModule from "../../../../packages/authority/src/ports/disclosure/fence.ts";
import type * as ContextModule from "../../../../packages/authority/src/ports/worlds/context.ts";
import type * as ValuesModule from "../../../../packages/contracts/src/worlds/values.ts";

const ConfigFile = Schema.Struct({
  authorityUrl: Schema.String,
  controlDir: Schema.String,
  membershipWorldId: Schema.String,
  presence: Schema.Struct({
    authenticatedAt: Schema.String,
    expiresAt: Schema.String,
    principalId: Schema.String,
    realm: Schema.Literal("live"),
    sessionId: Schema.String,
  }),
  privateBody: Schema.String,
});

const Bootstrap = Schema.Struct({ authorityUrl: Schema.String });

NodeRuntime.runMain(
  Effect.gen(function* main() {
    const configFile = yield* Config.string("ZOEN_ZA08_CONFIG");
    const bootstrap = yield* Schema.decodeEffect(
      Schema.fromJsonString(Bootstrap)
    )(readFileSync(configFile, "utf-8"));
    const { DisclosureFence } = yield* Effect.promise(
      (): Promise<typeof FenceModule> =>
        import(
          new URL(
            "../../../../packages/authority/dist/ports/disclosure/fence.js",
            import.meta.url
          ).href
        )
    );
    const { VerifiedPresence } = yield* Effect.promise(
      (): Promise<typeof ContextModule> =>
        import(
          new URL(
            "../../../../packages/authority/dist/ports/worlds/context.js",
            import.meta.url
          ).href
        )
    );
    const { Instant, WorldRef } = yield* Effect.promise(
      (): Promise<typeof ValuesModule> =>
        import(
          new URL(
            "../../../../packages/contracts/dist/worlds/values.js",
            import.meta.url
          ).href
        )
    );

    const program = Effect.scoped(
      Effect.gen(function* za08Writer() {
        const file = yield* Config.string("ZOEN_ZA08_CONFIG");
        const config = yield* Schema.decodeEffect(
          Schema.fromJsonString(ConfigFile)
        )(readFileSync(file, "utf-8"));
        const presence = yield* Schema.decodeEffect(VerifiedPresence)(
          config.presence
        );
        const world = yield* Schema.decodeEffect(WorldRef)({
          realm: "live",
          worldId: config.membershipWorldId,
        });
        const now = yield* DateTime.now;
        const deadline = yield* Schema.decodeEffect(Instant)(
          DateTime.formatIso(DateTime.add(now, { seconds: 30 }))
        );
        const fence = yield* DisclosureFence;
        const server = yield* HttpServer.HttpServer;
        if (server.address._tag !== "TcpAddress") {
          throw new Error("ZA-08 writer requires TCP");
        }
        const origin = `http://127.0.0.1:${server.address.port}`;
        const bytes = new TextEncoder().encode(config.privateBody);

        yield* server.serve(
          Effect.gen(function* handle() {
            const permit = yield* fence.shared(presence, world, deadline);
            writeFileSync(
              `${config.controlDir}/inventory.json`,
              JSON.stringify({
                permitId: permit.permitId,
                pid: process.pid,
                writerEpoch: permit.writerEpoch,
              }),
              { mode: 0o600 }
            );
            writeFileSync(`${config.controlDir}/paused`, "1", { mode: 0o600 });
            const until = Date.now() + 20_000;
            while (!existsSync(`${config.controlDir}/resume`)) {
              if (Date.now() >= until) {
                throw new Error("ZA-08 writer resume timed out");
              }
              yield* Effect.sleep("20 millis");
            }
            const request = yield* HttpServerRequest.HttpServerRequest;
            const emit = yield* makePrivateJsonEmitter(
              request,
              permit.authorizeSend
            );
            try {
              const submitted = emit(bytes);
              writeFileSync(`${config.controlDir}/submitted`, submitted, {
                mode: 0o600,
              });
              yield* permit.acknowledge.pipe(Effect.orDie);
              return HttpServerResponse.empty({ status: 200 });
            } catch (error) {
              writeFileSync(
                `${config.controlDir}/send-error`,
                error instanceof Error ? error.message : "unknown",
                { mode: 0o600 }
              );
              return HttpServerResponse.empty({ status: 503 });
            }
          }).pipe(
            Effect.uninterruptible,
            Effect.provideService(ResponseSecurityHeaders, {
              "cache-control": "no-store",
            })
          )
        );

        writeFileSync(
          `${config.controlDir}/ready.json`,
          JSON.stringify({ origin, pid: process.pid }),
          { mode: 0o600 }
        );
        return yield* Effect.never;
      })
    );

    return yield* program.pipe(
      Effect.provide(
        Layer.mergeAll(
          makeDisclosureFenceLayer({
            applicationName: "za08-child-writer",
            maxConnections: 2,
            url: Redacted.make(bootstrap.authorityUrl),
          }),
          NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 }),
          NodeServices.layer
        )
      )
    );
  })
);
