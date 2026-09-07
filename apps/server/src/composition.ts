import {
  AuthorityInstallation,
  AuthorityInstallationSchema,
} from "@zoen/authority/commit/configuration";
import {
  HostedAdmissionFlags,
  d04HostedRetainedAdmissionFlags,
} from "@zoen/authority/hosted/admission/flags";
import { localErasureAttemptRegisterLayer } from "@zoen/authority/ports/erasure/local-pg";
import { EveJournal } from "@zoen/authority/ports/eve/journal";
import {
  DEFAULT_OPENCODE_USER_AGENT,
  EveOpenCodeZen,
} from "@zoen/authority/ports/eve/opencode-zen";
import {
  DataPolicy,
  DataPolicySchema,
} from "@zoen/authority/ports/worlds/context";
import { SemanticExecutor } from "@zoen/authority/semantic/executor";
import { ApplicationApi } from "@zoen/contracts/worlds/api";
import { Effect, Layer, Schema } from "effect";
import type { Redacted } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { layer as erasureStorageLayer } from "./adapters/object-storage/erasure/s3.ts";
import type { S3EvidenceConfig } from "./adapters/object-storage/worlds/config.ts";
import { layer as s3EvidenceLayer } from "./adapters/object-storage/worlds/s3.ts";
import { makeDisclosureFenceLayer } from "./adapters/postgres/disclosure/fence.ts";
import { checkD01AuthorityRole } from "./adapters/postgres/worlds/authority-role.ts";
import { makeD01PostgresLayer } from "./adapters/postgres/worlds/postgres.ts";
import { makeCorrectionHttpGroup } from "./http/corrections.ts";
import { makeErasureHttpGroup } from "./http/erasure.ts";
import { makeEveHttpGroup } from "./http/eve.ts";
import { makeIdentityRoutes } from "./http/identity.ts";
import { readinessRoutes } from "./http/readiness.ts";
import { responseSecurity } from "./http/security.ts";
import { makeSharingHttpGroup } from "./http/sharing.ts";
import { makeSubjectIdentityHttpGroup } from "./http/subject-identity.ts";
import { makeD01HttpGroup } from "./http/worlds.ts";
import { D01IdentityConfig } from "./identity/worlds/configuration.ts";
import { makeD01IdentityLayer } from "./identity/worlds/identity.ts";
import { captureMaintenance } from "./maintenance/captures.ts";

export interface D01ApplicationConfig {
  readonly authorityDatabaseUrl: Redacted.Redacted;
  /** Dedicated pool/DB for attempt register (outside Closing TX). Defaults to authority URL. */
  readonly erasureAttemptDatabaseUrl?: Redacted.Redacted;
  readonly identity: D01IdentityConfig;
  readonly installation: typeof AuthorityInstallationSchema.Type;
  /**
   * Optional OpenCode Zen free credentials (D05 / ZN-0063).
   * Present only when ZOEN_OPENCODE_API_KEY is set; never logged or journaled.
   */
  readonly openCodeZen?: {
    readonly apiKey: Redacted.Redacted;
    readonly baseUrl: string;
    readonly model: string;
  };
  readonly policy: DataPolicySchema;
  readonly storage: S3EvidenceConfig;
}

/** Frozen admission flags layer for d04-hosted-retained-v1 installs (EX39). */
export const hostedAdmissionLayer = Layer.succeed(
  HostedAdmissionFlags,
  d04HostedRetainedAdmissionFlags
);

/**
 * Hosted retained admission layer for NEW Worlds only (EX39).
 * Default local retained / erasable installs get Layer.empty — no false channel health.
 */
export const hostedAdmissionLayerFor = (
  policy: DataPolicySchema
): Layer.Layer<HostedAdmissionFlags> | Layer.Layer<never> =>
  policy.profileId === "d04-hosted-retained-v1"
    ? hostedAdmissionLayer
    : Layer.empty;

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
      const authorityPg = makeD01PostgresLayer({
        applicationName: "zoen-authority-live",
        maxConnections: 8,
        url: config.authorityDatabaseUrl,
      });
      const erasureAttemptUrl =
        config.erasureAttemptDatabaseUrl ?? config.authorityDatabaseUrl;
      const erasureAttemptPg = makeD01PostgresLayer({
        applicationName: "zoen-erasure-attempt",
        maxConnections: 4,
        url: erasureAttemptUrl,
      });
      const erasureRegister = localErasureAttemptRegisterLayer.pipe(
        Layer.provide(erasureAttemptPg)
      );
      const eveOpenCode =
        config.openCodeZen === undefined
          ? EveOpenCodeZen.blockedLayer
          : EveOpenCodeZen.liveLayer({
              apiKey: config.openCodeZen.apiKey,
              baseUrl: config.openCodeZen.baseUrl,
              model: config.openCodeZen.model,
              userAgent: DEFAULT_OPENCODE_USER_AGENT,
            });
      const eveSurface = Layer.mergeAll(
        EveJournal.stubMemoryLayer,
        eveOpenCode
      );
      const infrastructure = Layer.mergeAll(
        Layer.effectDiscard(checkD01AuthorityRole).pipe(
          Layer.provideMerge(authorityPg)
        ),
        makeD01IdentityLayer(config.identity).pipe(
          Layer.provideMerge(disclosure)
        ),
        s3EvidenceLayer(config.storage),
        erasureStorageLayer(config.storage),
        Layer.succeed(AuthorityInstallation, installation),
        Layer.succeed(DataPolicy, policy),
        hostedAdmissionLayerFor(policy),
        erasureRegister,
        eveSurface
      );
      const executor = SemanticExecutor.layerWithoutEve.pipe(
        Layer.provide(infrastructure)
      );
      const api = HttpApiBuilder.layer(ApplicationApi).pipe(
        Layer.provide(makeD01HttpGroup(identityConfig.baseUrl)),
        Layer.provide(makeCorrectionHttpGroup(identityConfig.baseUrl)),
        Layer.provide(makeSharingHttpGroup(identityConfig.baseUrl)),
        Layer.provide(makeSubjectIdentityHttpGroup(identityConfig.baseUrl)),
        Layer.provide(makeErasureHttpGroup(identityConfig.baseUrl)),
        Layer.provide(makeEveHttpGroup(identityConfig.baseUrl)),
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
