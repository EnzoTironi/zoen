-- ZN-0046: disclosure state on evidence for historical reopen / erasure gates.
ALTER TABLE ontology.evidence
  ADD COLUMN IF NOT EXISTS content_state text NOT NULL DEFAULT 'available'
    CHECK (content_state IN ('available','expired','erased','unavailable')),
  ADD COLUMN IF NOT EXISTS erased_at timestamptz,
  ADD COLUMN IF NOT EXISTS retention_expires_at timestamptz;
