-- ZN-0025: source bindings + captures for StageCapture (no evidence admission yet).

CREATE TABLE IF NOT EXISTS ontology.source_bindings (
  world_id uuid NOT NULL,
  realm text NOT NULL,
  binding_id uuid NOT NULL,
  definition_id text NOT NULL,
  state text NOT NULL CHECK (state IN ('active','disabled')),
  credential_ref text,
  acl_revision bigint NOT NULL DEFAULT 0 CHECK (acl_revision >= 0),
  max_bytes integer NOT NULL DEFAULT 1000000 CHECK (max_bytes > 0 AND max_bytes <= 5000000),
  allowed_media_types text[] NOT NULL DEFAULT ARRAY['text/csv','application/json','text/plain'],
  PRIMARY KEY (world_id, realm, binding_id),
  FOREIGN KEY (world_id, realm) REFERENCES ontology.worlds(world_id, realm)
);

CREATE TABLE IF NOT EXISTS ontology.captures (
  world_id uuid NOT NULL,
  realm text NOT NULL,
  capture_id uuid NOT NULL,
  binding_id uuid NOT NULL,
  source_namespace text NOT NULL,
  external_id text NOT NULL,
  revision text NOT NULL,
  blob_ref text,
  digest text,
  size_bytes bigint NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  media_type text NOT NULL,
  acquired_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  state text NOT NULL CHECK (state IN ('staged','quarantined','failed','admitted')),
  quarantine_reason text,
  PRIMARY KEY (world_id, realm, capture_id),
  UNIQUE (world_id, realm, binding_id, external_id, revision, digest),
  FOREIGN KEY (world_id, realm, binding_id) REFERENCES ontology.source_bindings(world_id, realm, binding_id)
);

CREATE INDEX IF NOT EXISTS captures_binding_state
  ON ontology.captures(world_id, realm, binding_id, state);

ALTER TABLE ontology.source_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ontology.source_bindings FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY world_scope ON ontology.source_bindings
    USING (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true))
    WITH CHECK (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ontology.captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE ontology.captures FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY world_scope ON ontology.captures
    USING (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true))
    WITH CHECK (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT, INSERT, UPDATE ON ontology.source_bindings TO zoen_authority;
GRANT SELECT, INSERT, UPDATE ON ontology.captures TO zoen_authority;
