-- ZN-0034: scoped human corrections with append-only undo (no RuleDefinition).

CREATE TABLE IF NOT EXISTS ontology.corrections (
  world_id uuid NOT NULL,
  realm text NOT NULL,
  correction_id uuid NOT NULL,
  operation_digest text NOT NULL CHECK (operation_digest ~ '^[a-f0-9]{64}$'),
  target_claim_id uuid NOT NULL,
  successor_claim_id uuid,
  actor_id uuid NOT NULL,
  case_id text NOT NULL,
  question_digest text NOT NULL CHECK (question_digest ~ '^[a-f0-9]{64}$'),
  answer_kind text NOT NULL CHECK (answer_kind IN ('assertion','identity-decision','retraction')),
  cut_digest text NOT NULL CHECK (cut_digest ~ '^[a-f0-9]{64}$'),
  scoped_subject_id uuid NOT NULL,
  valid_from text NOT NULL,
  valid_until text,
  evidence_refs text[] NOT NULL DEFAULT '{}',
  successor_value text,
  rule_created boolean NOT NULL DEFAULT false CHECK (rule_created = false),
  retracted boolean NOT NULL DEFAULT false,
  retracts_correction_id uuid,
  result_digest text NOT NULL CHECK (result_digest ~ '^[a-f0-9]{64}$'),
  correction_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (world_id, realm, correction_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS corrections_operation_identity
  ON ontology.corrections(world_id, realm, operation_digest);

CREATE INDEX IF NOT EXISTS corrections_scope_cut
  ON ontology.corrections(world_id, realm, scoped_subject_id, cut_digest, created_at);

ALTER TABLE ontology.corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ontology.corrections FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY world_scope ON ontology.corrections
    USING (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true))
    WITH CHECK (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT, INSERT, UPDATE ON ontology.corrections TO zoen_authority;
