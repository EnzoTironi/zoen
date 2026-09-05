-- ZN-0042: frame pins + sparse input rows for coherent Frame basis acquisition.

CREATE TABLE IF NOT EXISTS ontology.frame_pins (
  world_id uuid NOT NULL,
  realm text NOT NULL,
  frame_id uuid NOT NULL,
  pin_ref text NOT NULL,
  retention_class text NOT NULL CHECK (retention_class IN ('evidence','snapshot','sparse')),
  PRIMARY KEY (world_id, realm, frame_id, pin_ref),
  FOREIGN KEY (world_id, realm, frame_id) REFERENCES ontology.frames(world_id, realm, frame_id)
);

CREATE TABLE IF NOT EXISTS ontology.frame_sparse_rows (
  world_id uuid NOT NULL,
  realm text NOT NULL,
  row_id uuid NOT NULL,
  domain_id text NOT NULL,
  ordinal bigint NOT NULL CHECK (ordinal >= 0),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2048),
  admitted boolean NOT NULL DEFAULT true,
  opaque_ref text NOT NULL CHECK (length(opaque_ref) BETWEEN 1 AND 128),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (world_id, realm, row_id),
  UNIQUE (world_id, realm, opaque_ref)
);

CREATE INDEX IF NOT EXISTS frame_sparse_domain_ord
  ON ontology.frame_sparse_rows(world_id, realm, domain_id, ordinal);

ALTER TABLE ontology.frame_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE ontology.frame_pins FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY world_scope ON ontology.frame_pins
    USING (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true))
    WITH CHECK (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ontology.frame_sparse_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE ontology.frame_sparse_rows FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY world_scope ON ontology.frame_sparse_rows
    USING (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true))
    WITH CHECK (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT, INSERT ON ontology.frames TO zoen_authority;
GRANT SELECT, INSERT ON ontology.frame_pins TO zoen_authority;
GRANT SELECT, INSERT, UPDATE ON ontology.frame_sparse_rows TO zoen_authority;
GRANT SELECT, UPDATE ON ontology.domains TO zoen_authority;

CREATE UNIQUE INDEX IF NOT EXISTS frames_operation_digest
  ON ontology.frames (world_id, realm, ((basis->>'operationDigest')))
  WHERE basis ? 'operationDigest';
