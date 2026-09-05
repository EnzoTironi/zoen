import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { NodeFileSystem } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { DateTime, Effect, FileSystem, Layer, Result, Schema } from "effect";
import type { Redacted } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withStorage } from "../../../../apps/server/test/adapters/object-storage/d01/fixture.ts";
import { withD01IdentityDatabase } from "../../../../apps/server/test/identity/d01/database.ts";
import { createAccount } from "../../../../apps/server/test/identity/d01/http.ts";
import { grantWorldReadAccess } from "../../../../packages/authority/src/access/sharing/mutation.ts";
import {
  AuthorityInstallation,
  AuthorityInstallationSchema,
} from "../../../../packages/authority/src/commit/configuration.ts";
import { createPersonalWorld } from "../../../../packages/authority/src/commit/genesis.ts";
import { importEvidence } from "../../../../packages/authority/src/evidence/d01/import.ts";
import {
  Presence,
  VerifiedRequestContext,
} from "../../../../packages/authority/src/ports/d01/context.ts";
import {
  canonicalJson,
  digestBytes,
} from "../../../../packages/authority/src/values/canonical.ts";
import {
  CreatePersonalWorld,
  ImportEvidence,
} from "../../../../packages/contracts/src/d01/operations.ts";
import type { WorldRef } from "../../../../packages/contracts/src/d01/values.ts";
import { GrantWorldReadAccess } from "../../../../packages/contracts/src/sharing/operations.ts";
import { configuration } from "../../d01/commit/fixture.ts";

type Fixture = Parameters<Parameters<typeof withD01IdentityDatabase>[0]>[0];
const installSharing = (fixture: Fixture) =>
  Effect.gen(function* installSharingSchema() {
    const source = yield* FileSystem.FileSystem.use((fs) =>
      fs.readFileString(
        fileURLToPath(
          new URL(
            "../../../../ops/migrations/005_world_read_membership.sql",
            import.meta.url
          )
        )
      )
    );
    yield* SqlClient.SqlClient.use((sql) =>
      sql.withTransaction(sql.unsafe(source))
    );
  }).pipe(
    Effect.provide(
      Layer.mergeAll(NodeFileSystem.layer, fixture.database.migration)
    )
  );
const contextFromCredential = Effect.fn("review.contextFromCredential")(
  function* contextFromCredential(credential: Redacted.Redacted) {
    const presence = yield* Presence;
    const verified = yield* presence.verify(credential);
    const now = yield* DateTime.now;
    return yield* Schema.decodeEffect(VerifiedRequestContext)({
      deadline: DateTime.formatIso(DateTime.add(now, { seconds: 30 })),
      presence: verified,
      purpose: "personal-records",
    });
  }
);
const createRequest = () =>
  Schema.decodeEffect(CreatePersonalWorld)({
    input: {},
    operation: "CreatePersonalWorld",
    operationId: randomUUID(),
    purpose: "personal-records",
    schemaVersion: "d01.v1",
  });
const importRequest = (worldRef: WorldRef, revision = "1") =>
  Effect.gen(function* prepareImportRequest() {
    const document = yield* canonicalJson({
      records: [
        {
          externalId: "r1",
          predicate: "obligation.amount",
          subjectKey: "A",
          validTime: {
            _tag: "DateInterval",
            from: "2026-09-01",
            to: "2026-10-01",
          },
          value: {
            _tag: "Known",
            amount: revision === "1" ? "100" : "200",
            currency: "BRL",
          },
        },
      ],
      schemaVersion: "d01.v1",
      source: {
        externalId: "billing",
        label: `Original ${revision}`,
        namespace: "manual",
        revision,
      },
    });
    return yield* Schema.decodeEffect(ImportEvidence)({
      input: { document },
      operation: "ImportEvidence",
      operationId: randomUUID(),
      purpose: "personal-records",
      schemaVersion: "d01.v1",
      worldRef,
    });
  });
const grantRequest = (worldRef: WorldRef, principalRef: string) =>
  Schema.decodeEffect(GrantWorldReadAccess)({
    input: { expectedRevision: null, principalRef },
    operation: "GrantWorldReadAccess",
    operationId: randomUUID(),
    purpose: "personal-records",
    schemaVersion: "d03.sharing.v1",
    worldRef,
  });

it.live(
  "independent sharing replay preserves the installation guards of the existing mutation path",
  () =>
    withD01IdentityDatabase((fixture) =>
      Effect.gen(function* setup() {
        yield* installSharing(fixture);
        return yield* withStorage(() =>
          Effect.gen(function* installationReplay() {
            const owner = yield* createAccount(fixture.config.baseUrl);
            const viewer = yield* createAccount(fixture.config.baseUrl);
            const context = yield* contextFromCredential(owner.credential);
            const created = yield* createPersonalWorld(
              context,
              yield* createRequest()
            );
            const imported = yield* importRequest(created.worldRef);
            yield* importEvidence(context, imported);
            const grant = yield* grantRequest(created.worldRef, viewer.user.id);
            const granted = yield* grantWorldReadAccess(context, grant);
            expect(yield* grantWorldReadAccess(context, grant)).toStrictEqual(
              granted
            );
            const installation = yield* AuthorityInstallation;
            const observations: {
              dimension: string;
              importResult: string;
              sharingResult: string;
            }[] = [];
            for (const [dimension, changed] of [
              ["cellId", { ...installation, cellId: randomUUID() }],
              [
                "cellEpoch",
                {
                  ...installation,
                  cellEpoch: (BigInt(installation.cellEpoch) + 1n).toString(),
                },
              ],
              ["generationId", { ...installation, generationId: randomUUID() }],
              [
                "releaseDigest",
                {
                  ...installation,
                  releaseDigest: digestBytes(
                    new TextEncoder().encode(
                      "independent different executable release"
                    )
                  ),
                },
              ],
            ] as const) {
              const alternate = yield* Schema.decodeEffect(
                AuthorityInstallationSchema
              )(changed);
              const oldPath = yield* importEvidence(context, imported).pipe(
                Effect.provideService(AuthorityInstallation, alternate),
                Effect.result
              );
              const sharingPath = yield* grantWorldReadAccess(
                context,
                grant
              ).pipe(
                Effect.provideService(AuthorityInstallation, alternate),
                Effect.result
              );
              observations.push({
                dimension,
                importResult: Result.isFailure(oldPath)
                  ? oldPath.failure._tag
                  : oldPath.success._tag,
                sharingResult: Result.isFailure(sharingPath)
                  ? sharingPath.failure._tag
                  : sharingPath.success._tag,
              });
            }
            expect(observations).toStrictEqual(
              ["cellId", "cellEpoch", "generationId", "releaseDigest"].map(
                (dimension) => ({
                  dimension,
                  importResult: "Stale",
                  sharingResult: "Stale",
                })
              )
            );
          }).pipe(
            Effect.provide(
              Layer.mergeAll(
                configuration,
                fixture.database.authority,
                fixture.runtime
              )
            )
          )
        );
      })
    )
);
