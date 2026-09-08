import { createHash, randomUUID } from "node:crypto";

import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withWorldsDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.js";
import { Digest } from "../../../../packages/contracts/src/worlds/values.js";
import { createPersonalWorld } from "../../../../packages/ontology/src/commit/genesis.js";
import { isRestoreEligible } from "../../../../packages/ontology/src/knowledge/erasure/copy-catalog.js";
import {
  applyControlledCopyCatalogSchema,
  localErasureCopyCatalogLayer,
} from "../../../../packages/ontology/src/ports/erasure/copy-catalog-pg.js";
import { ErasureCopyCatalog } from "../../../../packages/ontology/src/ports/erasure/copy-catalog.js";
import { withLogicalDumpRestore } from "./dump-restore.js";
import {
  hostedConfiguration,
  hostedRetainedPolicy,
  makeContext,
  makeCreateWorld,
} from "./fixture.js";

const digestOf = (material: string) =>
  Schema.decodeSync(Digest)(
    createHash("sha256").update(material, "utf-8").digest("hex")
  );

const HOSTED_PROFILE = "worlds-hosted-retained-v1";

const liveRef = (worldRef: {
  readonly realm: string;
  readonly worldId: string;
}) => {
  if (worldRef.realm !== "live") {
    throw new Error("ZA-12 hosted fixture requires live World");
  }
  return { realm: "live" as const, worldId: worldRef.worldId };
};

const grantCatalog = Effect.fn("ZA12.hosted.grantCatalog")(
  function* grantCatalog(authorityRole: string) {
    const sql = yield* SqlClient.SqlClient;
    const role = authorityRole.replaceAll('"', "");
    yield* sql.unsafe(
      `GRANT SELECT, INSERT, UPDATE ON authority.controlled_copy_coverage, authority.controlled_copy_entries TO "${role}"`
    );
  }
);

/**
 * ZA-12 hosted seam: real pg_dump/restore plus catalog registration.
 * G-OPS Unknown remains fail-closed — no invented hosted completeness.
 */
it.live(
  "ZA-12 hosted: register logical dump before restore eligibility; G-OPS Unknown blocks admission",
  () =>
    withWorldsDatabase((database) =>
      Effect.gen(function* hostedCatalog() {
        yield* Effect.gen(function* migrate() {
          yield* applyControlledCopyCatalogSchema();
          yield* grantCatalog(database.names.authority);
        }).pipe(Effect.provide(database.migration));

        const catalogLayer = localErasureCopyCatalogLayer.pipe(
          Layer.provide(database.authority)
        );

        return yield* Effect.gen(function* body() {
          const catalog = yield* ErasureCopyCatalog;
          const context = yield* makeContext();
          const created = yield* createPersonalWorld(
            context,
            yield* makeCreateWorld()
          );

          // Hosted/G-OPS unread → Unknown → fail-closed.
          const gOps = yield* catalog.inspectCut(HOSTED_PROFILE);
          expect(gOps.coverage.status).toBe("Unknown");
          const blocked = yield* catalog
            .requireAdmission(HOSTED_PROFILE, "restore")
            .pipe(Effect.flip);
          expect(blocked).toMatchObject({
            _tag: "Unavailable",
            code: "UNAVAILABLE",
          });
          expect(hostedRetainedPolicy.restoreAfterErasure).toBeFalsy();

          const copyId = randomUUID();
          const generationId = `ex37-dump-${copyId}`;
          yield* catalog.register({
            backingSystem: "sql-logical-dump",
            copyId,
            generationId,
            inspectionEvidence: "hosted/local-disposable-pg_dump",
            integrityDigest: digestOf(generationId),
            ownerPrincipalId: context.presence.principalId,
            profileId: HOSTED_PROFILE,
            rightsRetention: "while-pinned",
            scopeKind: "world",
            worldRef: liveRef(created.worldRef),
          });
          // Must register before publish/eligibility.
          const beforePublish = yield* catalog.inspectCut(
            HOSTED_PROFILE,
            created.worldRef
          );
          const [pending] = beforePublish.copies;
          expect(pending).toBeDefined();
          if (pending === undefined) {
            return;
          }
          expect(pending.publishedAt).toBeNull();
          expect(isRestoreEligible(pending)).toBeFalsy();

          yield* catalog.publish(copyId);
          yield* catalog.recordDisposition(
            copyId,
            "AccountedActive",
            "hosted/local-disposable-pg_dump-published"
          );

          // Still Unknown for G-OPS — bounded local dump does not clear hosted ops.
          const stillUnknown = yield* catalog
            .requireAdmission(HOSTED_PROFILE, "restore")
            .pipe(Effect.flip);
          expect(stillUnknown).toMatchObject({ code: "UNAVAILABLE" });

          yield* withLogicalDumpRestore(database.urls.migration, (restored) =>
            Effect.gen(function* verify() {
              expect(restored.sourceDatabase.length).toBeGreaterThan(0);
              expect(
                restored.targetDatabase.startsWith("ex37_restore_")
              ).toBeTruthy();
              // Catalog disposition still explains the controlled dump copy.
              const cut = yield* catalog.inspectCut(
                HOSTED_PROFILE,
                created.worldRef
              );
              expect(cut.copies).toHaveLength(1);
              expect(cut.copies[0]?.generationId).toBe(generationId);
              expect(cut.copies[0]?.disposition).toBe("AccountedActive");
              expect(cut.coverage.status).toBe("Unknown");
            }).pipe(Effect.provide(catalogLayer))
          );
        }).pipe(
          Effect.provide(
            Layer.mergeAll(
              hostedConfiguration,
              database.authority,
              catalogLayer,
              NodeServices.layer
            )
          )
        );
      })
    )
);
