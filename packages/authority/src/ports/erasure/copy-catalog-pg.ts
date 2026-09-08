import { Conflict, Unavailable } from "@zoen/contracts/worlds/errors";
import { Digest, WorldId, exact } from "@zoen/contracts/worlds/values";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";
import type { SqlError } from "effect/unstable/sql";

import { worldDisclosureKey } from "../disclosure/keys.js";
import {
  admitsFullErasureOrRestore,
  blocksAdmissionByDisposition,
  isRestoreEligible,
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
    OR (
      status IN ('BoundedComplete', 'Incomplete')
      AND evidence_ref IS NOT NULL
    )
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

const RegistrationIdentityRow = Schema.Struct({
  backing_system: ControlledCopyBackingSystem,
  generation_id: Schema.String,
  inspection_evidence: Schema.String,
  integrity_digest: Digest,
  owner_principal_id: Schema.NullOr(Schema.String.check(Schema.isUUID())),
  profile_id: Schema.String,
  realm: Schema.NullOr(Schema.Literal("live")),
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
const sameRegistrationPayload = (
  existing: typeof RegistrationIdentityRow.Type,
  decoded: ControlledCopyRegistration
): boolean =>
  existing.profile_id === decoded.profileId &&
  existing.backing_system === decoded.backingSystem &&
  existing.generation_id === decoded.generationId &&
  existing.integrity_digest === decoded.integrityDigest &&
  existing.scope_kind === decoded.scopeKind &&
  (existing.world_id ?? null) === (decoded.worldRef?.worldId ?? null) &&
  (existing.realm ?? null) === (decoded.worldRef?.realm ?? null) &&
  (existing.owner_principal_id ?? null) ===
    (decoded.ownerPrincipalId ?? null) &&
  existing.inspection_evidence === decoded.inspectionEvidence &&
  existing.rights_retention === decoded.rightsRetention;

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

    /** New registrations invalidate BoundedComplete — proof is cut-time only. */
    const invalidateCompleteCoverage = (profileId: string) =>
      sql`
        UPDATE authority.controlled_copy_coverage
        SET status = ${"Unknown"},
            evidence_ref = NULL,
            cut_at = clock_timestamp()
        WHERE profile_id = ${profileId}
          AND status = ${"BoundedComplete"}
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
      publish: (copyId) =>
        Effect.gen(function* publish() {
          const existing = yield* loadEntry(copyId);
          if (existing.disposition === "QuarantinedUnpublishable") {
            return yield* conflict();
          }
          if (existing.publishedAt !== null) {
            return existing;
          }
          // Durable Closing cut + registration order — never caller booleans.
          let worldKey = "";
          if (existing.worldRef !== null) {
            const worldId = yield* Schema.decodeEffect(WorldId)(
              existing.worldRef.worldId
            ).pipe(Effect.mapError(() => unavailable()));
            worldKey = worldDisclosureKey({
              realm: existing.worldRef.realm,
              worldId,
            });
          }
          const updated = yield* sql`
            UPDATE authority.controlled_copy_entries AS e
            SET published_at = clock_timestamp(),
                disposition = ${"AccountedActive"}
            WHERE e.copy_id = ${copyId}
              AND e.published_at IS NULL
              AND e.disposition <> ${"QuarantinedUnpublishable"}
              AND (
                e.scope_kind <> ${"world"}
                OR NOT EXISTS (
                  SELECT 1
                  FROM jobs.disclosure_world_closing AS c
                  WHERE c.world_key = ${worldKey}
                )
                OR EXISTS (
                  SELECT 1
                  FROM jobs.disclosure_world_closing AS c
                  WHERE c.world_key = ${worldKey}
                    AND e.registered_at <= c.created_at
                )
              )
            RETURNING copy_id
          `.pipe(Effect.mapError(() => unavailable()));
          if (updated.length === 1) {
            return yield* loadEntry(copyId);
          }
          const again = yield* loadEntry(copyId);
          if (again.publishedAt !== null) {
            return again;
          }
          if (again.disposition === "QuarantinedUnpublishable") {
            return yield* conflict();
          }
          return yield* unavailable();
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
            // Post-cut registration must not keep a prior BoundedComplete proof.
            yield* invalidateCompleteCoverage(decoded.profileId);
            return yield* loadEntry(decoded.copyId);
          }
          const identityRows = yield* sql`
            SELECT profile_id, backing_system, scope_kind, world_id, realm,
              owner_principal_id, generation_id, integrity_digest,
              rights_retention, inspection_evidence
            FROM authority.controlled_copy_entries
            WHERE copy_id = ${decoded.copyId}
          `.pipe(Effect.mapError(() => unavailable()));
          const identities = yield* Schema.decodeUnknownEffect(
            Schema.Array(RegistrationIdentityRow)
          )(identityRows).pipe(Effect.mapError(() => unavailable()));
          if (identities.length !== 1 || identities[0] === undefined) {
            return yield* unavailable();
          }
          if (!sameRegistrationPayload(identities[0], decoded)) {
            return yield* conflict();
          }
          return yield* loadEntry(decoded.copyId);
        }),
      requireAdmission: (profileId, purpose) =>
        Effect.gen(function* require() {
          yield* Schema.decodeEffect(
            Schema.Literals(["full-erased", "restore"])
          )(purpose).pipe(Effect.mapError(() => unavailable()));
          // FOR UPDATE pairs with caller TX (e.g. purge mutation) when present.
          yield* ensureCoverageRow(profileId);
          const covRows = yield* sql`
            SELECT profile_id, status, evidence_ref, cut_at::text AS cut_at
            FROM authority.controlled_copy_coverage
            WHERE profile_id = ${profileId}
            FOR UPDATE
          `.pipe(Effect.mapError(() => unavailable()));
          const covDecoded = yield* Schema.decodeUnknownEffect(
            Schema.Array(CoverageRow)
          )(covRows).pipe(Effect.mapError(() => unavailable()));
          if (covDecoded.length !== 1 || covDecoded[0] === undefined) {
            return yield* unavailable();
          }
          const coverage = toCoverage(covDecoded[0]);
          if (!admitsFullErasureOrRestore(coverage.status)) {
            return yield* unavailable();
          }
          // Durable invariant: complete/incomplete proofs require evidence.
          if (coverage.evidenceRef === null) {
            return yield* unavailable();
          }
          const stale = yield* sql`
            SELECT EXISTS (
              SELECT 1
              FROM authority.controlled_copy_entries AS e
              WHERE e.profile_id = ${profileId}
                AND e.registered_at > (
                  SELECT c.cut_at
                  FROM authority.controlled_copy_coverage AS c
                  WHERE c.profile_id = ${profileId}
                )
            ) AS found
          `.pipe(Effect.mapError(() => unavailable()));
          const staleDecoded = yield* Schema.decodeUnknownEffect(
            Schema.Tuple([Schema.Struct({ found: Schema.Boolean })])
          )(stale).pipe(Effect.mapError(() => unavailable()));
          if (staleDecoded[0]?.found) {
            return yield* unavailable();
          }
          const rows = yield* selectEntriesSql(profileId).pipe(
            Effect.mapError(() => unavailable())
          );
          const cut = yield* Schema.decodeUnknownEffect(Schema.Array(EntryRow))(
            rows
          ).pipe(Effect.mapError(() => unavailable()));
          // Full Erased and restore both reject Unknown / Unaccounted cuts.
          for (const row of cut) {
            if (blocksAdmissionByDisposition(toRecord(row).disposition)) {
              return yield* unavailable();
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
