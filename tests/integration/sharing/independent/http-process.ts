// Native APIs are the observed boundary: the barrier must block synchronously without an Effect yield.
/* oxlint-disable effecttsgo/node-builtin-import */
import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createServer, ServerResponse } from "node:http";
import { createRequire } from "node:module";

import {
  NodeHttpServer,
  NodeRuntime,
  NodeServices,
} from "@effect/platform-node";
import { Config, Effect, FileSystem, Layer, Redacted, Schema } from "effect";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import type * as Pg from "pg";

import type * as ApplicationModule from "../../../../apps/server/src/composition.ts";
import type * as InstallationModule from "../../../../packages/ontology/src/commit/configuration.ts";
import type * as PolicyModule from "../../../../packages/ontology/src/ports/worlds/context.ts";
import {
  Barrier,
  makeHttpProcessConfiguration,
} from "./http-process-configuration.ts";

const json = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

// Both observers delegate exactly once. They never synthesize SQL/provider results or change body bytes.
const installObservers = (prefix: string) => {
  const waitCell = new Int32Array(new SharedArrayBuffer(4));
  let paused = false;
  const armed = () =>
    existsSync(`${prefix}.arm`)
      ? Schema.decodeSync(Schema.fromJsonString(Barrier))(
          readFileSync(`${prefix}.arm`, "utf-8")
        )
      : null;
  const pause = (kind: typeof Barrier.Type.kind) => {
    paused = true;
    writeFileSync(`${prefix}.reached`, json({ kind, pid: process.pid }), {
      mode: 0o600,
    });
    const deadline = performance.now() + 15_000;
    while (!existsSync(`${prefix}.release`)) {
      if (performance.now() >= deadline) {
        throw new Error("Independent process barrier timed out");
      }
      Atomics.wait(waitCell, 0, 0, 20);
    }
  };
  const require = createRequire(
    new URL("../../../../apps/server/package.json", import.meta.url)
  );
  // Resolve the same installed pg module as the compiled server; TypeScript supplies its public type.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const pg = require("pg") as typeof Pg;
  // The Proxy forwards the original receiver; rebinding would change the real driver call.
  // oxlint-disable-next-line typescript/unbound-method
  pg.Client.prototype.query = new Proxy(pg.Client.prototype.query, {
    apply(target, receiver, args: unknown[]) {
      const gate = armed();
      const [operation, values, callback] = args;
      if (
        !paused &&
        gate?.kind === "before-shared" &&
        operation ===
          "SELECT pg_try_advisory_lock_shared(hashtextextended($1, 0)) AS confirmed" &&
        Array.isArray(values) &&
        values[0] === gate.key
      ) {
        pause("before-shared");
      }
      if (
        gate?.kind === "observe-exclusive" &&
        operation ===
          "SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS confirmed" &&
        Array.isArray(values) &&
        values[0] === gate.key &&
        typeof callback === "function"
      ) {
        args[2] = new Proxy(callback, {
          apply(original, callbackReceiver, returned: unknown[]) {
            const [error, response] = returned;
            if (
              error === null &&
              Schema.is(
                Schema.Struct({
                  rows: Schema.Tuple([
                    Schema.Struct({ confirmed: Schema.Literal(false) }),
                  ]),
                })
              )(response)
            ) {
              writeFileSync(
                `${prefix}.exclusive-waiting`,
                "real-exclusive-try-returned-false\n",
                { mode: 0o600 }
              );
            }
            const result: unknown = Reflect.apply(
              original,
              callbackReceiver,
              returned
            );
            return result;
          },
        });
      }
      const result: unknown = Reflect.apply(target, receiver, args);
      return result;
    },
  });
  // The Proxy forwards the original ServerResponse receiver unchanged.
  // oxlint-disable-next-line typescript/unbound-method
  ServerResponse.prototype.end = new Proxy(ServerResponse.prototype.end, {
    apply(target, receiver, args: unknown[]) {
      const gate = armed();
      const [bytes] = args;
      if (
        !paused &&
        gate?.kind === "before-end" &&
        bytes instanceof Uint8Array
      ) {
        pause("before-end");
      }
      const result: unknown = Reflect.apply(target, receiver, args);
      if (gate !== null && bytes instanceof Uint8Array) {
        appendFileSync(
          `${prefix}.submitted`,
          `${json({ bytes: bytes.byteLength, event: "end.return" })}\n`,
          { mode: 0o600 }
        );
      }
      return result;
    },
  });
};

const program = Effect.scoped(
  Effect.gen(function* actualHttpProcess() {
    const fs = yield* FileSystem.FileSystem;
    const file = yield* Config.string("ZOEN_DISCLOSURE_HTTP_CONFIG");
    const { AuthorityInstallationSchema } = yield* Effect.promise(
      (): Promise<typeof InstallationModule> =>
        import(
          new URL(
            "../../../../packages/ontology/dist/commit/configuration.js",
            import.meta.url
          ).href
        )
    );
    const { DataPolicySchema } = yield* Effect.promise(
      (): Promise<typeof PolicyModule> =>
        import(
          new URL(
            "../../../../packages/ontology/dist/ports/worlds/context.js",
            import.meta.url
          ).href
        )
    );
    const config = yield* fs
      .readFileString(file)
      .pipe(
        Effect.flatMap(
          Schema.decodeEffect(
            Schema.fromJsonString(
              makeHttpProcessConfiguration(
                AuthorityInstallationSchema,
                DataPolicySchema
              )
            )
          )
        )
      );
    installObservers(config.controlPrefix);
    const { makeApplication } = yield* Effect.promise(
      (): Promise<typeof ApplicationModule> =>
        import(
          new URL(
            "../../../../apps/server/dist/composition.js",
            import.meta.url
          ).href
        )
    );
    return yield* Effect.gen(function* serveComposition() {
      const server = yield* HttpServer.HttpServer;
      if (server.address._tag !== "TcpAddress") {
        throw new Error("Independent HTTP process requires TCP");
      }
      const origin = `http://127.0.0.1:${server.address.port}`;
      const application = makeApplication({
        authorityDatabaseUrl: Redacted.make(config.authorityUrl),
        identity: {
          baseUrl: origin,
          databaseUrl: Redacted.make(config.identityUrl),
          secret: Redacted.make(config.secret),
          sessionSeconds: 3600,
        },
        installation: config.installation,
        policy: config.policy,
        storage: {
          bucket: config.storage.bucket,
          connectionTimeoutMillis: 3000,
          credentials: {
            accessKeyId: Redacted.make(config.storage.accessKeyId),
            secretAccessKey: Redacted.make(config.storage.secretAccessKey),
          },
          endpoint: new URL(config.storage.endpoint),
          forcePathStyle: true,
          realm: "live",
          region: "us-east-1",
          requestTimeoutMillis: 5000,
        },
      });
      yield* Layer.build(
        HttpRouter.serve(application, {
          disableListenLog: true,
          disableLogger: true,
        })
      );
      const readyPath = `${file}.ready`;
      const readyTemp = `${readyPath}.tmp`;
      yield* fs.writeFileString(readyTemp, json({ origin, pid: process.pid }), {
        mode: 0o600,
      });
      yield* fs.rename(readyTemp, readyPath);
      return yield* Effect.never;
    }).pipe(
      Effect.provide(
        NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 })
      )
    );
  })
);

NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));
