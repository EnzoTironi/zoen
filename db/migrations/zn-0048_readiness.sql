-- ZN-0048: recovery fences for readiness / graceful drain (SPEC-008).
CREATE SCHEMA IF NOT EXISTS jobs;

CREATE TABLE IF NOT EXISTS jobs.recovery_fences (
  cell_id text PRIMARY KEY,
  epoch bigint NOT NULL CHECK (epoch >= 0),
  dispatch_enabled boolean NOT NULL DEFAULT false,
  deletion_ledger_cut text,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS recovery_fences_dispatch
  ON jobs.recovery_fences(dispatch_enabled, epoch);
