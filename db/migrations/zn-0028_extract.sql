-- ZN-0028: extraction runs + candidate claim coordinates for CSV/JSON profiles.

CREATE TABLE IF NOT EXISTS ontology.extraction_runs (
  world_id uuid NOT NULL,
  realm text NOT NULL,
  run_id uuid NOT NULL,
  evidence_id uuid,
  capture_id uuid,
  profile_kind text NOT NULL CHECK (profile_kind IN ('csv','json')),
  mapping_version text NOT NULL,
  extractor_version text NOT NULL,
  input_digest text NOT NULL CHECK (input_digest ~ '^[a-f0-9]{64}$'),
  result_digest text NOT NULL CHECK (result_digest ~ '^[a-f0-9]{64}$'),
  state text NOT NULL CHECK (state IN ('ok','quarantined')),
  quarantine_reason text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (world_id, realm, run_id)
);

CREATE TABLE IF NOT EXISTS ontology.extraction_candidates (
  world_id uuid NOT NULL,
  realm text NOT NULL,
  run_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  row_index integer NOT NULL CHECK (row_index >= 0),
  field_name text NOT NULL,
  column_index integer NOT NULL CHECK (column_index >= 0),
  raw_text text NOT NULL,
  parsed_json jsonb,
  mapping_version text NOT NULL,
  extractor_version text NOT NULL,
  PRIMARY KEY (world_id, realm, run_id, candidate_id),
  FOREIGN KEY (world_id, realm, run_id) REFERENCES ontology.extraction_runs(world_id, realm, run_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS extraction_runs_content_identity
  ON ontology.extraction_runs(world_id, realm, input_digest, mapping_version, extractor_version, profile_kind);

ALTER TABLE ontology.extraction_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ontology.extraction_runs FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY world_scope ON ontology.extraction_runs
    USING (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true))
    WITH CHECK (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ontology.extraction_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ontology.extraction_candidates FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY world_scope ON ontology.extraction_candidates
    USING (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true))
    WITH CHECK (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT, INSERT ON ontology.extraction_runs TO zoen_authority;
GRANT SELECT, INSERT ON ontology.extraction_candidates TO zoen_authority;
