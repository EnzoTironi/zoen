import {
  AuthorityInstallation,
  AuthorityInstallationSchema,
} from "@zoen/authority/commit/configuration";
import {
  DataPolicy,
  DataPolicySchema,
} from "@zoen/authority/ports/d01/context";
import { SemanticExecutor } from "@zoen/authority/semantic/executor";
import { ApplicationApi } from "@zoen/contracts/d01/api";
import { Effect, Layer, Schema } from "effect";
import type { Redacted } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import type { S3EvidenceConfig } from "./adapters/object-storage/d01/config.ts";
import { layer as s3EvidenceLayer } from "./adapters/object-storage/d01/s3.ts";
import { checkD01AuthorityRole } from "./adapters/postgres/d01/authority-role.ts";
import { makeD01PostgresLayer } from "./adapters/postgres/d01/postgres.ts";
import { makeDisclosureFenceLayer } from "./adapters/postgres/disclosure/fence.ts";
import { makeCorrectionHttpGroup } from "./http/corrections.ts";
import { makeD01HttpGroup } from "./http/d01.ts";
import { makeIdentityRoutes } from "./http/identity.ts";
import { readinessRoutes } from "./http/readiness.ts";
import { responseSecurity } from "./http/security.ts";
import { makeSharingHttpGroup } from "./http/sharing.ts";
import { D01IdentityConfig } from "./identity/d01/configuration.ts";
import { makeD01IdentityLayer } from "./identity/d01/identity.ts";
import { captureMaintenance } from "./maintenance/captures.ts";

export interface D01ApplicationConfig {
  readonly authorityDatabaseUrl: Redacted.Redacted;
  readonly identity: D01IdentityConfig;
  readonly installation: typeof AuthorityInstallationSchema.Type;
  readonly policy: DataPolicySchema;
  readonly storage: S3EvidenceConfig;
}

/** One explicit composition for every public semantic operation. */
export const makeD01Application = (config: D01ApplicationConfig) =>
  Layer.unwrap(
    Effect.gen(function* d01Application() {
      const identityConfig = yield* Schema.decodeEffect(D01IdentityConfig)(
        config.identity
      );
      const installation = yield* Schema.decodeEffect(
        AuthorityInstallationSchema
      )(config.installation);
      const policy = yield* Schema.decodeEffect(DataPolicySchema)(
        config.policy
      );
      const disclosure = makeDisclosureFenceLayer({
        applicationName: "zoen-disclosure-live",
        maxConnections: 8,
        url: config.authorityDatabaseUrl,
      });
      const infrastructure = Layer.mergeAll(
        Layer.effectDiscard(checkD01AuthorityRole).pipe(
          Layer.provideMerge(
            makeD01PostgresLayer({
              applicationName: "zoen-authority-live",
              maxConnections: 8,
              url: config.authorityDatabaseUrl,
            })
          )
        ),
        makeD01IdentityLayer(config.identity).pipe(
          Layer.provideMerge(disclosure)
        ),
        s3EvidenceLayer(config.storage),
        Layer.succeed(AuthorityInstallation, installation),
        Layer.succeed(DataPolicy, policy)
      );
      const executor = SemanticExecutor.layer.pipe(
        Layer.provide(infrastructure)
      );
      const api = HttpApiBuilder.layer(ApplicationApi).pipe(
        Layer.provide(makeD01HttpGroup(identityConfig.baseUrl)),
        Layer.provide(makeCorrectionHttpGroup(identityConfig.baseUrl)),
        Layer.provide(makeSharingHttpGroup(identityConfig.baseUrl)),
        Layer.provide(executor)
      );
      return Layer.mergeAll(
        api,
        makeIdentityRoutes(identityConfig.baseUrl),
        readinessRoutes,
        captureMaintenance
      ).pipe(Layer.provide(infrastructure), Layer.provide(responseSecurity));
    })
  );
