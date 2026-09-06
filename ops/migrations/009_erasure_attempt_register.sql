-- Isolated attempt register (ER-R01 / freeze F01). Not authority.*; outside Closing TX.
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
