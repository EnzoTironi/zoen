-- World-wide Closing barrier (ZA-09 / ER-R02 local). Mirrors session closing:
-- Closing inserts under the world exclusive lock; emitters refuse new pending.
-- External PUT containment remains ZA-10. Immutable; no DELETE/UPDATE grants.
CREATE TABLE IF NOT EXISTS jobs.disclosure_world_closing (
  world_key text COLLATE "C" PRIMARY KEY REFERENCES jobs.disclosure_subjects(subject_key),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp()
);
