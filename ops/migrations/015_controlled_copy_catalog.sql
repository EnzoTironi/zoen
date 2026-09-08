-- Controlled copy / backup disposition catalog (ZA-12).
-- Bounded profile inventory; Unknown coverage fail-closes Full Erased / restore.
-- Keep in sync with packages/authority/src/ports/erasure/copy-catalog-pg.ts candidate DDL.

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

