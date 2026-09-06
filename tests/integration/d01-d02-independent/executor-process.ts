import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Config, Effect, FileSystem, Layer, Redacted, Schema } from "effect";

import type * as StorageModule from "../../../apps/server/src/adapters/object-storage/d01/s3.ts";
import type * as PostgresModule from "../../../apps/server/src/adapters/postgres/d01/postgres.ts";
import type * as DisclosureModule from "../../../apps/server/src/adapters/postgres/disclosure/fence.ts";
import type * as IdentityModule from "../../../apps/server/src/identity/d01/identity.ts";
import type * as InstallationModule from "../../../packages/authority/src/commit/configuration.ts";
import type * as PolicyModule from "../../../packages/authority/src/ports/d01/context.ts";
import type * as ExecutorModule from "../../../packages/authority/src/semantic/executor.ts";
import { makeProcessConfiguration } from "./process-configuration.ts";

class BuildRequired extends Schema.TaggedError<BuildRequired>()(
  "BuildRequired",
  { message: Schema.String }
) {}

// Only the test acknowledgement is withheld; production executor/SQL/storage are unchanged.
const program = Effect.scoped(
  Effect.gen(function* executorProcess() {
    // Dynamic compiled imports keep a fresh checkout typecheck independent of build artifacts.
    const { AuthorityInstallation, AuthorityInstallationSchema } =
      yield* Effect.tryPromise({
        catch: () =>
          new BuildRequired({
            message: "Build the application before EX15 process integration",
          }),
        try: (): Promise<typeof InstallationModule> =>
          import(
            new URL(
              "../../../packages/authority/dist/commit/configuration.js",
              import.meta.url
            ).href
          ),
      });
    const { DataPolicy, DataPolicySchema } = yield* Effect.tryPromise({
      catch: () =>
        new BuildRequired({
          message: "Build the application before EX15 process integration",
        }),
      try: (): Promise<typeof PolicyModule> =>
        import(
          new URL(
            "../../../packages/authority/dist/ports/d01/context.js",
            import.meta.url
          ).href
        ),
    });
    const { SemanticExecutor } = yield* Effect.tryPromise({
      catch: () =>
        new BuildRequired({
          message: "Build the application before EX15 process integration",
        }),
      try: (): Promise<typeof ExecutorModule> =>
        import(
          new URL(
            "../../../packages/authority/dist/semantic/executor.js",
            import.meta.url
          ).href
        ),
    });
    const { layer: storageLayer } = yield* Effect.tryPromise({
      catch: () =>
        new BuildRequired({
          message: "Build the application before EX15 process integration",
        }),
      try: (): Promise<typeof StorageModule> =>
        import(
          new URL(
            "../../../apps/server/dist/adapters/object-storage/d01/s3.js",
            import.meta.url
          ).href
        ),
    });
    const { makeD01PostgresLayer } = yield* Effect.tryPromise({
      catch: () =>
        new BuildRequired({
          message: "Build the application before EX15 process integration",
        }),
      try: (): Promise<typeof PostgresModule> =>
        import(
          new URL(
            "../../../apps/server/dist/adapters/postgres/d01/postgres.js",
            import.meta.url
          ).href
        ),
    });
    const { makeD01IdentityLayer } = yield* Effect.tryPromise({
      catch: () =>
        new BuildRequired({
          message: "Build the application before EX15 process integration",
        }),
      try: (): Promise<typeof IdentityModule> =>
        import(
          new URL(
            "../../../apps/server/dist/identity/d01/identity.js",
            import.meta.url
          ).href
        ),
    });
    const { makeDisclosureFenceLayer } = yield* Effect.tryPromise({
      catch: () =>
        new BuildRequired({
          message:
            "Build the application before disclosure process integration",
        }),
      try: (): Promise<typeof DisclosureModule> =>
        import(
          new URL(
            "../../../apps/server/dist/adapters/postgres/disclosure/fence.js",
            import.meta.url
          ).href
        ),
    });
    const fs = yield* FileSystem.FileSystem;
    const file = yield* Config.string("ZOEN_REVIEW_CONFIG");
    const holdAcknowledgement = yield* Config.boolean("ZOEN_REVIEW_HOLD_ACK");
    const config = yield* fs
      .readFileString(file)
      .pipe(
        Effect.flatMap(
          Schema.decodeEffect(
            Schema.fromJsonString(
              makeProcessConfiguration(
                AuthorityInstallationSchema,
                DataPolicySchema
              )
            )
          )
        )
      );
    const infrastructure = Layer.mergeAll(
      Layer.succeed(AuthorityInstallation, config.installation),
      Layer.succeed(DataPolicy, config.policy),
      makeD01PostgresLayer({
        applicationName: "zoen-ex15-child",
        maxConnections: 2,
        url: Redacted.make(config.authorityUrl),
      }),
      makeD01IdentityLayer({
        ...config.identity,
        databaseUrl: Redacted.make(config.identity.databaseUrl),
        secret: Redacted.make(config.identity.secret),
      }).pipe(
        Layer.provideMerge(
          makeDisclosureFenceLayer({
            applicationName: "zoen-ex15-child-disclosure",
            maxConnections: 2,
            url: Redacted.make(config.authorityUrl),
          })
        )
      ),
      storageLayer({
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
      })
    );
    const result = yield* Effect.gen(function* runExecutor() {
      const executor = yield* SemanticExecutor;
      const credential = Redacted.make(config.credential);
      const bytes = new TextEncoder().encode(config.request);
      switch (config.family) {
        case "sharing": {
          return yield* executor.executeSharing(credential, bytes);
        }
        case "correction": {
          return yield* executor.executeCorrection(credential, bytes);
        }
        case "subject-identity": {
          return yield* executor.executeSubjectIdentity(credential, bytes);
        }
        case "d01":
        case undefined: {
          return yield* executor.execute(credential, bytes);
        }
        default: {
          return yield* new BuildRequired({
            message: "Unknown semantic family",
          });
        }
      }
    }).pipe(
      Effect.provide(Layer.provide(SemanticExecutor.layer, infrastructure))
    );
    if (holdAcknowledgement) {
      yield* fs.writeFileString(`${file}.committed`, "executor-returned\n", {
        mode: 0o600,
      });
      return yield* Effect.never;
    }
    const encoded = yield* Schema.encodeEffect(
      Schema.fromJsonString(Schema.Unknown)
    )(result);
    yield* fs.writeFileString(`${file}.ack`, encoded, { mode: 0o600 });
    return null;
  })
);

NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));
