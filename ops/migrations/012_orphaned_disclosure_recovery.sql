-- Orphaned disclosure recovery: writer-epoch inventory and monotone recovery records.
-- Pending rows are not wiped by TTL; recovery retires a contained epoch then advances pending.
-- Pre-launch: refuse activation while durable pending lacks epochs (no silent stuck barriers).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM jobs.disclosure_pending) THEN
    RAISE EXCEPTION
      'disclosure: drain jobs.disclosure_pending before orphaned-recovery activation';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS jobs.disclosure_writer_epochs (
  writer_epoch uuid PRIMARY KEY,
  permit_id uuid NOT NULL UNIQUE,
  session_key text COLLATE "C" NOT NULL REFERENCES jobs.disclosure_subjects(subject_key),
  membership_key text COLLATE "C" NOT NULL REFERENCES jobs.disclosure_subjects(subject_key),
  writer_pid bigint NOT NULL CHECK (writer_pid > 0),
  status text COLLATE "C" NOT NULL CHECK (status IN ('active', 'retired')),
  created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  retired_at timestamptz(3),
  CHECK (session_key <> membership_key),
  CHECK ((status = 'active') = (retired_at IS NULL))
);
CREATE INDEX IF NOT EXISTS disclosure_writer_epochs_permit
  ON jobs.disclosure_writer_epochs(permit_id);
CREATE INDEX IF NOT EXISTS disclosure_writer_epochs_session
  ON jobs.disclosure_writer_epochs(session_key);

CREATE TABLE IF NOT EXISTS jobs.disclosure_recovery (
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
CREATE INDEX IF NOT EXISTS disclosure_recovery_epoch
  ON jobs.disclosure_recovery(writer_epoch);
CREATE INDEX IF NOT EXISTS disclosure_recovery_session
  ON jobs.disclosure_recovery(session_key);
