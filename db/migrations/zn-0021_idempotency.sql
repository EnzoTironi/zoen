-- ZN-0021: record security revision at operation commit for fresh replay disclosure.
ALTER TABLE ontology.operations
  ADD COLUMN IF NOT EXISTS security_revision bigint NOT NULL DEFAULT 0
  CHECK (security_revision >= 0);
