import { createHash, randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withWorldsDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.js";
import { createPersonalWorld } from "../../../../packages/authority/src/commit/genesis.js";
import {
  copyBelongsToWorld,
  isExplainedDisposition,
  isRestoreEligible,
} from "../../../../packages/authority/src/knowledge/erasure/copy-catalog.js";
import { worldDisclosureKey } from "../../../../packages/authority/src/ports/disclosure/keys.js";
import { ErasureAttemptRegister } from "../../../../packages/authority/src/ports/erasure/attempt-register.js";
import {
  applyControlledCopyCatalogSchema,
  localErasureCopyCatalogLayer,
} from "../../../../packages/authority/src/ports/erasure/copy-catalog-pg.js";
import { ErasureCopyCatalog } from "../../../../packages/authority/src/ports/erasure/copy-catalog.js";
import { CreatePersonalWorld } from "../../../../packages/contracts/src/worlds/operations.js";
import {
  Digest,
  WorldId,
} from "../../../../packages/contracts/src/worlds/values.js";
import { erasableConfiguration, makeContext } from "./fixture.js";

const digestOf = (material: string) =>
  Schema.decodeSync(Digest)(
    createHash("sha256").update(material, "utf-8").digest("hex")
  );

const grantCatalog = Effect.fn("ZA12.grantCatalog")(function* grantCatalog(
  authorityRole: string
) {
  const sql = yield* SqlClient.SqlClient;
  const role = authorityRole.replaceAll('"', "");
  yield* sql.unsafe(
    `GRANT SELECT, INSERT, UPDATE ON authority.controlled_copy_coverage, authority.controlled_copy_entries TO "${role}"`
  );
});

const withCatalogRuntime = <A, E, R>(run: Effect.Effect<A, E, R>) =>
  withWorldsDatabase((database) =>
    Effect.gen(function* prepare() {
      yield* Effect.gen(function* migrate() {
        yield* applyControlledCopyCatalogSchema();
        yield* grantCatalog(database.names.authority);
      }).pipe(Effect.provide(database.migration));

      const catalog = localErasureCopyCatalogLayer.pipe(
        Layer.provide(database.authority)
      );
      return yield* run.pipe(
        Effect.provide(
          Layer.mergeAll(
            erasableConfiguration,
            ErasureAttemptRegister.unqualifiedLayer,
            database.authority,
            catalog
          )
        )
      );
    })
  );

const createWorld = Effect.fn("ZA12.createWorld")(function* createWorld(
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

const PROFILE = "worlds-local-erasable-v1";

const liveRef = (worldRef: {
  readonly realm: string;
  readonly worldId: string;
}) => {
  if (worldRef.realm !== "live") {
    throw new Error("ZA-12 fixture requires live World");
  }
  return { realm: "live" as const, worldId: worldRef.worldId };
};

it.live(
  "ZA-12-01: two Worlds; scoped catalog explains target dispositions without touching the other",
  () =>
    withCatalogRuntime(
      Effect.gen(function* twoWorlds() {
        const ctxA = yield* makeContext();
        const ctxB = yield* makeContext();
        const worldA = yield* createWorld(ctxA);
        const worldB = yield* createWorld(ctxB);
        const catalog = yield* ErasureCopyCatalog;

        const copyA = randomUUID();
        const copyB = randomUUID();
        yield* catalog.register({
          backingSystem: "sql-logical-dump",
          copyId: copyA,
          generationId: `dump-a-${copyA}`,
          inspectionEvidence: "local/pg_dump/world-a",
          integrityDigest: digestOf(`a:${copyA}`),
          ownerPrincipalId: ctxA.presence.principalId,
          profileId: PROFILE,
          rightsRetention: "while-pinned",
          scopeKind: "world",
          worldRef: liveRef(worldA.worldRef),
        });
        yield* catalog.publish(copyA);
        yield* catalog.recordDisposition(
          copyA,
          "Erased",
          "local/pg_dump/world-a-purged"
        );

        yield* catalog.register({
          backingSystem: "object-version-set",
          copyId: copyB,
          generationId: `objects-b-${copyB}`,
          inspectionEvidence: "local/object-versions/world-b",
          integrityDigest: digestOf(`b:${copyB}`),
          ownerPrincipalId: ctxB.presence.principalId,
          profileId: PROFILE,
          rightsRetention: "while-pinned",
          scopeKind: "world",
          worldRef: liveRef(worldB.worldRef),
        });
        yield* catalog.publish(copyB);
        yield* catalog.recordDisposition(
          copyB,
          "AccountedActive",
          "local/object-versions/world-b-intact"
        );

        yield* catalog.setCoverage(
          PROFILE,
          "BoundedComplete",
          "local/za12-01-cut"
        );

        const cutA = yield* catalog.inspectCut(PROFILE, worldA.worldRef);
        expect(cutA.coverage.status).toBe("BoundedComplete");
        expect(cutA.copies).toHaveLength(1);
        const [rowA] = cutA.copies;
        expect(rowA).toBeDefined();
        if (rowA === undefined) {
          return;
        }
        expect(rowA.copyId).toBe(copyA);
        expect(rowA.disposition).toBe("Erased");
        expect(isExplainedDisposition(rowA.disposition)).toBeTruthy();
        expect(
          copyBelongsToWorld(rowA, worldA.worldRef.worldId, "live")
        ).toBeTruthy();
        expect(
          copyBelongsToWorld(rowA, worldB.worldRef.worldId, "live")
        ).toBeFalsy();

        const cutB = yield* catalog.inspectCut(PROFILE, worldB.worldRef);
        expect(cutB.copies).toHaveLength(1);
        const [rowB] = cutB.copies;
        expect(rowB).toBeDefined();
        if (rowB === undefined) {
          return;
        }
        expect(rowB.copyId).toBe(copyB);
        expect(rowB.disposition).toBe("AccountedActive");
        expect(isRestoreEligible(rowB)).toBeTruthy();

        const sql = yield* SqlClient.SqlClient;
        const worlds = yield* sql`
          SELECT world_id::text AS world_id FROM authority.worlds
          ORDER BY world_id
        `;
        expect(worlds).toHaveLength(2);
      })
    )
);

it.live(
  "ZA-12-02: Unknown coverage / missing generation blocks Full Erased and restore admission",
  () =>
    withCatalogRuntime(
      Effect.gen(function* unknownBlocks() {
        const catalog = yield* ErasureCopyCatalog;
        // Default coverage is Unknown (G-OPS fail-closed).
        const unknown = yield* catalog
          .requireAdmission(PROFILE, "full-erased")
          .pipe(Effect.flip);
        expect(unknown).toMatchObject({
          _tag: "Unavailable",
          code: "UNAVAILABLE",
        });

        const restoreUnknown = yield* catalog
          .requireAdmission(PROFILE, "restore")
          .pipe(Effect.flip);
        expect(restoreUnknown).toMatchObject({
          _tag: "Unavailable",
          code: "UNAVAILABLE",
        });

        const cut = yield* catalog.inspectCut(PROFILE);
        expect(cut.coverage.status).toBe("Unknown");
        expect(cut.copies).toHaveLength(0);

        // Incomplete also blocks; missing generation stays Unaccounted.
        const copyId = randomUUID();
        yield* catalog.register({
          backingSystem: "sql-logical-dump",
          copyId,
          generationId: `orphan-${copyId}`,
          inspectionEvidence: "local/missing-generation",
          integrityDigest: digestOf(`orphan:${copyId}`),
          ownerPrincipalId: null,
          profileId: PROFILE,
          rightsRetention: "while-pinned",
          scopeKind: "installation",
          worldRef: null,
        });
        yield* catalog.setCoverage(
          PROFILE,
          "Incomplete",
          "local/za12-02-incomplete"
        );
        const incomplete = yield* catalog
          .requireAdmission(PROFILE, "restore")
          .pipe(Effect.flip);
        expect(incomplete).toMatchObject({ code: "UNAVAILABLE" });

        // BoundedComplete still fails Full Erased and restore while Unaccounted.
        yield* catalog.setCoverage(
          PROFILE,
          "BoundedComplete",
          "local/za12-02-complete-but-unaccounted"
        );
        const unaccountedRestore = yield* catalog
          .requireAdmission(PROFILE, "restore")
          .pipe(Effect.flip);
        expect(unaccountedRestore).toMatchObject({ code: "UNAVAILABLE" });
        const unaccountedFull = yield* catalog
          .requireAdmission(PROFILE, "full-erased")
          .pipe(Effect.flip);
        expect(unaccountedFull).toMatchObject({ code: "UNAVAILABLE" });

        yield* catalog.publish(copyId);
        yield* catalog.recordDisposition(
          copyId,
          "SuppressedOnRestore",
          "local/za12-02-suppressed"
        );
        const admittedRestore = yield* catalog.requireAdmission(
          PROFILE,
          "restore"
        );
        expect(admittedRestore.status).toBe("BoundedComplete");
        const admittedFull = yield* catalog.requireAdmission(
          PROFILE,
          "full-erased"
        );
        expect(admittedFull.status).toBe("BoundedComplete");
      })
    )
);

const markWorldClosing = Effect.fn("ZA12.markWorldClosing")(
  function* markWorldClosing(worldRef: {
    readonly realm: "live";
    readonly worldId: string;
  }) {
    const sql = yield* SqlClient.SqlClient;
    const worldKey = worldDisclosureKey({
      realm: worldRef.realm,
      worldId: Schema.decodeSync(WorldId)(worldRef.worldId),
    });
    yield* sql`
      INSERT INTO jobs.disclosure_subjects (subject_key, revision)
      VALUES (${worldKey}, 0)
      ON CONFLICT (subject_key) DO NOTHING
    `;
    yield* sql`
      INSERT INTO jobs.disclosure_world_closing (world_key)
      VALUES (${worldKey})
      ON CONFLICT (world_key) DO NOTHING
    `;
  }
);

it.live(
  "ZA-12-03: Closing race → quarantine unpublishable; ordered registration may publish",
  () =>
    withCatalogRuntime(
      Effect.gen(function* closingRace() {
        const ctx = yield* makeContext();
        const world = yield* createWorld(ctx);
        const catalog = yield* ErasureCopyCatalog;
        const scoped = liveRef(world.worldRef);

        // Closing first, then register → publish must fail closed from durable state.
        yield* markWorldClosing(scoped);
        const raced = randomUUID();
        yield* catalog.register({
          backingSystem: "temporary-output",
          copyId: raced,
          generationId: `race-${raced}`,
          inspectionEvidence: "local/tmp/race-during-closing",
          integrityDigest: digestOf(`race:${raced}`),
          ownerPrincipalId: ctx.presence.principalId,
          profileId: PROFILE,
          rightsRetention: "while-pinned",
          scopeKind: "world",
          worldRef: scoped,
        });
        const blockedPublish = yield* catalog.publish(raced).pipe(Effect.flip);
        expect(blockedPublish).toMatchObject({ code: "UNAVAILABLE" });

        const quarantined = yield* catalog.quarantineUnpublishable(
          raced,
          "local/tmp/race-quarantined"
        );
        expect(quarantined.disposition).toBe("QuarantinedUnpublishable");
        expect(quarantined.publishedAt).toBeNull();
        expect(isRestoreEligible(quarantined)).toBeFalsy();

        // Fresh World: register before Closing, then mark Closing — publish allowed.
        const ctxOrdered = yield* makeContext();
        const worldOrdered = yield* createWorld(ctxOrdered);
        const scopedOrdered = liveRef(worldOrdered.worldRef);
        const ordered = randomUUID();
        yield* catalog.register({
          backingSystem: "sql-logical-dump",
          copyId: ordered,
          generationId: `ordered-${ordered}`,
          inspectionEvidence: "local/pg_dump/pre-closing",
          integrityDigest: digestOf(`ordered:${ordered}`),
          ownerPrincipalId: ctxOrdered.presence.principalId,
          profileId: PROFILE,
          rightsRetention: "while-pinned",
          scopeKind: "world",
          worldRef: scopedOrdered,
        });
        yield* markWorldClosing(scopedOrdered);
        const published = yield* catalog.publish(ordered);
        expect(published.disposition).toBe("AccountedActive");
        expect(published.publishedAt).not.toBeNull();
        expect(isRestoreEligible(published)).toBeTruthy();

        yield* catalog.setCoverage(
          PROFILE,
          "BoundedComplete",
          "local/za12-03-cut"
        );
        // Quarantined is explained; Unaccounted would block — publish covered it.
        yield* catalog.recordDisposition(
          ordered,
          "SuppressedOnRestore",
          "local/za12-03-suppressed"
        );
        const admitted = yield* catalog.requireAdmission(
          PROFILE,
          "full-erased"
        );
        expect(admitted.status).toBe("BoundedComplete");
      })
    )
);

it.live(
  "ZA-12-04: register after BoundedComplete invalidates proof; replay conflicts on profile/evidence",
  () =>
    withCatalogRuntime(
      Effect.gen(function* staleAndReplay() {
        const catalog = yield* ErasureCopyCatalog;
        const first = randomUUID();
        yield* catalog.register({
          backingSystem: "sql-logical-dump",
          copyId: first,
          generationId: `first-${first}`,
          inspectionEvidence: "local/first",
          integrityDigest: digestOf(`first:${first}`),
          ownerPrincipalId: null,
          profileId: PROFILE,
          rightsRetention: "while-pinned",
          scopeKind: "installation",
          worldRef: null,
        });
        yield* catalog.publish(first);
        yield* catalog.recordDisposition(
          first,
          "AccountedActive",
          "local/first-active"
        );
        yield* catalog.setCoverage(
          PROFILE,
          "BoundedComplete",
          "local/za12-04-cut"
        );
        const admitted = yield* catalog.requireAdmission(PROFILE, "restore");
        expect(admitted.status).toBe("BoundedComplete");

        // Post-cut registration must invalidate completeness.
        const second = randomUUID();
        yield* catalog.register({
          backingSystem: "object-version-set",
          copyId: second,
          generationId: `second-${second}`,
          inspectionEvidence: "local/second",
          integrityDigest: digestOf(`second:${second}`),
          ownerPrincipalId: null,
          profileId: PROFILE,
          rightsRetention: "while-pinned",
          scopeKind: "installation",
          worldRef: null,
        });
        const cut = yield* catalog.inspectCut(PROFILE);
        expect(cut.coverage.status).toBe("Unknown");
        const blocked = yield* catalog
          .requireAdmission(PROFILE, "full-erased")
          .pipe(Effect.flip);
        expect(blocked).toMatchObject({ code: "UNAVAILABLE" });

        // Same copyId with different profile/evidence → Conflict (not silent replay).
        const conflicted = yield* catalog
          .register({
            backingSystem: "sql-logical-dump",
            copyId: first,
            generationId: `first-${first}`,
            inspectionEvidence: "local/first-DIFFERENT",
            integrityDigest: digestOf(`first:${first}`),
            ownerPrincipalId: null,
            profileId: PROFILE,
            rightsRetention: "while-pinned",
            scopeKind: "installation",
            worldRef: null,
          })
          .pipe(Effect.flip);
        expect(conflicted).toMatchObject({
          _tag: "Conflict",
          code: "CONFLICT",
        });

        const profileConflict = yield* catalog
          .register({
            backingSystem: "sql-logical-dump",
            copyId: first,
            generationId: `first-${first}`,
            inspectionEvidence: "local/first",
            integrityDigest: digestOf(`first:${first}`),
            ownerPrincipalId: null,
            profileId: "worlds-hosted-retained-v1",
            rightsRetention: "while-pinned",
            scopeKind: "installation",
            worldRef: null,
          })
          .pipe(Effect.flip);
        expect(profileConflict).toMatchObject({
          _tag: "Conflict",
          code: "CONFLICT",
        });
      })
    )
);
