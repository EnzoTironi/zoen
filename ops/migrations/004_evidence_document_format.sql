ALTER TABLE jobs.captures
  ADD COLUMN document_format text COLLATE "C" NOT NULL DEFAULT 'd01.json.v1',
  ADD CONSTRAINT captures_document_format_check
    CHECK (document_format IN ('d01.json.v1', 'd01.csv.v1'));
