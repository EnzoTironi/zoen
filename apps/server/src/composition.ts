import { ApplicationApi } from "@zoen/contracts/worlds/api";
import {
  AuthorityInstallation,
  AuthorityInstallationSchema,
} from "@zoen/ontology/commit/configuration";
import {
  HostedAdmissionFlags,
  hostedRetainedAdmissionFlags,
} from "@zoen/ontology/hosted/admission/flags";
import {
  HostedErasableAdmission,
  HostedErasableObservedIdentity,
} from "@zoen/ontology/hosted/erasable/admission";
import { localErasureCopyCatalogLayer } from "@zoen/ontology/ports/erasure/copy-catalog-pg";
import {
  anchoredLocalErasureAttemptRegisterLayer,
  applyErasureAttemptSchema,
  localErasureAttemptRegisterLayer,
} from "@zoen/ontology/ports/erasure/local-pg";
import { ErasureObjectWriteSettlement } from "@zoen/ontology/ports/erasure/object-write";
import { ErasureRestoreActivation } from "@zoen/ontology/ports/erasure/restore-activation";
import {
  currentProductEveAdmissionInput,
  isProductEveAdmitted,
} from "@zoen/ontology/ports/eve/admission";
import { EveJournal } from "@zoen/ontology/ports/eve/journal";
import {
  DataPolicy,
  DataPolicySchema,
} from "@zoen/ontology/ports/worlds/context";
import { SemanticExecutor } from "@zoen/ontology/semantic/executor";
import { Effect, Layer, Redacted, Schema } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { fileErasureExternalAnchorLayer } from "./adapters/erasure/file-anchor.ts";
import { layer as erasureStorageLayer } from "./adapters/object-storage/erasure/s3.ts";
import type { S3EvidenceConfig } from "./adapters/object-storage/worlds/config.ts";
import { layer as s3EvidenceLayer } from "./adapters/object-storage/worlds/s3.ts";
import { makeDisclosureFenceLayer } from "./adapters/postgres/disclosure/fence.ts";
import { checkAuthorityRole } from "./adapters/postgres/worlds/authority-role.ts";
import { makeWorldsPostgresLayer } from "./adapters/postgres/worlds/postgres.ts";
import { eveJournalLayerForUrl } from "./eve/journal-layer.ts";
import {
  DEFAULT_OPENCODE_USER_AGENT,
  blockedModelPortLayer,
  liveModelPortLayer,
} from "./eve/model-port.ts";
import {
  hasNonBlankOpenCodeApiKey,
  isProductTextProfileGateOpen,
} from "./eve/text-profile.ts";
import { groundedEveTurnServiceLayer } from "./eve/turn-service.ts";
import { makeCorrectionHttpGroup } from "./http/corrections.ts";
import { makeErasureHttpGroup } from "./http/erasure.ts";
import { makeEveHttpGroup } from "./http/eve.ts";
import { makeIdentityRoutes } from "./http/identity.ts";
import { readinessRoutes } from "./http/readiness.ts";
import { responseSecurity } from "./http/security.ts";
import { makeSharingHttpGroup } from "./http/sharing.ts";
import { makeSubjectIdentityHttpGroup } from "./http/subject-identity.ts";
import { makeWorldsHttpGroup } from "./http/worlds.ts";
import { IdentityConfig } from "./identity/configuration.ts";
import { makeIdentityLayer } from "./identity/identity.ts";
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
  /**
   * Restricted Eve journal DB identity (ZA-18). Distinct role/schema; never the
   * authority migration owner. Absent → blocked journal, durableJournalQualified false.
   */
  readonly eveJournalDatabaseUrl?: Redacted.Redacted;
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
 * Product Eve surface (ZA-17 → ZA-20).
 * OpenCode key alone never admits live Zen. Durable journal installs only when
 * a restricted journal DB URL is configured (G-RESOURCES). Grounded TurnService
 * + ModelPort wire here (ZA-19). ZA-20 records the narrow grounded text profile
 * in the acceptance harness; tip keeps textProfileAccepted false without
 * G-PROVIDER live proof — do not set activated from this PR alone.
 */
export const makeProductEveSurface = (
  openCodeKeyPresent: boolean,
  options?: {
    readonly eveJournalDatabaseUrl?: Redacted.Redacted;
    readonly evidenceGroundingQualified?: boolean;
    readonly fetchImpl?: typeof globalThis.fetch;
    readonly openCodeZen?: ApplicationConfig["openCodeZen"];
    readonly textProfileAccepted?: boolean;
  }
) => {
  const durableJournalQualified = options?.eveJournalDatabaseUrl !== undefined;
  const evidenceGroundingQualified =
    options?.evidenceGroundingQualified === true;
  // Tip fail-closed: only explicit true opts into the ZA-20 profile gate.
  // Never default to isTextProfileAccepted(acceptedGroundedTextProfile()).
  const textProfileAccepted = isProductTextProfileGateOpen(
    options?.textProfileAccepted
  );
  // Blank/whitespace keys cannot satisfy G-PROVIDER even if an object is present.
  const zen = options?.openCodeZen;
  const zenKeyUsable =
    zen !== undefined && hasNonBlankOpenCodeApiKey(zen.apiKey);
  const admissionKeyPresent =
    zen === undefined ? openCodeKeyPresent : zenKeyUsable;
  const admission = currentProductEveAdmissionInput(admissionKeyPresent, {
    durableJournalQualified,
    evidenceGroundingQualified,
    textProfileAccepted,
  });
  const journalLayer =
    options?.eveJournalDatabaseUrl === undefined
      ? EveJournal.blockedProvidersLayer
      : eveJournalLayerForUrl(options.eveJournalDatabaseUrl);
  if (isProductEveAdmitted(admission)) {
    // All safety gates true — require live G-PROVIDER settings (never fabricate).
    if (zen === undefined || !zenKeyUsable) {
      return Effect.die(
        "ZA-20: product Eve admitted without G-PROVIDER OpenCode settings"
      );
    }
    return Effect.succeed(
      Layer.mergeAll(
        journalLayer,
        liveModelPortLayer(
          {
            apiKey: zen.apiKey,
            baseUrl: zen.baseUrl,
            model: zen.model,
            userAgent: DEFAULT_OPENCODE_USER_AGENT,
          },
          options?.fetchImpl
        ),
        groundedEveTurnServiceLayer
      )
    );
  }
  // Until journal + grounding + key + profile all clear, stay fail-closed.
  void evidenceGroundingQualified;
  return Effect.succeed(
    Layer.mergeAll(
      journalLayer,
      blockedModelPortLayer,
      groundedEveTurnServiceLayer
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
      // ZA-17→20: key alone must not admit stubMemory or live Zen.
      // Journal URL wires durable actor-bound journal; ZA-19 grounds TurnService.
      // Tip keeps textProfileAccepted false without G-PROVIDER live proof (ZA-20
      // harness/tests may opt in explicitly). Pass openCodeZen for admitted path.
      const eveSurface = yield* makeProductEveSurface(
        config.openCodeZen !== undefined,
        {
          evidenceGroundingQualified: true,
          textProfileAccepted: false,
          ...(config.openCodeZen === undefined
            ? {}
            : { openCodeZen: config.openCodeZen }),
          ...(config.eveJournalDatabaseUrl === undefined
            ? {}
            : { eveJournalDatabaseUrl: config.eveJournalDatabaseUrl }),
        }
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
        HostedErasableObservedIdentity.unboundLayer,
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
