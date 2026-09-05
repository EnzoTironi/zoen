-- ZN-0035: correction impact closure, node status, and quality runs.

CREATE TABLE IF NOT EXISTS ontology.impact_nodes (
  world_id uuid NOT NULL,
  realm text NOT NULL,
  node_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('claim','interpretation','case','watch','projection')),
  subject_id uuid,
  cut_digest text NOT NULL CHECK (cut_digest ~ '^[a-f0-9]{64}$'),
  status text NOT NULL CHECK (status IN ('valid','stale','pending')),
  authorized boolean NOT NULL DEFAULT true,
  contested boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (world_id, realm, node_id)
);

CREATE INDEX IF NOT EXISTS impact_nodes_subject
  ON ontology.impact_nodes(world_id, realm, subject_id)
  WHERE subject_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ontology.impact_edges (
  world_id uuid NOT NULL,
  realm text NOT NULL,
  from_id text NOT NULL,
  from_kind text NOT NULL CHECK (from_kind IN ('claim','interpretation','case','watch','projection')),
  to_id text NOT NULL,
  to_kind text NOT NULL CHECK (to_kind IN ('claim','interpretation','case','watch','projection')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (world_id, realm, from_id, to_id),
  CHECK (from_id <> to_id)
);

CREATE INDEX IF NOT EXISTS impact_edges_to
  ON ontology.impact_edges(world_id, realm, to_id);

CREATE TABLE IF NOT EXISTS ontology.impact_runs (
  world_id uuid NOT NULL,
  realm text NOT NULL,
  run_id uuid NOT NULL,
  operation_digest text NOT NULL CHECK (operation_digest ~ '^[a-f0-9]{64}$'),
  correction_id uuid NOT NULL,
  source_cut_digest text NOT NULL CHECK (source_cut_digest ~ '^[a-f0-9]{64}$'),
  scoped_subject_id uuid NOT NULL,
  target_claim_id uuid NOT NULL,
  is_retraction boolean NOT NULL DEFAULT false,
  invalidated_ids text[] NOT NULL DEFAULT '{}',
  untouched_ids text[] NOT NULL DEFAULT '{}',
  quality_json jsonb NOT NULL,
  result_digest text NOT NULL CHECK (result_digest ~ '^[a-f0-9]{64}$'),
  cycle_detected boolean NOT NULL DEFAULT false,
  impact_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (world_id, realm, run_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS impact_runs_operation_identity
  ON ontology.impact_runs(world_id, realm, operation_digest);

ALTER TABLE ontology.impact_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ontology.impact_nodes FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY world_scope ON ontology.impact_nodes
    USING (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true))
    WITH CHECK (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ontology.impact_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE ontology.impact_edges FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY world_scope ON ontology.impact_edges
    USING (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true))
    WITH CHECK (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ontology.impact_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ontology.impact_runs FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY world_scope ON ontology.impact_runs
    USING (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true))
    WITH CHECK (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT, INSERT, UPDATE ON ontology.impact_nodes TO zoen_authority;
GRANT SELECT, INSERT ON ontology.impact_edges TO zoen_authority;
GRANT SELECT, INSERT ON ontology.impact_runs TO zoen_authority;
