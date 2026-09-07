-- Orphaned disclosure recovery: writer-epoch inventory and monotone recovery records.
-- Pending rows are not wiped by TTL; recovery retires a contained epoch then advances pending.
CREATE TABLE jobs.disclosure_writer_epochs (
  writer_epoch uuid PRIMARY KEY,
  permit_id uuid NOT NULL UNIQUE,
  session_key text COLLATE "C" NOT NULL REFERENCES jobs.disclosure_subjects(subject_key),
  membership_key text COLLATE "C" NOT NULL REFERENCES jobs.disclosure_subjects(subject_key),
  status text COLLATE "C" NOT NULL CHECK (status IN ('active', 'retired')),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  retired_at timestamptz(3),
  CHECK (session_key <> membership_key),
  CHECK ((status = 'active') = (retired_at IS NULL))
);
CREATE INDEX disclosure_writer_epochs_permit ON jobs.disclosure_writer_epochs(permit_id);
CREATE INDEX disclosure_writer_epochs_session ON jobs.disclosure_writer_epochs(session_key);

CREATE TABLE jobs.disclosure_recovery (
  recovery_id uuid PRIMARY KEY,
  permit_id uuid NOT NULL,
  writer_epoch uuid NOT NULL REFERENCES jobs.disclosure_writer_epochs(writer_epoch),
  session_key text COLLATE "C" NOT NULL REFERENCES jobs.disclosure_subjects(subject_key),
  membership_key text COLLATE "C" NOT NULL REFERENCES jobs.disclosure_subjects(subject_key),
  containment_kind text COLLATE "C" NOT NULL
    CHECK (containment_kind IN ('supervisor_process_exit')),
  containment_pid bigint NOT NULL CHECK (containment_pid > 0),
  containment_exit_status integer NOT NULL,
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX disclosure_recovery_epoch ON jobs.disclosure_recovery(writer_epoch);
CREATE INDEX disclosure_recovery_session ON jobs.disclosure_recovery(session_key);
