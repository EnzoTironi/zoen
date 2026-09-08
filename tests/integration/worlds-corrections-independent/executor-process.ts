import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Config, Effect, FileSystem, Layer, Redacted, Schema } from "effect";

import type * as StorageModule from "../../../apps/server/src/adapters/object-storage/worlds/s3.ts";
import type * as DisclosureModule from "../../../apps/server/src/adapters/postgres/disclosure/fence.ts";
import type * as PostgresModule from "../../../apps/server/src/adapters/postgres/worlds/postgres.ts";
import type * as IdentityModule from "../../../apps/server/src/identity/identity.ts";
import type * as InstallationModule from "../../../packages/ontology/src/commit/configuration.ts";
import type * as ErasureRegisterModule from "../../../packages/ontology/src/ports/erasure/attempt-register.ts";
import type * as PolicyModule from "../../../packages/ontology/src/ports/worlds/context.ts";
import type * as ExecutorModule from "../../../packages/ontology/src/semantic/executor.ts";
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
              "../../../packages/ontology/dist/commit/configuration.js",
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
            "../../../packages/ontology/dist/ports/worlds/context.js",
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
            "../../../packages/ontology/dist/semantic/executor.js",
            import.meta.url
          ).href
        ),
    });
    const { ErasureAttemptRegister } = yield* Effect.tryPromise({
      catch: () =>
        new BuildRequired({
          message: "Build the application before EX15 process integration",
        }),
      try: (): Promise<typeof ErasureRegisterModule> =>
        import(
          new URL(
            "../../../packages/ontology/dist/ports/erasure/attempt-register.js",
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
            "../../../apps/server/dist/adapters/object-storage/worlds/s3.js",
            import.meta.url
          ).href
        ),
    });
    const { makeWorldsPostgresLayer } = yield* Effect.tryPromise({
      catch: () =>
        new BuildRequired({
          message: "Build the application before EX15 process integration",
        }),
      try: (): Promise<typeof PostgresModule> =>
        import(
          new URL(
            "../../../apps/server/dist/adapters/postgres/worlds/postgres.js",
            import.meta.url
          ).href
        ),
    });
    const { makeIdentityLayer } = yield* Effect.tryPromise({
      catch: () =>
        new BuildRequired({
          message: "Build the application before EX15 process integration",
        }),
      try: (): Promise<typeof IdentityModule> =>
        import(
          new URL(
            "../../../apps/server/dist/identity/worlds/identity.js",
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
      ErasureAttemptRegister.unqualifiedLayer,
      makeWorldsPostgresLayer({
        applicationName: "zoen-ex15-child",
        maxConnections: 2,
        url: Redacted.make(config.authorityUrl),
      }),
      makeIdentityLayer({
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
        case "worlds":
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
