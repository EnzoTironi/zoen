-- ZN-0016: single-use invitations (SPEC-002). Accept does not replace World head.

CREATE TABLE IF NOT EXISTS ontology.invitations (
  invitation_hash text PRIMARY KEY CHECK (invitation_hash ~ '^[a-f0-9]{64}$'),
  world_id uuid NOT NULL,
  realm text NOT NULL CHECK (realm IN ('live','evaluation')),
  intended_principal_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('editor','viewer')),
  expires_at timestamptz NOT NULL,
  created_by uuid NOT NULL,
  consumed_by uuid,
  consumed_operation_id uuid,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (
    (consumed_by IS NULL AND consumed_operation_id IS NULL AND consumed_at IS NULL)
    OR (consumed_by IS NOT NULL AND consumed_operation_id IS NOT NULL AND consumed_at IS NOT NULL)
  ),
  FOREIGN KEY (world_id, realm) REFERENCES ontology.worlds(world_id, realm)
);
CREATE UNIQUE INDEX IF NOT EXISTS invitations_one_consumption
  ON ontology.invitations (invitation_hash)
  WHERE consumed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS invitations_world_intended
  ON ontology.invitations (world_id, realm, intended_principal_id, expires_at);

ALTER TABLE ontology.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ontology.invitations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS world_scope ON ontology.invitations;
CREATE POLICY world_scope ON ontology.invitations
  USING (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true))
  WITH CHECK (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true));

REVOKE ALL ON TABLE ontology.invitations FROM PUBLIC;
