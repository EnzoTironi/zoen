-- ZN-0029: retention pins + upload leases for safe capture GC.

ALTER TABLE ontology.captures
  ADD COLUMN IF NOT EXISTS upload_lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS pending_admission boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gc_deleted_at timestamptz;

CREATE TABLE IF NOT EXISTS ontology.retention_pins (
  world_id uuid NOT NULL,
  realm text NOT NULL,
  pin_id uuid NOT NULL,
  capture_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('admission','historical','publication')),
  pinned_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz,
  PRIMARY KEY (world_id, realm, pin_id),
  FOREIGN KEY (world_id, realm, capture_id) REFERENCES ontology.captures(world_id, realm, capture_id)
);

CREATE INDEX IF NOT EXISTS retention_pins_capture
  ON ontology.retention_pins(world_id, realm, capture_id);

CREATE TABLE IF NOT EXISTS ontology.capture_gc_receipts (
  world_id uuid NOT NULL,
  realm text NOT NULL,
  receipt_id uuid NOT NULL,
  capture_id uuid NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('deleted','skipped_pinned','skipped_pending','skipped_admitted','skipped_lease_active','not_found')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (world_id, realm, receipt_id)
);

ALTER TABLE ontology.retention_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE ontology.retention_pins FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY world_scope ON ontology.retention_pins
    USING (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true))
    WITH CHECK (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ontology.capture_gc_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ontology.capture_gc_receipts FORCE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY world_scope ON ontology.capture_gc_receipts
    USING (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true))
    WITH CHECK (world_id::text = current_setting('zoen.world_id', true) AND realm = current_setting('zoen.realm', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT, INSERT, UPDATE ON ontology.captures TO zoen_authority;
GRANT SELECT, INSERT, DELETE ON ontology.retention_pins TO zoen_authority;
GRANT SELECT, INSERT ON ontology.capture_gc_receipts TO zoen_authority;
