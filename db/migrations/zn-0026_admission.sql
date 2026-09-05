-- ZN-0026: stable source admissions linking staged captures to evidence/claims.

CREATE TABLE IF NOT EXISTS ontology.source_admissions (
  world_id uuid NOT NULL,
  realm text NOT NULL,
  binding_id uuid NOT NULL,
  capture_id uuid NOT NULL,
  mapping_digest text NOT NULL CHECK (mapping_digest ~ '^[a-f0-9]{64}$'),
  receipt_id uuid NOT NULL,
  evidence_id uuid NOT NULL,
  claim_id uuid NOT NULL,
  source_id uuid NOT NULL,
  commit_id uuid NOT NULL,
  operation_id uuid NOT NULL,
  rights_ref text NOT NULL,
  retention_ref text NOT NULL,
  admitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (world_id, realm, binding_id, capture_id, mapping_digest),
  FOREIGN KEY (world_id, realm, binding_id) REFERENCES ontology.source_bindings(world_id, realm, binding_id),
  FOREIGN KEY (world_id, realm, capture_id) REFERENCES ontology.captures(world_id, realm, capture_id),
  FOREIGN KEY (world_id, realm, evidence_id) REFERENCES ontology.evidence(world_id, realm, evidence_id),
  FOREIGN KEY (world_id, realm, claim_id) REFERENCES ontology.claims(world_id, realm, claim_id),
  FOREIGN KEY (world_id, realm, source_id) REFERENCES ontology.sources(world_id, realm, source_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS source_admissions_content_identity
  ON ontology.source_admissions(world_id, realm, binding_id, mapping_digest, capture_id);

ALTER TABLE ontology.source_admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ontology.source_admissions FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY world_scope ON ontology.source_admissions
    USING (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true))
    WITH CHECK (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT, INSERT ON ontology.source_admissions TO zoen_authority;
