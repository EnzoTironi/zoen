-- ZN-0036: durable point-in-time / visible-perspective reconciliation proofs.

CREATE TABLE IF NOT EXISTS ontology.interpretation_law_proofs (
  world_id uuid NOT NULL,
  realm text NOT NULL,
  proof_id uuid NOT NULL,
  operation_digest text NOT NULL CHECK (operation_digest ~ '^[a-f0-9]{64}$'),
  kind text NOT NULL CHECK (kind IN ('visible-equivalence','cut-replay')),
  query_digest text NOT NULL CHECK (query_digest ~ '^[a-f0-9]{64}$'),
  cut_digest_a text NOT NULL CHECK (cut_digest_a ~ '^[a-f0-9]{64}$'),
  cut_digest_b text NOT NULL CHECK (cut_digest_b ~ '^[a-f0-9]{64}$'),
  perspective text NOT NULL,
  observable_digest_a text NOT NULL CHECK (observable_digest_a ~ '^[a-f0-9]{64}$'),
  observable_digest_b text NOT NULL CHECK (observable_digest_b ~ '^[a-f0-9]{64}$'),
  equivalent boolean NOT NULL,
  declassified boolean NOT NULL DEFAULT false,
  declassification_rule_digest text CHECK (declassification_rule_digest IS NULL OR declassification_rule_digest ~ '^[a-f0-9]{64}$'),
  hidden_rival_ids text[] NOT NULL DEFAULT '{}',
  leak_detected boolean NOT NULL DEFAULT false,
  result_digest text NOT NULL CHECK (result_digest ~ '^[a-f0-9]{64}$'),
  laws_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (world_id, realm, proof_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS interpretation_law_proofs_operation
  ON ontology.interpretation_law_proofs(world_id, realm, operation_digest);

ALTER TABLE ontology.interpretation_law_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ontology.interpretation_law_proofs FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY world_scope ON ontology.interpretation_law_proofs
    USING (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true))
    WITH CHECK (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT, INSERT ON ontology.interpretation_law_proofs TO zoen_authority;
