-- Run only after migrations by a cluster/database administrator.
-- LOGIN passwords are provisioned separately by tooling/provision.mjs. No secrets here.
DO $block$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zoen_authority') THEN CREATE ROLE zoen_authority NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zoen_door') THEN CREATE ROLE zoen_door NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zoen_outbox') THEN CREATE ROLE zoen_outbox NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; END IF;
END
$block$;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA ontology, jobs TO zoen_authority;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA ontology TO zoen_authority;
GRANT UPDATE ON ontology.worlds, ontology.memberships, ontology.domains, ontology.sources TO zoen_authority;
GRANT INSERT ON jobs.outbox TO zoen_authority;
-- No update/delete on evidence, claims, receipts, commits or operation identities.
GRANT USAGE ON SCHEMA door TO zoen_door;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA door TO zoen_door;
ALTER ROLE zoen_door SET search_path = door, pg_catalog;
GRANT USAGE ON SCHEMA jobs TO zoen_outbox;
GRANT SELECT,UPDATE ON jobs.outbox TO zoen_outbox;
