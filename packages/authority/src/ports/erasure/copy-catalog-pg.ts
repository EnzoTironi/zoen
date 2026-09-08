import { Conflict, Unavailable } from "@zoen/contracts/worlds/errors";
import { Digest, exact } from "@zoen/contracts/worlds/values";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";
import type { SqlError } from "effect/unstable/sql";

import {
  admitsFullErasureOrRestore,
  isRestoreEligible,
  publicationAllowedDuringClosing,
} from "./copy-catalog-laws.js";
import {
  ControlledCopyBackingSystem,
  ControlledCopyDisposition as DispositionSchema,
  ControlledCopyId as CopyIdSchema,
  ControlledCopyRegistration,
  ErasureCopyCatalog,
} from "./copy-catalog.js";
import type {
  ControlledCopyCoverage,
  ControlledCopyId,
  ControlledCopyRecord,
} from "./copy-catalog.js";

const unavailable = () => new Unavailable({ code: "UNAVAILABLE" });
const conflict = () => new Conflict({ code: "CONFLICT" });

/**
 * Candidate DDL for controlled-copy catalog. Tests apply this; root numbers
 * ops/migrations/015_controlled_copy_catalog.sql.
 */
export const controlledCopyCatalogSchemaSql = `
CREATE TABLE IF NOT EXISTS authority.controlled_copy_coverage (
  profile_id text COLLATE "C" NOT NULL PRIMARY KEY
    CHECK (char_length(profile_id) BETWEEN 1 AND 128),
  status text COLLATE "C" NOT NULL
    CHECK (status IN ('BoundedComplete', 'Incomplete', 'Unknown')),
  evidence_ref text COLLATE "C"
    CHECK (evidence_ref IS NULL OR char_length(evidence_ref) BETWEEN 1 AND 512),
  cut_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  CHECK (
    (status = 'Unknown' AND evidence_ref IS NULL)
    OR (status <> 'Unknown')
  )
);

CREATE TABLE IF NOT EXISTS authority.controlled_copy_entries (
  copy_id uuid NOT NULL PRIMARY KEY,
  profile_id text COLLATE "C" NOT NULL
    CHECK (char_length(profile_id) BETWEEN 1 AND 128),
  backing_system text COLLATE "C" NOT NULL
    CHECK (backing_system IN (
      'sql-logical-dump',
      'object-version-set',
      'host-volume-snapshot',
      'temporary-output',
      'governed-log',
      'third-party-export'
    )),
  scope_kind text COLLATE "C" NOT NULL
    CHECK (scope_kind IN ('world', 'installation', 'host')),
  world_id uuid,
  realm text COLLATE "C" CHECK (realm IS NULL OR realm = 'live'),
  owner_principal_id uuid,
  generation_id text COLLATE "C" NOT NULL
    CHECK (char_length(generation_id) BETWEEN 1 AND 256),
  integrity_digest text COLLATE "C" NOT NULL
    CHECK (integrity_digest ~ '^[0-9a-f]{64}$'),
  rights_retention text COLLATE "C" NOT NULL
    CHECK (char_length(rights_retention) BETWEEN 1 AND 128),
  inspection_evidence text COLLATE "C" NOT NULL
    CHECK (char_length(inspection_evidence) BETWEEN 1 AND 512),
  disposition text COLLATE "C" NOT NULL
    CHECK (disposition IN (
      'Erased',
      'RetainedUnderHold',
      'SuppressedOnRestore',
      'QuarantinedUnpublishable',
      'AccountedActive',
      'Unaccounted',
      'Unknown'
    )),
  registered_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  published_at timestamptz(3),
  CHECK (
    (scope_kind = 'world' AND world_id IS NOT NULL AND realm = 'live')
    OR (scope_kind <> 'world' AND world_id IS NULL AND realm IS NULL)
  ),
  CHECK (
    (disposition = 'QuarantinedUnpublishable' AND published_at IS NULL)
    OR disposition <> 'QuarantinedUnpublishable'
  ),
  FOREIGN KEY (profile_id) REFERENCES authority.controlled_copy_coverage (profile_id)
);

CREATE INDEX IF NOT EXISTS controlled_copy_entries_profile
  ON authority.controlled_copy_entries (profile_id);

CREATE INDEX IF NOT EXISTS controlled_copy_entries_world
  ON authority.controlled_copy_entries (world_id, realm)
  WHERE world_id IS NOT NULL;
`;

export const applyControlledCopyCatalogSchema = Effect.fn(
  "erasureCopyCatalog.applySchema"
)(function* applyControlledCopyCatalogSchema() {
  const sql = yield* SqlClient.SqlClient;
  yield* sql.withTransaction(sql.unsafe(controlledCopyCatalogSchemaSql));
});

const EntryRow = Schema.Struct({
  backing_system: ControlledCopyBackingSystem,
  copy_id: CopyIdSchema,
  disposition: DispositionSchema,
  generation_id: Schema.String,
  inspection_evidence: Schema.String,
  integrity_digest: Digest,
  owner_principal_id: Schema.NullOr(Schema.String.check(Schema.isUUID())),
  published_at: Schema.NullOr(Schema.String),
  realm: Schema.NullOr(Schema.Literal("live")),
  registered_at: Schema.String,
  rights_retention: Schema.String,
  scope_kind: Schema.Literals(["world", "installation", "host"]),
  world_id: Schema.NullOr(Schema.String.check(Schema.isUUID())),
}).annotate(exact);

const CoverageRow = Schema.Struct({
  cut_at: Schema.String,
  evidence_ref: Schema.NullOr(Schema.String),
  profile_id: Schema.String,
  status: Schema.Literals(["BoundedComplete", "Incomplete", "Unknown"]),
}).annotate(exact);

const toRecord = (row: typeof EntryRow.Type): ControlledCopyRecord => ({
  backingSystem: row.backing_system,
  copyId: row.copy_id,
  disposition: row.disposition,
  generationId: row.generation_id,
  inspectionEvidence: row.inspection_evidence,
  integrityDigest: row.integrity_digest,
  ownerPrincipalId: row.owner_principal_id,
  publishedAt: row.published_at,
  registeredAt: row.registered_at,
  rightsRetention: row.rights_retention,
  scopeKind: row.scope_kind,
  worldRef:
    row.world_id === null || row.realm === null
      ? null
      : { realm: row.realm, worldId: row.world_id },
});

const toCoverage = (row: typeof CoverageRow.Type): ControlledCopyCoverage => ({
  cutAt: row.cut_at,
  evidenceRef: row.evidence_ref,
  profileId: row.profile_id,
  status: row.status,
});

/**
 * Local durable copy catalog. Provide SqlClient from the authority install.
 * Defaults every profile to Unknown coverage (G-OPS fail-closed) until set.
 */
export const localErasureCopyCatalogLayer: Layer.Layer<
  ErasureCopyCatalog,
  never,
  SqlClient.SqlClient
> = Layer.effect(
  ErasureCopyCatalog,
  Effect.gen(function* buildCatalog() {
    const sql = yield* SqlClient.SqlClient;

    const ensureCoverageRow = (profileId: string) =>
      sql`
        INSERT INTO authority.controlled_copy_coverage (profile_id, status, evidence_ref)
        VALUES (${profileId}, ${"Unknown"}, NULL)
        ON CONFLICT (profile_id) DO NOTHING
      `.pipe(Effect.mapError(() => unavailable()));

    const loadEntry = (copyId: ControlledCopyId) =>
      Effect.gen(function* load() {
        const rows = yield* sql`
          SELECT copy_id, backing_system, scope_kind, world_id, realm,
            owner_principal_id, generation_id, integrity_digest, rights_retention,
            inspection_evidence, disposition,
            registered_at::text AS registered_at,
            published_at::text AS published_at
          FROM authority.controlled_copy_entries
          WHERE copy_id = ${copyId}
        `.pipe(Effect.mapError(() => unavailable()));
        const decoded = yield* Schema.decodeUnknownEffect(
          Schema.Array(EntryRow)
        )(rows).pipe(Effect.mapError(() => unavailable()));
        if (decoded.length !== 1 || decoded[0] === undefined) {
          return yield* unavailable();
        }
        return toRecord(decoded[0]);
      });

    const loadCoverage = (profileId: string) =>
      Effect.gen(function* load() {
        yield* ensureCoverageRow(profileId);
        const rows = yield* sql`
          SELECT profile_id, status, evidence_ref, cut_at::text AS cut_at
          FROM authority.controlled_copy_coverage
          WHERE profile_id = ${profileId}
        `.pipe(Effect.mapError(() => unavailable()));
        const decoded = yield* Schema.decodeUnknownEffect(
          Schema.Array(CoverageRow)
        )(rows).pipe(Effect.mapError(() => unavailable()));
        if (decoded.length !== 1 || decoded[0] === undefined) {
          return yield* unavailable();
        }
        return toCoverage(decoded[0]);
      });

    const selectEntriesSql = (
      profileId: string,
      worldRef?: {
        readonly realm: "live";
        readonly worldId: string;
      }
    ) =>
      worldRef === undefined
        ? sql`
            SELECT copy_id, backing_system, scope_kind, world_id, realm,
              owner_principal_id, generation_id, integrity_digest,
              rights_retention, inspection_evidence, disposition,
              registered_at::text AS registered_at,
              published_at::text AS published_at
            FROM authority.controlled_copy_entries
            WHERE profile_id = ${profileId}
            ORDER BY registered_at, copy_id
          `
        : sql`
            SELECT copy_id, backing_system, scope_kind, world_id, realm,
              owner_principal_id, generation_id, integrity_digest,
              rights_retention, inspection_evidence, disposition,
              registered_at::text AS registered_at,
              published_at::text AS published_at
            FROM authority.controlled_copy_entries
            WHERE profile_id = ${profileId}
              AND (
                (scope_kind = ${"world"}
                  AND world_id = ${worldRef.worldId}
                  AND realm = ${worldRef.realm})
                OR scope_kind <> ${"world"}
              )
            ORDER BY registered_at, copy_id
          `;

    return ErasureCopyCatalog.of({
      inspectCut: (profileId, worldRef) =>
        Effect.gen(function* inspect() {
          const coverage = yield* loadCoverage(profileId);
          let scoped:
            | { readonly realm: "live"; readonly worldId: string }
            | undefined;
          if (worldRef === undefined) {
            scoped = undefined;
          } else if (worldRef.realm === "live") {
            scoped = { realm: "live", worldId: worldRef.worldId };
          } else {
            return yield* unavailable();
          }
          const rows = yield* selectEntriesSql(profileId, scoped).pipe(
            Effect.mapError(() => unavailable())
          );
          const decoded = yield* Schema.decodeUnknownEffect(
            Schema.Array(EntryRow)
          )(rows).pipe(Effect.mapError(() => unavailable()));
          return {
            copies: decoded.map(toRecord),
            coverage,
          };
        }),
      publish: (copyId, opts) =>
        Effect.gen(function* publish() {
          const existing = yield* loadEntry(copyId);
          const worldClosing = opts?.worldClosing === true;
          const registeredBeforeClosing =
            opts?.registeredBeforeClosing === true;
          if (
            !publicationAllowedDuringClosing({
              alreadyRegisteredBeforeClosing: registeredBeforeClosing,
              worldClosing,
            })
          ) {
            return yield* unavailable();
          }
          if (existing.disposition === "QuarantinedUnpublishable") {
            return yield* conflict();
          }
          if (existing.publishedAt !== null) {
            return existing;
          }
          const updated = yield* sql`
            UPDATE authority.controlled_copy_entries
            SET published_at = clock_timestamp(),
                disposition = ${"AccountedActive"}
            WHERE copy_id = ${copyId}
              AND published_at IS NULL
              AND disposition <> ${"QuarantinedUnpublishable"}
            RETURNING copy_id
          `.pipe(Effect.mapError(() => unavailable()));
          if (updated.length !== 1) {
            return yield* conflict();
          }
          return yield* loadEntry(copyId);
        }),
      quarantineUnpublishable: (copyId, inspectionEvidence) =>
        Effect.gen(function* quarantine() {
          const existing = yield* loadEntry(copyId);
          if (existing.publishedAt !== null) {
            return yield* conflict();
          }
          if (existing.disposition === "QuarantinedUnpublishable") {
            return existing;
          }
          const updated = yield* sql`
            UPDATE authority.controlled_copy_entries
            SET disposition = ${"QuarantinedUnpublishable"},
                inspection_evidence = ${inspectionEvidence},
                published_at = NULL
            WHERE copy_id = ${copyId}
              AND published_at IS NULL
            RETURNING copy_id
          `.pipe(Effect.mapError(() => unavailable()));
          if (updated.length !== 1) {
            return yield* conflict();
          }
          const next = yield* loadEntry(copyId);
          if (isRestoreEligible(next)) {
            return yield* unavailable();
          }
          return next;
        }),
      recordDisposition: (copyId, disposition, inspectionEvidence) =>
        Effect.gen(function* record() {
          yield* Schema.decodeEffect(DispositionSchema)(disposition).pipe(
            Effect.mapError(() => unavailable())
          );
          if (disposition === "QuarantinedUnpublishable") {
            return yield* unavailable();
          }
          const updated = yield* sql`
            UPDATE authority.controlled_copy_entries
            SET disposition = ${disposition},
                inspection_evidence = ${inspectionEvidence}
            WHERE copy_id = ${copyId}
              AND disposition <> ${"QuarantinedUnpublishable"}
            RETURNING copy_id
          `.pipe(Effect.mapError(() => unavailable()));
          if (updated.length !== 1) {
            const existing = yield* loadEntry(copyId);
            if (existing.disposition === disposition) {
              return existing;
            }
            return yield* conflict();
          }
          return yield* loadEntry(copyId);
        }),
      register: (registration) =>
        Effect.gen(function* register() {
          const decoded = yield* Schema.decodeEffect(
            ControlledCopyRegistration
          )(registration).pipe(Effect.mapError(() => unavailable()));
          if (
            (decoded.scopeKind === "world" && decoded.worldRef === null) ||
            (decoded.scopeKind !== "world" && decoded.worldRef !== null)
          ) {
            return yield* conflict();
          }
          yield* ensureCoverageRow(decoded.profileId);
          const inserted = yield* sql`
            INSERT INTO authority.controlled_copy_entries (
              copy_id, profile_id, backing_system, scope_kind, world_id, realm,
              owner_principal_id, generation_id, integrity_digest,
              rights_retention, inspection_evidence, disposition
            ) VALUES (
              ${decoded.copyId}, ${decoded.profileId}, ${decoded.backingSystem},
              ${decoded.scopeKind},
              ${decoded.worldRef?.worldId ?? null},
              ${decoded.worldRef?.realm ?? null},
              ${decoded.ownerPrincipalId},
              ${decoded.generationId}, ${decoded.integrityDigest},
              ${decoded.rightsRetention}, ${decoded.inspectionEvidence},
              ${"Unaccounted"}
            )
            ON CONFLICT (copy_id) DO NOTHING
            RETURNING copy_id
          `.pipe(
            Effect.catchTag("SqlError", (error: SqlError.SqlError) => {
              if (error.reason._tag === "UniqueViolation") {
                return Effect.succeed([] as readonly unknown[]);
              }
              return Effect.fail(unavailable());
            })
          );
          if (inserted.length > 0) {
            return yield* loadEntry(decoded.copyId);
          }
          const existing = yield* loadEntry(decoded.copyId);
          if (
            existing.backingSystem !== decoded.backingSystem ||
            existing.generationId !== decoded.generationId ||
            existing.integrityDigest !== decoded.integrityDigest ||
            existing.scopeKind !== decoded.scopeKind ||
            (existing.worldRef?.worldId ?? null) !==
              (decoded.worldRef?.worldId ?? null)
          ) {
            return yield* conflict();
          }
          return existing;
        }),
      requireAdmission: (profileId, purpose) =>
        Effect.gen(function* require() {
          yield* Schema.decodeEffect(
            Schema.Literals(["full-erased", "restore"])
          )(purpose).pipe(Effect.mapError(() => unavailable()));
          const coverage = yield* loadCoverage(profileId);
          if (!admitsFullErasureOrRestore(coverage.status)) {
            return yield* unavailable();
          }
          if (purpose === "restore") {
            const rows = yield* selectEntriesSql(profileId).pipe(
              Effect.mapError(() => unavailable())
            );
            const cut = yield* Schema.decodeUnknownEffect(
              Schema.Array(EntryRow)
            )(rows).pipe(Effect.mapError(() => unavailable()));
            for (const row of cut) {
              const record = toRecord(row);
              if (
                record.disposition === "Unknown" ||
                record.disposition === "Unaccounted"
              ) {
                return yield* unavailable();
              }
            }
          }
          return coverage;
        }),
      setCoverage: (profileId, status, evidenceRef) =>
        Effect.gen(function* set() {
          yield* Schema.decodeEffect(
            Schema.Literals(["BoundedComplete", "Incomplete", "Unknown"])
          )(status).pipe(Effect.mapError(() => unavailable()));
          if (status === "Unknown" && evidenceRef !== null) {
            return yield* conflict();
          }
          if (status !== "Unknown" && evidenceRef === null) {
            return yield* conflict();
          }
          yield* ensureCoverageRow(profileId);
          yield* sql`
            INSERT INTO authority.controlled_copy_coverage (
              profile_id, status, evidence_ref, cut_at
            ) VALUES (
              ${profileId}, ${status}, ${evidenceRef}, clock_timestamp()
            )
            ON CONFLICT (profile_id) DO UPDATE
              SET status = EXCLUDED.status,
                  evidence_ref = EXCLUDED.evidence_ref,
                  cut_at = clock_timestamp()
          `.pipe(Effect.mapError(() => unavailable()));
          return yield* loadCoverage(profileId);
        }),
    });
  })
);
