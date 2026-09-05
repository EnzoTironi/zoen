-- ZN-0050: non-destructive legacy import manifests (evaluation only).
CREATE SCHEMA IF NOT EXISTS infra;

CREATE TABLE IF NOT EXISTS infra.migration_manifests (
  manifest_id uuid PRIMARY KEY,
  version text NOT NULL,
  legacy_source_commit text NOT NULL,
  realm text NOT NULL CHECK (realm IN ('evaluation','live')),
  row_counts jsonb NOT NULL,
  rights_mapping jsonb NOT NULL,
  unmatched_records jsonb NOT NULL,
  semantic_diffs jsonb NOT NULL,
  cutover_approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT evaluation_rehearsal_only CHECK (realm = 'evaluation' OR cutover_approved = true)
);

CREATE TABLE IF NOT EXISTS infra.os_production_guard (
  marker text PRIMARY KEY,
  mutated boolean NOT NULL DEFAULT false
);
