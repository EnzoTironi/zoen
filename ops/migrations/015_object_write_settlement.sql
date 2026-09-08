-- Object-write admission/settlement (ZA-10 / ER-R02 external uploads).
-- Durable registration precedes external send. Client cancel / HEAD 404 cannot
-- clear submitted Unknown. G-STORAGE-FENCE (provider containment of in-flight PUT)
-- remains separately qualified; Object Lock ≠ writer fence.
CREATE TABLE IF NOT EXISTS jobs.object_write_attempts (
  attempt_id uuid PRIMARY KEY,
  world_id uuid NOT NULL,
  realm text COLLATE "C" NOT NULL CHECK (realm = 'live'),
  capture_id uuid NOT NULL,
  erasure_epoch text COLLATE "C" NOT NULL,
  object_key text COLLATE "C" NOT NULL
    CHECK (char_length(object_key) BETWEEN 1 AND 1024),
  -- registered: durable intent, no external send yet
  -- external_submitted: provider I/O started; not yet terminal
  -- terminal_observed: definitive provider success/failure observed by runtime
  -- unknown: ambiguous (cancel, timeout, lost reply) — blocks Erased
  state text COLLATE "C" NOT NULL
    CHECK (state IN (
      'registered',
      'external_submitted',
      'terminal_observed',
      'unknown'
    )),
  registered_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  submitted_at timestamptz(3),
  resolved_at timestamptz(3),
  UNIQUE (world_id, realm, capture_id),
  CHECK (
    (state = 'registered' AND submitted_at IS NULL AND resolved_at IS NULL)
    OR (state = 'external_submitted' AND submitted_at IS NOT NULL AND resolved_at IS NULL)
    OR (state IN ('terminal_observed', 'unknown') AND submitted_at IS NOT NULL AND resolved_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS object_write_attempts_world_state
  ON jobs.object_write_attempts (world_id, realm, state);
