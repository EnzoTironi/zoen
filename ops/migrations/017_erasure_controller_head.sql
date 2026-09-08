-- ZA-11 monotone controller head (local narrow profile). External file/volume
-- anchor remains outside this database's rollback unit. Hosted/H-01 still blocked.
CREATE TABLE IF NOT EXISTS erasure_attempt.controller_head (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  sequence bigint NOT NULL CHECK (sequence >= 0),
  head_digest text COLLATE "C" NOT NULL
    CHECK (head_digest ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

INSERT INTO erasure_attempt.controller_head (singleton, sequence, head_digest)
VALUES (true, 0, repeat('0', 64))
ON CONFLICT (singleton) DO NOTHING;
