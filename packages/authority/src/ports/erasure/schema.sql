-- Numbered as ops/migrations/009_erasure_attempt_register.sql + 015_object_write_settlement.sql + 016_controlled_copy_catalog.sql + 017_erasure_controller_head.sql.
-- Candidate copy for domain docs/tests. Keep in sync with numbered migrations.
-- Separate schema: not authority.*; outside Closing TX.
CREATE SCHEMA IF NOT EXISTS erasure_attempt;

CREATE TABLE IF NOT EXISTS erasure_attempt.attempts (
  deployment_epoch text COLLATE "C" NOT NULL,
  operation_id uuid NOT NULL,
  principal_id uuid NOT NULL,
  world_id uuid NOT NULL,
  realm text COLLATE "C" NOT NULL CHECK (realm = 'live'),
  intention_digest text COLLATE "C" NOT NULL
    CHECK (intention_digest ~ '^[0-9a-f]{64}$'),
  state text COLLATE "C" NOT NULL
    CHECK (state IN ('Registered', 'Confirmed', 'Aborted', 'Unknown')),
  registered_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  resolved_at timestamptz,
  PRIMARY KEY (deployment_epoch, operation_id),
  CHECK (
    (state IN ('Registered', 'Unknown') AND resolved_at IS NULL)
    OR (state IN ('Confirmed', 'Aborted') AND resolved_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS erasure_attempts_world
  ON erasure_attempt.attempts (world_id, realm, state);

-- Numbered as ops/migrations/015_object_write_settlement.sql. Keep in sync.
CREATE TABLE IF NOT EXISTS jobs.object_write_attempts (
  attempt_id uuid PRIMARY KEY,
  world_id uuid NOT NULL,
  realm text COLLATE "C" NOT NULL CHECK (realm = 'live'),
  capture_id uuid NOT NULL,
  erasure_epoch text COLLATE "C" NOT NULL,
  object_key text COLLATE "C" NOT NULL
    CHECK (char_length(object_key) BETWEEN 1 AND 1024),
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

-- Numbered as ops/migrations/017_erasure_controller_head.sql. Keep in sync.
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
