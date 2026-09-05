-- ZN-0019: owner-scoped schema migration discipline.
-- Expand → backfill → validate → contract ledger; separate DDL / authority / progress roles.
-- Runtime roles remain NOLOGIN; tests use SET ROLE from the migrator connection.

CREATE TABLE IF NOT EXISTS ontology.schema_migration_ledger (
  migration_name text NOT NULL CHECK (length(migration_name) BETWEEN 1 AND 128),
  phase text NOT NULL CHECK (phase IN ('expand','backfill','validate','contract')),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  applied_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (migration_name, phase)
);
REVOKE ALL ON ontology.schema_migration_ledger FROM PUBLIC;

-- Progress-only role: lease/progress on jobs.outbox; never authority semantic writes.
DO $block$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zoen_authority') THEN
    CREATE ROLE zoen_authority NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zoen_progress') THEN
    CREATE ROLE zoen_progress NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zoen_outbox') THEN
    CREATE ROLE zoen_outbox NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$block$;

GRANT USAGE ON SCHEMA ontology, jobs TO zoen_authority;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA ontology TO zoen_authority;
GRANT UPDATE ON ontology.worlds, ontology.memberships, ontology.domains, ontology.sources TO zoen_authority;
GRANT INSERT ON jobs.outbox TO zoen_authority;
-- Authority must not own DDL or rewrite immutable authority history.
REVOKE CREATE ON SCHEMA ontology, jobs FROM zoen_authority;
REVOKE UPDATE, DELETE ON ontology.commits, ontology.receipts, ontology.operations,
  ontology.bootstrap_operations, ontology.schema_migration_ledger FROM zoen_authority;

-- Progress-only: outbox lease fields; no ontology DML.
GRANT USAGE ON SCHEMA jobs TO zoen_progress;
GRANT SELECT, UPDATE ON jobs.outbox TO zoen_progress;
REVOKE ALL ON SCHEMA ontology FROM zoen_progress;
GRANT zoen_progress TO zoen_outbox;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
