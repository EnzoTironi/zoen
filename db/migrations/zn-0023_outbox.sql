-- ZN-0023: durable consumer deduplication + owner-specific progress cursors for fenced outbox handoff.
-- Conditional support: required by consumer admit-before-ack invariant.

CREATE TABLE IF NOT EXISTS jobs.consumer_admissions (
  consumer text NOT NULL,
  world_id uuid NOT NULL,
  realm text NOT NULL,
  outbox_id uuid NOT NULL,
  stream_owner text NOT NULL,
  commit_id uuid NOT NULL,
  event_ordinal integer NOT NULL CHECK (event_ordinal >= 0),
  admitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (consumer, world_id, realm, outbox_id),
  UNIQUE (consumer, stream_owner, world_id, realm, commit_id, event_ordinal),
  FOREIGN KEY (world_id, realm, outbox_id) REFERENCES jobs.outbox(world_id, realm, outbox_id)
);

CREATE TABLE IF NOT EXISTS jobs.consumer_cursors (
  stream_owner text NOT NULL PRIMARY KEY,
  worker uuid NOT NULL,
  fence bigint NOT NULL CHECK (fence >= 0),
  cursor text NOT NULL CHECK (char_length(cursor) > 0 AND char_length(cursor) <= 512),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

GRANT SELECT, INSERT ON jobs.consumer_admissions TO zoen_progress;
GRANT SELECT, INSERT, UPDATE ON jobs.consumer_cursors TO zoen_progress;
GRANT SELECT, INSERT ON jobs.consumer_admissions TO zoen_outbox;
GRANT SELECT, INSERT, UPDATE ON jobs.consumer_cursors TO zoen_outbox;
