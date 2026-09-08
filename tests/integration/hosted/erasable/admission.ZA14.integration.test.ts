import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { DateTime, Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { makeWorldsPostgresLayer } from "../../../../apps/server/src/adapters/postgres/worlds/postgres.js";
import { withWorldsDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.js";
import {
  AuthorityInstallation,
  AuthorityInstallationSchema,
} from "../../../../packages/authority/src/commit/configuration.js";
import { createPersonalWorld } from "../../../../packages/authority/src/commit/genesis.js";
import {
  HostedErasableAdmission,
  currentHostedErasableQualification,
  evaluateHostedErasableAdmission,
  gatesAdmitFullHostedErased,
  refuseProtectedResource,
} from "../../../../packages/authority/src/hosted/erasable/admission.js";
import { requestWorldErasure } from "../../../../packages/authority/src/knowledge/erasure/handlers/request.js";
import { applyWorldErasureSchema } from "../../../../packages/authority/src/knowledge/erasure/schema.js";
import {
  ErasureAttemptRegister,
  blocksWorldContentAdmission,
} from "../../../../packages/authority/src/ports/erasure/attempt-register.js";
import {
  applyErasureAttemptSchema,
  localErasureAttemptRegisterLayer,
} from "../../../../packages/authority/src/ports/erasure/local-pg.js";
import { ErasureRestoreActivation } from "../../../../packages/authority/src/ports/erasure/restore-activation.js";
import {
  DataPolicy,
  HostedErasableDataPolicySchema,
  HostedRetainedDataPolicySchema,
  VerifiedRequestContext,
} from "../../../../packages/authority/src/ports/worlds/context.js";
import { digestBytes } from "../../../../packages/authority/src/values/canonical.js";
import { RequestWorldErasure } from "../../../../packages/contracts/src/erasure/operations.js";
import { HostedErasableTarget } from "../../../../packages/contracts/src/hosted/erasable/values.js";
import { CreatePersonalWorld } from "../../../../packages/contracts/src/worlds/operations.js";

const proofTarget = Schema.decodeSync(HostedErasableTarget)({
  appName: "zoen-erasable-proof",
  bucketName: "erasable-proof-bucket",
  imageDigest: "sha256:za14-local-exact-image",
  installId: "install-za14-local-proof",
  profileId: "worlds-hosted-erasable-v1",
  volumeName: "erasable_proof_data",
});

const installation = Schema.decodeSync(AuthorityInstallationSchema)({
  cellEpoch: "1",
  cellId: randomUUID(),
  generationId: randomUUID(),
  releaseDigest: digestBytes(
    new TextEncoder().encode("ZA-14 hosted erasable local exact-image fixture")
  ),
});

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
  proofAdmission
);

const hostedRetainedConfiguration = Layer.mergeAll(
  Layer.succeed(AuthorityInstallation, installation),
  Layer.succeed(DataPolicy, hostedRetainedPolicy),
  ErasureAttemptRegister.unqualifiedLayer,
  ErasureRestoreActivation.unqualifiedLayer,
  HostedErasableAdmission.unqualifiedLayer
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
       GRANT SELECT, INSERT, UPDATE ON authority.world_erasure_progress, authority.world_erasure_receipts TO "${authorityRole}"`
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
      return yield* run.pipe(
        Effect.provide(
          Layer.mergeAll(configuration, database.authority, register)
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
