-- ZN-0013 presence mapping (Door). Not fed by digit-prefixed migrator until rebound;
-- component tests apply this file explicitly against disposable Postgres.
-- Better Auth adapter tables remain version-aligned separately; issuer required by BA 1.7.

CREATE SCHEMA IF NOT EXISTS door;
REVOKE ALL ON SCHEMA door FROM PUBLIC;

CREATE TABLE IF NOT EXISTS door.subject_map (
  subject_id text PRIMARY KEY,
  principal_id uuid NOT NULL UNIQUE,
  provider text NOT NULL DEFAULT 'better-auth'
    CHECK (provider ~ '^[a-z][a-z0-9_-]{0,31}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS door.revoked_sessions (
  session_token text PRIMARY KEY,
  principal_id uuid,
  revoked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reason text NOT NULL DEFAULT 'explicit'
);

-- Align Better Auth 1.7 account shape when using public adapter tables in harness.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'account'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'account' AND column_name = 'issuer'
  ) THEN
    ALTER TABLE public.account ADD COLUMN issuer text;
  END IF;
END $$;
