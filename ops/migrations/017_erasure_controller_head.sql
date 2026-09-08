-- ZA-11 monotone controller head (local narrow profile). External file/volume
-- anchor remains outside this database's rollback unit. Hosted/H-01 still blocked.
-- pending_sequence records a DB head advance not yet mirrored to the external anchor.
CREATE TABLE IF NOT EXISTS erasure_attempt.controller_head (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  sequence bigint NOT NULL CHECK (sequence >= 0),
  head_digest text COLLATE "C" NOT NULL
    CHECK (head_digest ~ '^[0-9a-f]{64}$'),
  pending_sequence bigint
    CHECK (pending_sequence IS NULL OR pending_sequence > 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (
    pending_sequence IS NULL OR pending_sequence = sequence
  )
);

INSERT INTO erasure_attempt.controller_head (singleton, sequence, head_digest, pending_sequence)
VALUES (true, 0, repeat('0', 64), NULL)
ON CONFLICT (singleton) DO NOTHING;

ALTER TABLE erasure_attempt.controller_head
  ADD COLUMN IF NOT EXISTS pending_sequence bigint
    CHECK (pending_sequence IS NULL OR pending_sequence > 0);
