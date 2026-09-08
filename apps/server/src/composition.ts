import {
  AuthorityInstallation,
  AuthorityInstallationSchema,
} from "@zoen/authority/commit/configuration";
import {
  HostedAdmissionFlags,
  hostedRetainedAdmissionFlags,
} from "@zoen/authority/hosted/admission/flags";
import { HostedErasableAdmission } from "@zoen/authority/hosted/erasable/admission";
import { localErasureCopyCatalogLayer } from "@zoen/authority/ports/erasure/copy-catalog-pg";
import {
  anchoredLocalErasureAttemptRegisterLayer,
  applyErasureAttemptSchema,
  localErasureAttemptRegisterLayer,
} from "@zoen/authority/ports/erasure/local-pg";
import { ErasureObjectWriteSettlement } from "@zoen/authority/ports/erasure/object-write";
import { ErasureRestoreActivation } from "@zoen/authority/ports/erasure/restore-activation";
import {
  currentProductEveAdmissionInput,
  isProductEveAdmitted,
} from "@zoen/authority/ports/eve/admission";
import { EveJournal } from "@zoen/authority/ports/eve/journal";
import { EveOpenCodeZen } from "@zoen/authority/ports/eve/opencode-zen";
import {
  DataPolicy,
  DataPolicySchema,
} from "@zoen/authority/ports/worlds/context";
import { SemanticExecutor } from "@zoen/authority/semantic/executor";
import { ApplicationApi } from "@zoen/contracts/worlds/api";
import { Effect, Layer, Redacted, Schema } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { fileErasureExternalAnchorLayer } from "./adapters/erasure/file-anchor.ts";
import { layer as erasureStorageLayer } from "./adapters/object-storage/erasure/s3.ts";
import type { S3EvidenceConfig } from "./adapters/object-storage/worlds/config.ts";
import { layer as s3EvidenceLayer } from "./adapters/object-storage/worlds/s3.ts";
import { makeDisclosureFenceLayer } from "./adapters/postgres/disclosure/fence.ts";
import { checkAuthorityRole } from "./adapters/postgres/worlds/authority-role.ts";
import { makeWorldsPostgresLayer } from "./adapters/postgres/worlds/postgres.ts";
import { makeCorrectionHttpGroup } from "./http/corrections.ts";
import { makeErasureHttpGroup } from "./http/erasure.ts";
import { makeEveHttpGroup } from "./http/eve.ts";
import { makeIdentityRoutes } from "./http/identity.ts";
import { readinessRoutes } from "./http/readiness.ts";
import { responseSecurity } from "./http/security.ts";
import { makeSharingHttpGroup } from "./http/sharing.ts";
import { makeSubjectIdentityHttpGroup } from "./http/subject-identity.ts";
import { makeWorldsHttpGroup } from "./http/worlds.ts";
import { IdentityConfig } from "./identity/worlds/configuration.ts";
import { makeIdentityLayer } from "./identity/worlds/identity.ts";
import { captureMaintenance } from "./maintenance/captures.ts";

export interface ApplicationConfig {
  readonly authorityDatabaseUrl: Redacted.Redacted;
  /** Dedicated pool/DB for attempt register (outside Closing TX). Defaults to authority URL. */
  readonly erasureAttemptDatabaseUrl?: Redacted.Redacted;
  /** Absolute path for local-narrow external anchor (ZA-11). */
  readonly erasureControllerAnchorPath?: string;
  readonly identity: IdentityConfig;
  readonly installation: typeof AuthorityInstallationSchema.Type;
  /**
   * Optional OpenCode Zen free credentials (ZN-0063).
   * Present only when ZOEN_OPENCODE_API_KEY is set; never logged or journaled.
   * Presence does **not** admit product Eve until ZA-18/19/20 safety proofs (ZA-17).
   */
  readonly openCodeZen?: {
    readonly apiKey: Redacted.Redacted;
    readonly baseUrl: string;
    readonly model: string;
  };
  readonly policy: DataPolicySchema;
  readonly storage: S3EvidenceConfig;
}

/** Frozen admission flags layer for worlds-hosted-retained-v1 installs (EX39). */
export const hostedAdmissionLayer = Layer.succeed(
  HostedAdmissionFlags,
  hostedRetainedAdmissionFlags
);

/**
 * Hosted retained admission layer for NEW Worlds only (EX39).
 * Default local retained / erasable installs get Layer.empty — no false channel health.
 */
export const hostedAdmissionLayerFor = (
  policy: DataPolicySchema
): Layer.Layer<HostedAdmissionFlags> | Layer.Layer<never> =>
  policy.profileId === "worlds-hosted-retained-v1"
    ? hostedAdmissionLayer
    : Layer.empty;

/**
 * Product Eve surface for the current tip (ZA-17).
 * OpenCode key presence alone never installs stubMemory or live Zen — only
 * blocked journal + blocked provider until ZA-18/19/20 qualify admission.
 * Exported so unit tests pin the same selection `makeApplication` uses.
 */
export const makeProductEveSurface = (openCodeKeyPresent: boolean) => {
  const admission = currentProductEveAdmissionInput(openCodeKeyPresent);
  if (isProductEveAdmitted(admission)) {
    // Tripwire: flipping admission flags without durable/live layers is unsafe.
    return Effect.die(
      "ZA-17: product Eve admitted without durable journal/grounding layers"
    );
  }
  return Effect.succeed(
    Layer.mergeAll(
      EveJournal.blockedProvidersLayer,
      EveOpenCodeZen.blockedLayer
    )
  );
};

/** One explicit composition for every public semantic operation. */
export const makeApplication = (config: ApplicationConfig) =>
  Layer.unwrap(
    Effect.gen(function* application() {
      const identityConfig = yield* Schema.decodeEffect(IdentityConfig)(
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
      const authorityPg = makeWorldsPostgresLayer({
        applicationName: "zoen-authority-live",
        maxConnections: 8,
        url: config.authorityDatabaseUrl,
      });
      const erasureAttemptUrl =
        config.erasureAttemptDatabaseUrl ?? config.authorityDatabaseUrl;
      const erasureAttemptPg = makeWorldsPostgresLayer({
        applicationName: "zoen-erasure-attempt",
        maxConnections: 4,
        url: erasureAttemptUrl,
      });
      // ZA-11: anchored local-narrow profile only when a separate anchor path is
      // configured. Same-URL register without an anchor does not claim independence.
      // Hosted/H-01 full activation remains disabled (restoreAfterErasure:false).
      const erasureRegister =
        config.erasureControllerAnchorPath === undefined
          ? localErasureAttemptRegisterLayer.pipe(
              Layer.provide(erasureAttemptPg)
            )
          : anchoredLocalErasureAttemptRegisterLayer.pipe(
              Layer.provide(erasureAttemptPg),
              Layer.provide(
                fileErasureExternalAnchorLayer(
                  config.erasureControllerAnchorPath
                )
              )
            );
      // Separate controller DB must receive attempt+head DDL before register use.
      // Same-URL installs rely on numbered migrations (F02 / applyErasureMigrations).
      const ensureSeparateControllerSchema =
        config.erasureAttemptDatabaseUrl !== undefined &&
        Redacted.value(config.erasureAttemptDatabaseUrl) !==
          Redacted.value(config.authorityDatabaseUrl)
          ? Layer.effectDiscard(
              applyErasureAttemptSchema().pipe(
                Effect.provide(erasureAttemptPg),
                Effect.orDie
              )
            )
          : Layer.empty;
      const erasureCopyCatalog = localErasureCopyCatalogLayer.pipe(
        Layer.provide(authorityPg)
      );
      // ZA-13: ordinary installs use unqualified (NotRestored). Durable
      // postgresRestoreActivationLayer is available for restore seams/tests;
      // promotion stays fail-closed — never advertise restoreAfterErasure:true.
      const restoreActivation = ErasureRestoreActivation.unqualifiedLayer;
      // ZA-17: key alone must not admit stubMemory or live Zen.
      const eveSurface = yield* makeProductEveSurface(
        config.openCodeZen !== undefined
      );
      const infrastructure = Layer.mergeAll(
        Layer.effectDiscard(checkAuthorityRole).pipe(
          Layer.provideMerge(authorityPg)
        ),
        makeIdentityLayer(config.identity).pipe(Layer.provideMerge(disclosure)),
        s3EvidenceLayer(config.storage),
        erasureStorageLayer(config.storage),
        Layer.succeed(AuthorityInstallation, installation),
        Layer.succeed(DataPolicy, policy),
        hostedAdmissionLayerFor(policy),
        // ZA-14: fail-closed hosted erasable admission (no H-02 target → Closing refused).
        HostedErasableAdmission.unqualifiedLayer,
        ensureSeparateControllerSchema,
        erasureRegister,
        erasureCopyCatalog,
        // Honest G-STORAGE-FENCE: Blocked — no fictitious vendor containment.
        ErasureObjectWriteSettlement.unqualifiedLayer,
        restoreActivation,
        eveSurface
      );
      const executor = SemanticExecutor.layerWithoutEve.pipe(
        Layer.provide(infrastructure)
      );
      const api = HttpApiBuilder.layer(ApplicationApi).pipe(
        Layer.provide(makeWorldsHttpGroup(identityConfig.baseUrl)),
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
