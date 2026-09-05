-- ZN-0015: purpose-bound grants and request permits (SPEC-002 storage).
-- Conditional DDL under ticket allowlist; migrator-owned, not runtime.

CREATE TABLE IF NOT EXISTS ontology.grants (
  grant_hash text PRIMARY KEY CHECK (grant_hash ~ '^[a-f0-9]{64}$'),
  world_id uuid NOT NULL,
  realm text NOT NULL CHECK (realm IN ('live','evaluation')),
  principal_id uuid NOT NULL,
  purpose text NOT NULL CHECK (purpose ~ '^[a-z][a-z0-9_.-]{0,127}$'),
  audience_hash text NOT NULL CHECK (audience_hash ~ '^[a-f0-9]{64}$'),
  assurance text NOT NULL DEFAULT 'presence' CHECK (assurance ~ '^[a-z][a-z0-9_-]{0,63}$'),
  expires_at timestamptz NOT NULL,
  security_revision bigint NOT NULL CHECK (security_revision >= 0),
  scope_json jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(scope_json) = 'object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (world_id, realm) REFERENCES ontology.worlds(world_id, realm)
);
CREATE INDEX IF NOT EXISTS grants_principal_world
  ON ontology.grants (world_id, realm, principal_id, expires_at);

CREATE TABLE IF NOT EXISTS ontology.request_permits (
  permit_hash text PRIMARY KEY CHECK (permit_hash ~ '^[a-f0-9]{64}$'),
  grant_hash text NOT NULL REFERENCES ontology.grants(grant_hash),
  world_id uuid NOT NULL,
  realm text NOT NULL CHECK (realm IN ('live','evaluation')),
  principal_id uuid NOT NULL,
  semantic_op text NOT NULL CHECK (semantic_op ~ '^[a-z][a-z0-9_.-]{0,127}$'),
  body_digest text NOT NULL CHECK (body_digest ~ '^[a-f0-9]{64}$'),
  audience_hash text NOT NULL CHECK (audience_hash ~ '^[a-f0-9]{64}$'),
  cell_epoch bigint NOT NULL CHECK (cell_epoch > 0),
  security_revision bigint NOT NULL CHECK (security_revision >= 0),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (world_id, realm) REFERENCES ontology.worlds(world_id, realm)
);
CREATE INDEX IF NOT EXISTS request_permits_grant
  ON ontology.request_permits (grant_hash, expires_at);

ALTER TABLE ontology.grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE ontology.grants FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS world_scope ON ontology.grants;
CREATE POLICY world_scope ON ontology.grants
  USING (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true))
  WITH CHECK (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true));

ALTER TABLE ontology.request_permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE ontology.request_permits FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS world_scope ON ontology.request_permits;
CREATE POLICY world_scope ON ontology.request_permits
  USING (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true))
  WITH CHECK (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true));

REVOKE ALL ON TABLE ontology.grants, ontology.request_permits FROM PUBLIC;
