-- ZN-0017: revocation / emergency deny audit (security_revision lives on ontology.worlds).

CREATE TABLE IF NOT EXISTS ontology.authority_audit (
  audit_id uuid PRIMARY KEY,
  world_id uuid NOT NULL,
  realm text NOT NULL CHECK (realm IN ('live','evaluation')),
  kind text NOT NULL CHECK (kind ~ '^[A-Z][A-Za-z0-9_]{0,63}$'),
  principal_id uuid,
  actor_id uuid,
  security_revision bigint NOT NULL CHECK (security_revision >= 0),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(detail) = 'object'),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (world_id, realm) REFERENCES ontology.worlds(world_id, realm)
);
CREATE INDEX IF NOT EXISTS authority_audit_world_kind
  ON ontology.authority_audit (world_id, realm, kind, recorded_at DESC);

ALTER TABLE ontology.authority_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE ontology.authority_audit FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS world_scope ON ontology.authority_audit;
CREATE POLICY world_scope ON ontology.authority_audit
  USING (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true))
  WITH CHECK (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true));

REVOKE ALL ON TABLE ontology.authority_audit FROM PUBLIC;
