-- ZN-0027: evidence disclosure state for current-rights reads (no object-key exposure).

ALTER TABLE ontology.source_admissions
  ADD COLUMN IF NOT EXISTS retention_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS erased_at timestamptz,
  ADD COLUMN IF NOT EXISTS content_state text NOT NULL DEFAULT 'available'
    CHECK (content_state IN ('available','expired','erased','unavailable')),
  ADD COLUMN IF NOT EXISTS blob_version_id text,
  ADD COLUMN IF NOT EXISTS security_basis bigint NOT NULL DEFAULT 0 CHECK (security_basis >= 0);

CREATE INDEX IF NOT EXISTS source_admissions_evidence
  ON ontology.source_admissions(world_id, realm, evidence_id);

CREATE TABLE IF NOT EXISTS ontology.evidence_read_receipts (
  world_id uuid NOT NULL,
  realm text NOT NULL,
  receipt_id uuid NOT NULL,
  evidence_id uuid NOT NULL,
  grant_hash text NOT NULL,
  principal_id uuid NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('authorized','expired','erased','denied','unavailable')),
  rights_cut text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (world_id, realm, receipt_id),
  FOREIGN KEY (world_id, realm, evidence_id) REFERENCES ontology.evidence(world_id, realm, evidence_id)
);

ALTER TABLE ontology.evidence_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ontology.evidence_read_receipts FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY world_scope ON ontology.evidence_read_receipts
    USING (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true))
    WITH CHECK (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT, INSERT, UPDATE ON ontology.source_admissions TO zoen_authority;
GRANT SELECT, INSERT ON ontology.evidence_read_receipts TO zoen_authority;
