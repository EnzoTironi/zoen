-- ZN-0047: redacted operational events (no credentials / raw evidence / prompts).
CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE IF NOT EXISTS audit.operational_events (
  event_id uuid PRIMARY KEY,
  world_ref_nullable uuid,
  actor_ref text,
  kind text NOT NULL CHECK (kind IN ('request.failed','request.completed','security.audit','operator.metric')),
  redacted_payload jsonb NOT NULL CHECK (jsonb_typeof(redacted_payload) = 'object'),
  occurred_at timestamptz NOT NULL,
  retention_class text NOT NULL CHECK (retention_class IN ('operational','security-audit','ephemeral')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS operational_events_occurred
  ON audit.operational_events(occurred_at DESC);

CREATE INDEX IF NOT EXISTS operational_events_kind
  ON audit.operational_events(kind, retention_class);
