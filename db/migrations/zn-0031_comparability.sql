-- ZN-0031: durable comparison runs for CompareClaims (comparability before disagreement).

CREATE TABLE IF NOT EXISTS ontology.comparison_runs (
  world_id uuid NOT NULL,
  realm text NOT NULL,
  run_id uuid NOT NULL,
  input_digest text NOT NULL CHECK (input_digest ~ '^[a-f0-9]{64}$'),
  result_digest text NOT NULL CHECK (result_digest ~ '^[a-f0-9]{64}$'),
  meaning_basis text NOT NULL CHECK (meaning_basis ~ '^[a-f0-9]{64}$'),
  profile_id text NOT NULL,
  knowledge_version bigint NOT NULL CHECK (knowledge_version > 0),
  release_digest text NOT NULL CHECK (release_digest ~ '^[a-f0-9]{64}$'),
  comparer_version text NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (world_id, realm, run_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS comparison_runs_content_identity
  ON ontology.comparison_runs(world_id, realm, input_digest, meaning_basis, comparer_version);

ALTER TABLE ontology.comparison_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ontology.comparison_runs FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY world_scope ON ontology.comparison_runs
    USING (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true))
    WITH CHECK (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT, INSERT ON ontology.comparison_runs TO zoen_authority;
