-- Upgrade: strip leftover Eve journal role ACLs after product surface removal.
-- Prior grantEveJournalRole gave USAGE on schema eve plus SELECT/INSERT/UPDATE on
-- eve.* tables to a dedicated journal login. Removing the grant helper does not
-- clear ACLs already stored in PostgreSQL; migration 019 only REVOKE FROM PUBLIC.
-- Idempotent / fail-closed-safe: missing eve schema or missing roles are no-ops.
-- Does NOT DROP eve.* tables (Fly volume / migration-chain coherence).
-- Where safe, also NOLOGIN dedicated former journal logins (no authority/identity/jobs
-- USAGE). insufficient_privilege is ignored when the migration role lacks CREATEROLE.
DO $revoke_eve$
DECLARE
  target name;
  dedicated boolean;
BEGIN
  IF to_regnamespace('eve') IS NULL THEN
    RETURN;
  END IF;

  FOR target IN
    SELECT DISTINCT rolname
    FROM (
      SELECT a.rolname
      FROM pg_namespace n
      JOIN pg_roles a ON has_schema_privilege(a.oid, n.oid, 'USAGE')
      WHERE n.nspname = 'eve'
        AND a.oid <> n.nspowner
        AND a.rolname <> current_user
      UNION
      SELECT g.grantee::name
      FROM information_schema.role_table_grants g
      WHERE g.table_schema = 'eve'
        AND g.grantee <> 'PUBLIC'
        AND g.grantee <> current_user
        AND g.privilege_type IN (
          'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE',
          'REFERENCES', 'TRIGGER'
        )
    ) leftover
  LOOP
    -- Role may vanish between catalog scan and REVOKE; missing role is a no-op.
    IF to_regrole(target::text) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE USAGE ON SCHEMA eve FROM %I', target);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA eve FROM %I',
      target
    );
    SELECT
      NOT has_schema_privilege(r.oid, 'authority', 'USAGE')
      AND NOT has_schema_privilege(r.oid, 'identity', 'USAGE')
      AND NOT has_schema_privilege(r.oid, 'jobs', 'USAGE')
      AND r.rolcanlogin
    INTO dedicated
    FROM pg_roles r
    WHERE r.rolname = target;
    IF dedicated THEN
      BEGIN
        EXECUTE format('ALTER ROLE %I NOLOGIN', target);
      EXCEPTION
        WHEN insufficient_privilege THEN
          NULL;
        WHEN undefined_object THEN
          NULL;
      END;
    END IF;
  END LOOP;
END
$revoke_eve$;
