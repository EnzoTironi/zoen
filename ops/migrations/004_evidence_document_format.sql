ALTER TABLE jobs.captures
  ADD COLUMN document_format text COLLATE "C" NOT NULL DEFAULT 'worlds.json.v1',
  ADD CONSTRAINT captures_document_format_check
    CHECK (document_format IN ('worlds.json.v1', 'worlds.csv.v1'));
