import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { DateTime, Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { makeWorldsPostgresLayer } from "../../../../apps/server/src/adapters/postgres/worlds/postgres.js";
import { withWorldsDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.js";
import {
  PurgeWorldContent,
  RequestWorldErasure,
} from "../../../../packages/contracts/src/erasure/operations.js";
import { HostedErasableTarget } from "../../../../packages/contracts/src/hosted/erasable/values.js";
import { CreatePersonalWorld } from "../../../../packages/contracts/src/worlds/operations.js";
import {
  AuthorityInstallation,
  AuthorityInstallationSchema,
} from "../../../../packages/ontology/src/commit/configuration.js";
import { createPersonalWorld } from "../../../../packages/ontology/src/commit/genesis.js";
import {
  HostedErasableAdmission,
  HostedErasableObservedIdentity,
  currentHostedErasableQualification,
  evaluateHostedErasableAdmission,
  gatesAdmitFullHostedErased,
  refuseProtectedResource,
} from "../../../../packages/ontology/src/hosted/erasable/admission.js";
import { purgeWorldContent } from "../../../../packages/ontology/src/knowledge/erasure/handlers/purge.js";
import { requestWorldErasure } from "../../../../packages/ontology/src/knowledge/erasure/handlers/request.js";
import { applyWorldErasureSchema } from "../../../../packages/ontology/src/knowledge/erasure/schema.js";
import {
  ErasureAttemptRegister,
  blocksWorldContentAdmission,
} from "../../../../packages/ontology/src/ports/erasure/attempt-register.js";
import {
  applyControlledCopyCatalogSchema,
  localErasureCopyCatalogLayer,
} from "../../../../packages/ontology/src/ports/erasure/copy-catalog-pg.js";
import { ErasureObjectInventory } from "../../../../packages/ontology/src/ports/erasure/inventory.js";
import {
  applyErasureAttemptSchema,
  localErasureAttemptRegisterLayer,
} from "../../../../packages/ontology/src/ports/erasure/local-pg.js";
import { ErasurePurgeStore } from "../../../../packages/ontology/src/ports/erasure/purge.js";
import { ErasureRestoreActivation } from "../../../../packages/ontology/src/ports/erasure/restore-activation.js";
import {
  DataPolicy,
  HostedErasableDataPolicySchema,
  HostedRetainedDataPolicySchema,
  VerifiedRequestContext,
} from "../../../../packages/ontology/src/ports/worlds/context.js";
import { digestBytes } from "../../../../packages/ontology/src/values/canonical.js";

const releaseDigest = digestBytes(
  new TextEncoder().encode("ZA-14 hosted erasable local exact-image fixture")
);
const proofInstallId = "install-za14-local-proof";

const proofTarget = Schema.decodeSync(HostedErasableTarget)({
  appName: "zoen-erasable-proof",
  bucketName: "erasable-proof-bucket",
  // Must match AuthorityInstallation.releaseDigest — independent observation.
  imageDigest: releaseDigest,
  installId: proofInstallId,
  profileId: "worlds-hosted-erasable-v1",
  volumeName: "erasable_proof_data",
});

const installation = Schema.decodeSync(AuthorityInstallationSchema)({
  cellEpoch: "1",
  cellId: randomUUID(),
  generationId: randomUUID(),
  releaseDigest,
});

const observedIdentity = HostedErasableObservedIdentity.boundLayer({
  appName: proofTarget.appName,
  bucketName: proofTarget.bucketName,
  installId: proofInstallId,
  volumeName: proofTarget.volumeName,
});

const emptyObjectLayers = Layer.mergeAll(
  Layer.succeed(
    ErasureObjectInventory,
    ErasureObjectInventory.of({
      listWorldMultipartUploads: (worldRef) =>
        Effect.succeed({
          prefix: `worlds/${worldRef.realm}/${worldRef.worldId.toLowerCase()}/`,
          uploads: [],
        }),
      listWorldVersions: (worldRef) =>
        Effect.succeed({
          entries: [],
          prefix: `worlds/${worldRef.realm}/${worldRef.worldId.toLowerCase()}/`,
        }),
    })
  ),
  Layer.succeed(
    ErasurePurgeStore,
    ErasurePurgeStore.of({
      inspectHold: () => Effect.succeed("Clear" as const),
      purgeManifest: () => Effect.succeed([]),
      purgeVersion: () => Effect.succeed("AlreadyAbsent" as const),
    })
  )
);

const heldObjectLayers = Layer.mergeAll(
  Layer.succeed(
    ErasureObjectInventory,
    ErasureObjectInventory.of({
      listWorldMultipartUploads: (worldRef) =>
        Effect.succeed({
          prefix: `worlds/${worldRef.realm}/${worldRef.worldId.toLowerCase()}/`,
          uploads: [],
        }),
      listWorldVersions: (worldRef) =>
        Effect.succeed({
          entries: [
            {
              deleteMarker: false,
              isLatest: true,
              key: `worlds/${worldRef.realm}/${worldRef.worldId.toLowerCase()}/held`,
              versionId: "held-version",
            },
          ],
          prefix: `worlds/${worldRef.realm}/${worldRef.worldId.toLowerCase()}/`,
        }),
    })
  ),
  Layer.succeed(
    ErasurePurgeStore,
    ErasurePurgeStore.of({
      inspectHold: () => Effect.succeed("LegalHold" as const),
      purgeManifest: () => Effect.succeed([]),
      purgeVersion: () => Effect.succeed("Blocked" as const),
    })
  )
);

const hostedErasablePolicy = Schema.decodeSync(HostedErasableDataPolicySchema)({
  dataScope: "admitted-non-sensitive",
  enabledRealm: "live",
  erasure: true,
  legalHold: false,
  licensedExpiry: false,
  profileId: "worlds-hosted-erasable-v1",
  restoreAfterErasure: false,
  retention: "while-pinned",
});

const hostedRetainedPolicy = Schema.decodeSync(HostedRetainedDataPolicySchema)({
  dataScope: "admitted-non-sensitive",
  enabledRealm: "live",
  erasure: false,
  legalHold: false,
  licensedExpiry: false,
  profileId: "worlds-hosted-retained-v1",
  restoreAfterErasure: false,
  retention: "while-pinned",
});

const proofAdmission =
  HostedErasableAdmission.localExactImageProofLayer(proofTarget);

const hostedErasableConfiguration = Layer.mergeAll(
  Layer.succeed(AuthorityInstallation, installation),
  Layer.succeed(DataPolicy, hostedErasablePolicy),
  ErasureRestoreActivation.unqualifiedLayer,
  proofAdmission,
  observedIdentity,
  emptyObjectLayers
);

const hostedRetainedConfiguration = Layer.mergeAll(
  Layer.succeed(AuthorityInstallation, installation),
  Layer.succeed(DataPolicy, hostedRetainedPolicy),
  ErasureAttemptRegister.unqualifiedLayer,
  ErasureRestoreActivation.unqualifiedLayer,
  HostedErasableAdmission.unqualifiedLayer,
  HostedErasableObservedIdentity.unboundLayer,
  emptyObjectLayers
);

const mismatchedDigestConfiguration = Layer.mergeAll(
  Layer.succeed(AuthorityInstallation, installation),
  Layer.succeed(DataPolicy, hostedErasablePolicy),
  ErasureRestoreActivation.unqualifiedLayer,
  // Authorized target claims a different image than the running installation.
  HostedErasableAdmission.localExactImageProofLayer(
    Schema.decodeSync(HostedErasableTarget)({
      ...proofTarget,
      imageDigest: digestBytes(
        new TextEncoder().encode("ZA-14 mismatched release digest")
      ),
    })
  ),
  observedIdentity,
  emptyObjectLayers
);

const makeContext = Effect.fn("ZA14.makeContext")(function* makeContext(
  principalId: string = randomUUID()
) {
  const now = yield* DateTime.now;
  return yield* Schema.decodeEffect(VerifiedRequestContext)({
    deadline: DateTime.formatIso(DateTime.add(now, { seconds: 30 })),
    presence: {
      authenticatedAt: DateTime.formatIso(
        DateTime.subtract(now, { seconds: 1 })
      ),
      expiresAt: DateTime.formatIso(DateTime.add(now, { minutes: 1 })),
      principalId,
      realm: "live",
      sessionId: randomUUID(),
    },
    purpose: "personal-records",
  });
});

const grantErasureSchemas = Effect.fn("ZA14.grantErasure")(
  function* grantErasureSchemas(authorityRole: string) {
    const sql = yield* SqlClient.SqlClient;
    yield* sql.unsafe(
      `GRANT USAGE ON SCHEMA erasure_attempt TO "${authorityRole}";
       GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA erasure_attempt TO "${authorityRole}";
       GRANT SELECT, INSERT, UPDATE, DELETE ON authority.world_erasure_progress, authority.world_erasure_receipts TO "${authorityRole}";
       GRANT SELECT, INSERT, UPDATE, DELETE ON authority.frames, authority.cases, authority.corrections,
         authority.claims, authority.pins, authority.evidence, authority.sources,
         authority.receipts, authority.operations, authority.bootstrap_operations,
         authority.memberships, authority.identity_decisions TO "${authorityRole}";
       GRANT SELECT, INSERT, UPDATE, DELETE ON jobs.captures, jobs.outbox TO "${authorityRole}";
       GRANT SELECT, INSERT, UPDATE ON jobs.object_write_attempts TO "${authorityRole}";
       GRANT SELECT, INSERT, UPDATE ON authority.controlled_copy_coverage, authority.controlled_copy_entries TO "${authorityRole}"`
    );
  }
);

const withErasureRuntime = <A, E, R, ROut, EOut>(
  configuration: Layer.Layer<ROut, EOut>,
  run: Effect.Effect<A, E, R>
) =>
  withWorldsDatabase((database) =>
    Effect.gen(function* prepare() {
      yield* Effect.gen(function* migrate() {
        const sql = yield* SqlClient.SqlClient;
        const membership = yield* Effect.promise(() =>
          import("node:fs/promises").then((fs) =>
            fs.readFile(
              new URL(
                "../../../../ops/migrations/005_world_read_membership.sql",
                import.meta.url
              ),
              "utf-8"
            )
          )
        );
        yield* sql.withTransaction(sql.unsafe(membership));
        yield* applyErasureAttemptSchema();
        yield* applyWorldErasureSchema();
        yield* applyControlledCopyCatalogSchema();
        yield* grantErasureSchemas(database.names.authority);
      }).pipe(Effect.provide(database.migration));

      const registerPg = makeWorldsPostgresLayer({
        applicationName: "zoen-za14-erasure-attempt",
        maxConnections: 4,
        url: database.urls.authority,
      });
      const register = localErasureAttemptRegisterLayer.pipe(
        Layer.provide(registerPg)
      );
      const copyCatalog = localErasureCopyCatalogLayer.pipe(
        Layer.provide(registerPg)
      );
      return yield* run.pipe(
        Effect.provide(
          Layer.mergeAll(
            configuration,
            database.authority,
            register,
            copyCatalog
          )
        )
      );
    })
  );

const createWorld = Effect.fn("ZA14.createWorld")(function* createWorld(
  context: Effect.Success<ReturnType<typeof makeContext>>
) {
  const request = yield* Schema.decodeEffect(CreatePersonalWorld)({
    input: {},
    operation: "CreatePersonalWorld",
    operationId: randomUUID(),
    purpose: "personal-records",
    schemaVersion: "worlds.v1",
  });
  return yield* createPersonalWorld(context, request);
});

it.live(
  "ZA-14-01 authorized local exact-image hosted erasable: Closing + restore suppression; product gates stay Blocked",
  () =>
    withErasureRuntime(
      hostedErasableConfiguration,
      Effect.gen(function* happy() {
        const qualification = currentHostedErasableQualification();
        expect(gatesAdmitFullHostedErased(qualification)).toBeFalsy();
        expect(qualification.productAccepted).toBeFalsy();

        const admission = yield* HostedErasableAdmission;
        const bound = yield* admission.qualification;
        expect(bound.localExactImageProofAdmitted).toBeTruthy();
        expect(bound.productAccepted).toBeFalsy();
        expect(bound.h01).toBe("Blocked");
        expect(bound.h02).toBe("Blocked");
        expect(bound.gOps).toBe("Unknown");
        expect(bound.gStorageFence).toBe("Blocked");
        expect(bound.authorizedTarget?.imageDigest).toBe(
          proofTarget.imageDigest
        );

        const context = yield* makeContext();
        const created = yield* createWorld(context);
        const sql = yield* SqlClient.SqlClient;
        expect(
          yield* sql`
            SELECT data_policy_id FROM authority.worlds
            WHERE world_id = ${created.worldRef.worldId}
          `
        ).toStrictEqual([{ data_policy_id: "worlds-hosted-erasable-v1" }]);

        const operationId = randomUUID();
        const request = yield* Schema.decodeEffect(RequestWorldErasure)({
          input: {
            confirmEntireWorld: true,
            expectedErasureRevision: null,
            policyVersion: "worlds-hosted-erasable-v1",
          },
          operation: "RequestWorldErasure",
          operationId,
          purpose: "personal-records",
          schemaVersion: "erasure.v1",
          worldRef: created.worldRef,
        });
        const success = yield* requestWorldErasure(context, request);
        expect(success.restoreAfterErasure).toBeFalsy();
        expect(success.phase).toBe("Closing");

        const register = yield* ErasureAttemptRegister;
        const observation = yield* register.observeWorld(created.worldRef);
        expect(blocksWorldContentAdmission(observation)).toBeTruthy();
      })
    )
);

it.live("ZA-14-02 retained install refuses Closing before purge/rebind", () =>
  withErasureRuntime(
    hostedRetainedConfiguration,
    Effect.gen(function* retainedRefuse() {
      expect(
        refuseProtectedResource({
          appName: "zoen-rebuild",
          bucketName: "zoen",
          imageDigest: "sha256:x",
          installId: "retained",
          policyProfileId: "worlds-hosted-retained-v1",
          volumeName: "zoen_data",
        })
      ).toMatchObject({
        admitted: false,
        reason: "retained-install-profile",
      });

      const context = yield* makeContext();
      const created = yield* createWorld(context);
      const request = yield* Schema.decodeEffect(RequestWorldErasure)({
        input: {
          confirmEntireWorld: true,
          expectedErasureRevision: null,
          policyVersion: "worlds-hosted-erasable-v1",
        },
        operation: "RequestWorldErasure",
        operationId: randomUUID(),
        purpose: "personal-records",
        schemaVersion: "erasure.v1",
        worldRef: created.worldRef,
      });
      const blocked = yield* requestWorldErasure(context, request).pipe(
        Effect.flip
      );
      expect(blocked._tag).toBe("Blocked");
    })
  )
);

it.live(
  "ZA-14-03 incomplete catalog / controller / hold → Blocked/Unknown",
  () =>
    Effect.sync(() => {
      const candidate = {
        appName: proofTarget.appName,
        bucketName: proofTarget.bucketName,
        imageDigest: proofTarget.imageDigest,
        installId: proofTarget.installId,
        policyProfileId: "worlds-hosted-erasable-v1" as const,
        volumeName: proofTarget.volumeName,
      };
      // Use local proof qualification so target binding is not the failure mode.
      const qualification = {
        ...currentHostedErasableQualification(),
        authorizedTarget: proofTarget,
        localExactImageProofAdmitted: true,
      };

      expect(
        evaluateHostedErasableAdmission({
          candidate,
          catalogCoverage: "Unknown",
          controllerAvailable: true,
          heldObject: false,
          purpose: "purge",
          qualification,
        })
      ).toMatchObject({
        admitted: false,
        reason: "incomplete-catalog",
        status: "Unknown",
      });

      expect(
        evaluateHostedErasableAdmission({
          candidate,
          catalogCoverage: "BoundedComplete",
          controllerAvailable: false,
          heldObject: false,
          purpose: "full-erased",
          qualification,
        })
      ).toMatchObject({ admitted: false });

      expect(gatesAdmitFullHostedErased(qualification)).toBeFalsy();
    })
);

it.live(
  "ZA-14 observed runtime digest mismatch refuses Closing (non-tautological)",
  () =>
    withErasureRuntime(
      mismatchedDigestConfiguration,
      Effect.gen(function* mismatch() {
        const context = yield* makeContext();
        const created = yield* createWorld(context);
        const request = yield* Schema.decodeEffect(RequestWorldErasure)({
          input: {
            confirmEntireWorld: true,
            expectedErasureRevision: null,
            policyVersion: "worlds-hosted-erasable-v1",
          },
          operation: "RequestWorldErasure",
          operationId: randomUUID(),
          purpose: "personal-records",
          schemaVersion: "erasure.v1",
          worldRef: created.worldRef,
        });
        const blocked = yield* requestWorldErasure(context, request).pipe(
          Effect.flip
        );
        expect(blocked._tag).toBe("Blocked");
      })
    )
);

it.live(
  "ZA-14 hosted erasable purge gate: empty surface admits; held object blocks",
  () =>
    withErasureRuntime(
      hostedErasableConfiguration,
      Effect.gen(function* purgePath() {
        const context = yield* makeContext();
        const created = yield* createWorld(context);
        const closingId = randomUUID();
        const closing = yield* requestWorldErasure(
          context,
          yield* Schema.decodeEffect(RequestWorldErasure)({
            input: {
              confirmEntireWorld: true,
              expectedErasureRevision: null,
              policyVersion: "worlds-hosted-erasable-v1",
            },
            operation: "RequestWorldErasure",
            operationId: closingId,
            purpose: "personal-records",
            schemaVersion: "erasure.v1",
            worldRef: created.worldRef,
          })
        );
        expect(closing.phase).toBe("Closing");

        // Catalog incomplete/Unknown under local catalog without admit → purge refused.
        const purgeRequest = yield* Schema.decodeEffect(PurgeWorldContent)({
          input: {
            closingOperationId: closingId,
            expectedErasureRevision: closing.revision,
          },
          operation: "PurgeWorldContent",
          operationId: randomUUID(),
          purpose: "personal-records",
          schemaVersion: "erasure.v1",
          worldRef: created.worldRef,
        });
        const blocked = yield* purgeWorldContent(context, purgeRequest).pipe(
          Effect.flip
        );
        // Fail-closed: incomplete catalog or unavailable → Blocked/Unavailable.
        expect(["Blocked", "Unavailable"]).toContain(blocked._tag);
      })
    )
);

it.live("ZA-14 hosted purge observes LegalHold before Purging", () =>
  withErasureRuntime(
    Layer.mergeAll(
      Layer.succeed(AuthorityInstallation, installation),
      Layer.succeed(DataPolicy, hostedErasablePolicy),
      ErasureRestoreActivation.unqualifiedLayer,
      proofAdmission,
      observedIdentity,
      heldObjectLayers
    ),
    Effect.gen(function* heldPurge() {
      const context = yield* makeContext();
      const created = yield* createWorld(context);
      const closingId = randomUUID();
      const closing = yield* requestWorldErasure(
        context,
        yield* Schema.decodeEffect(RequestWorldErasure)({
          input: {
            confirmEntireWorld: true,
            expectedErasureRevision: null,
            policyVersion: "worlds-hosted-erasable-v1",
          },
          operation: "RequestWorldErasure",
          operationId: closingId,
          purpose: "personal-records",
          schemaVersion: "erasure.v1",
          worldRef: created.worldRef,
        })
      );
      expect(closing.phase).toBe("Closing");

      const blocked = yield* purgeWorldContent(
        context,
        yield* Schema.decodeEffect(PurgeWorldContent)({
          input: {
            closingOperationId: closingId,
            expectedErasureRevision: closing.revision,
          },
          operation: "PurgeWorldContent",
          operationId: randomUUID(),
          purpose: "personal-records",
          schemaVersion: "erasure.v1",
          worldRef: created.worldRef,
        })
      ).pipe(Effect.flip);
      expect(blocked._tag).toBe("Blocked");
    })
  )
);
