-- Minimal door tables for role grants (avoid reserved index name session_user from 0002_door.sql).
CREATE TABLE IF NOT EXISTS door.subject_map (
  subject_id text PRIMARY KEY,
  principal_id uuid NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS door."user" (
  id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false, image text,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS door.session (
  id text PRIMARY KEY, "expiresAt" timestamptz NOT NULL, token text NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "ipAddress" text, "userAgent" text,
  "userId" text NOT NULL REFERENCES door."user"(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS door_session_by_user ON door.session("userId");
REVOKE ALL ON ALL TABLES IN SCHEMA door FROM PUBLIC;

-- ZN-0018: runtime roles for Door / Eve / channel / authority least privilege.
-- Extends db/roles.sql with eve + channels schemas and login-less runtime roles.
-- Passwords are never stored here; tests use SET ROLE from the migrator.

CREATE SCHEMA IF NOT EXISTS eve;
CREATE SCHEMA IF NOT EXISTS channels;
REVOKE ALL ON SCHEMA eve, channels FROM PUBLIC;

DO $block$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zoen_authority') THEN
    CREATE ROLE zoen_authority NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zoen_door') THEN
    CREATE ROLE zoen_door NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zoen_eve') THEN
    CREATE ROLE zoen_eve NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zoen_channel') THEN
    CREATE ROLE zoen_channel NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zoen_outbox') THEN
    CREATE ROLE zoen_outbox NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$block$;

-- Authority: ontology + outbox insert; no DDL; no door/eve/channels write.
GRANT USAGE ON SCHEMA ontology, jobs TO zoen_authority;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA ontology TO zoen_authority;
GRANT UPDATE ON ontology.worlds, ontology.memberships, ontology.domains, ontology.sources,
  ontology.grants, ontology.invitations, ontology.frames TO zoen_authority;
GRANT INSERT ON jobs.outbox TO zoen_authority;

-- Door: door schema only.
GRANT USAGE ON SCHEMA door TO zoen_door;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA door TO zoen_door;
REVOKE ALL ON SCHEMA ontology, jobs, eve, channels FROM zoen_door;

-- Eve: eve schema only — no authority credentials.
GRANT USAGE ON SCHEMA eve TO zoen_eve;
REVOKE ALL ON SCHEMA ontology, jobs, door, channels FROM zoen_eve;

-- Channel ingress: channels schema only.
GRANT USAGE ON SCHEMA channels TO zoen_channel;
REVOKE ALL ON SCHEMA ontology, jobs, door, eve FROM zoen_channel;

-- Outbox worker.
GRANT USAGE ON SCHEMA jobs TO zoen_outbox;
GRANT SELECT, UPDATE ON jobs.outbox TO zoen_outbox;
REVOKE ALL ON SCHEMA ontology, door, eve, channels FROM zoen_outbox;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
