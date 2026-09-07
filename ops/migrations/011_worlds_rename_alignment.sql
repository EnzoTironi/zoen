-- Pre-launch: align persisted rename fallout from d01→worlds (no dual-read).
-- Fresh installs already get worlds.* from rewritten 004; this migration is
-- idempotent for those DBs and rewrites rows/constraints for DBs that applied
-- the former d01.* DEFAULT/CHECK.

ALTER TABLE jobs.captures
  DROP CONSTRAINT IF EXISTS captures_document_format_check;

UPDATE jobs.captures
  SET document_format = CASE document_format
    WHEN 'd01.json.v1' THEN 'worlds.json.v1'
    WHEN 'd01.csv.v1' THEN 'worlds.csv.v1'
    ELSE document_format
  END
  WHERE document_format IN ('d01.json.v1', 'd01.csv.v1');

UPDATE jobs.captures
  SET object_location = jsonb_set(
    object_location,
    '{documentFormat}',
    CASE object_location->>'documentFormat'
      WHEN 'd01.json.v1' THEN to_jsonb('worlds.json.v1'::text)
      WHEN 'd01.csv.v1' THEN to_jsonb('worlds.csv.v1'::text)
      ELSE object_location->'documentFormat'
    END,
    false
  )
  WHERE object_location IS NOT NULL
    AND object_location ? 'documentFormat'
    AND object_location->>'documentFormat' IN ('d01.json.v1', 'd01.csv.v1');

ALTER TABLE jobs.captures
  ALTER COLUMN document_format SET DEFAULT 'worlds.json.v1';

ALTER TABLE jobs.captures
  ADD CONSTRAINT captures_document_format_check
    CHECK (document_format IN ('worlds.json.v1', 'worlds.csv.v1'));

-- StoredQuestion.version is worlds-only; rewrite persisted correction cases.
UPDATE authority.cases
  SET question = jsonb_set(question, '{version}', to_jsonb('worlds.v1'::text), false)
  WHERE question->>'version' = 'd01.v1';
