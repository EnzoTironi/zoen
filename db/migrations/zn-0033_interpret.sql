-- ZN-0033: durable interpretation outcomes (selected/unresolved/unknown).

CREATE TABLE IF NOT EXISTS ontology.interpretations (
  world_id uuid NOT NULL,
  realm text NOT NULL,
  interpretation_id uuid NOT NULL,
  input_digest text NOT NULL CHECK (input_digest ~ '^[a-f0-9]{64}$'),
  query_digest text NOT NULL CHECK (query_digest ~ '^[a-f0-9]{64}$'),
  release_digest text NOT NULL CHECK (release_digest ~ '^[a-f0-9]{64}$'),
  cut_digest text NOT NULL CHECK (cut_digest ~ '^[a-f0-9]{64}$'),
  perspective text NOT NULL,
  status text NOT NULL CHECK (status IN ('unknown','unresolved','selected')),
  verification text NOT NULL CHECK (verification IN ('unverified','rule-backed','none')),
  contested boolean NOT NULL,
  selected_refs uuid[] NOT NULL DEFAULT '{}',
  rival_refs uuid[] NOT NULL DEFAULT '{}',
  dependency_refs text[] NOT NULL DEFAULT '{}',
  rule_digest text CHECK (rule_digest IS NULL OR rule_digest ~ '^[a-f0-9]{64}$'),
  result_digest text NOT NULL CHECK (result_digest ~ '^[a-f0-9]{64}$'),
  interpreter_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (world_id, realm, interpretation_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS interpretations_content_identity
  ON ontology.interpretations(world_id, realm, input_digest, interpreter_version);

ALTER TABLE ontology.interpretations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ontology.interpretations FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY world_scope ON ontology.interpretations
    USING (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true))
    WITH CHECK (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT, INSERT ON ontology.interpretations TO zoen_authority;
