import { AuthorityInstallationSchema } from "@zoen/authority/commit/configuration";
import { DataPolicySchema } from "@zoen/authority/ports/worlds/context";
import { parseJsonBytes } from "@zoen/authority/values/json";
import { exact } from "@zoen/contracts/worlds/values";
import { Config, Effect, FileSystem, Option, Schema } from "effect";

import type { ApplicationConfig } from "./composition.ts";
import { verifyRelease } from "./release.ts";

const InstallationFile = Schema.Struct({
  installation: AuthorityInstallationSchema,
  policy: DataPolicySchema,
}).annotate(exact);

export class ServerConfigurationError extends Schema.TaggedError<ServerConfigurationError>()(
  "ServerConfigurationError",
  { code: Schema.Literals(["INVALID_CONFIGURATION", "RELEASE_MISMATCH"]) }
) {
  /** Surface code in Cause / Fly logs (Effect pretty uses `message`). */
  override get message(): string {
    return this.code;
  }
}

export const loadConfiguration = Effect.gen(function* serverConfiguration() {
  const fs = yield* FileSystem.FileSystem;
  const installationPath = yield* Config.string("ZOEN_INSTALLATION_FILE");
  const installationBytes = yield* fs.readFile(installationPath);
  const installed = yield* parseJsonBytes(installationBytes, 65_536).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(InstallationFile))
  );
  // ZA-06: bootstrap must refuse RESET_REQUIRED before launch; this check is
  // belt-and-suspenders if the app is started without the entrypoint gate.
  if ((yield* verifyRelease) !== installed.installation.releaseDigest) {
    return yield* new ServerConfigurationError({ code: "RELEASE_MISMATCH" });
  }
  const listenPort = yield* Config.int("ZOEN_PORT");
  const listenHost = yield* Config.string("ZOEN_LISTEN_HOST").pipe(
    Config.withDefault("127.0.0.1")
  );
  if (listenPort < 1 || listenPort > 65_535 || listenHost.length === 0) {
    return yield* new ServerConfigurationError({
      code: "INVALID_CONFIGURATION",
    });
  }
  // ZA-05: application process must not inherit bootstrap administrator material.
  const bootstrapAdminUrl = yield* Config.string(
    "ZOEN_BOOTSTRAP_ADMIN_URL"
  ).pipe(Config.option);
  if (Option.isSome(bootstrapAdminUrl) && bootstrapAdminUrl.value.length > 0) {
    return yield* new ServerConfigurationError({
      code: "INVALID_CONFIGURATION",
    });
  }
  const objectStoreAdminKey = yield* Config.string(
    "ZOEN_S3_ADMIN_ACCESS_KEY"
  ).pipe(Config.option);
  if (
    Option.isSome(objectStoreAdminKey) &&
    objectStoreAdminKey.value.length > 0
  ) {
    return yield* new ServerConfigurationError({
      code: "INVALID_CONFIGURATION",
    });
  }
  const objectStoreAdminSecret = yield* Config.string(
    "ZOEN_S3_ADMIN_SECRET_KEY"
  ).pipe(Config.option);
  if (
    Option.isSome(objectStoreAdminSecret) &&
    objectStoreAdminSecret.value.length > 0
  ) {
    return yield* new ServerConfigurationError({
      code: "INVALID_CONFIGURATION",
    });
  }
  const erasureAttemptDatabaseUrl = yield* Config.redacted(
    "ZOEN_ERASURE_ATTEMPT_DATABASE_URL"
  ).pipe(Config.option);
  const application: ApplicationConfig = {
    authorityDatabaseUrl: yield* Config.redacted("ZOEN_AUTHORITY_DATABASE_URL"),
    identity: {
      baseUrl: yield* Config.string("ZOEN_PUBLIC_URL"),
      databaseUrl: yield* Config.redacted("ZOEN_IDENTITY_DATABASE_URL"),
      secret: yield* Config.redacted("ZOEN_AUTH_SECRET"),
      sessionSeconds: 3600,
    },
    installation: installed.installation,
    policy: installed.policy,
    storage: {
      bucket: yield* Config.string("ZOEN_S3_BUCKET"),
      connectionTimeoutMillis: 3000,
      credentials: {
        accessKeyId: yield* Config.redacted("ZOEN_S3_ACCESS_KEY"),
        secretAccessKey: yield* Config.redacted("ZOEN_S3_SECRET_KEY"),
      },
      endpoint: yield* Config.url("ZOEN_S3_ENDPOINT"),
      forcePathStyle: true,
      realm: "live",
      region: yield* Config.string("ZOEN_S3_REGION"),
      requestTimeoutMillis: 5000,
    },
    ...(Option.isSome(erasureAttemptDatabaseUrl)
      ? { erasureAttemptDatabaseUrl: erasureAttemptDatabaseUrl.value }
      : {}),
  };
  const openCodeApiKey = yield* Config.redacted("ZOEN_OPENCODE_API_KEY").pipe(
    Config.option
  );
  const openCodeBaseUrl = yield* Config.string("ZOEN_OPENCODE_BASE_URL").pipe(
    Config.withDefault("https://opencode.ai/zen/v1"),
    Config.option
  );
  const openCodeModel = yield* Config.string("ZOEN_OPENCODE_MODEL").pipe(
    Config.withDefault("big-pickle"),
    Config.option
  );
  const applicationWithOpenCode = Option.isSome(openCodeApiKey)
    ? {
        ...application,
        openCodeZen: {
          apiKey: openCodeApiKey.value,
          baseUrl: Option.isSome(openCodeBaseUrl)
            ? openCodeBaseUrl.value
            : "https://opencode.ai/zen/v1",
          model: Option.isSome(openCodeModel)
            ? openCodeModel.value
            : "big-pickle",
        },
      }
    : application;
  return { application: applicationWithOpenCode, listenHost, listenPort };
});
