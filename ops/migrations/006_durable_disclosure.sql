-- Operational emission coordination. No authority history is rewritten.
CREATE TABLE jobs.disclosure_subjects (
  subject_key text COLLATE "C" PRIMARY KEY CHECK (char_length(subject_key) BETWEEN 1 AND 1024),
  revision bigint NOT NULL CHECK (revision BETWEEN 0 AND 999999999999999999)
);

CREATE TABLE jobs.disclosure_pending (
  permit_id uuid PRIMARY KEY,
  session_key text COLLATE "C" NOT NULL REFERENCES jobs.disclosure_subjects(subject_key),
  membership_key text COLLATE "C" NOT NULL REFERENCES jobs.disclosure_subjects(subject_key),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  CHECK (session_key <> membership_key)
);
CREATE INDEX disclosure_pending_session ON jobs.disclosure_pending(session_key);
CREATE INDEX disclosure_pending_membership ON jobs.disclosure_pending(membership_key);

CREATE TABLE jobs.disclosure_session_closing (
  session_key text COLLATE "C" PRIMARY KEY REFERENCES jobs.disclosure_subjects(subject_key),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp()
);
