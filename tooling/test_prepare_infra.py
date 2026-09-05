"""Independent filesystem and disclosure oracles for one-time infrastructure setup."""

import os
from pathlib import Path
import shutil
import stat
import subprocess
import tempfile
import unittest


SCRIPT = Path(os.environ.get("ZOEN_PREPARE_INFRA_SCRIPT", Path(__file__).with_name("prepare_infra.py")))
SECRET_KEYS = (
    "ZOEN_TEST_DB_ADMIN_PASSWORD",
    "ZOEN_TEST_DB_RUNTIME_PASSWORD",
    "ZOEN_TEST_S3_ACCESS_KEY",
    "ZOEN_TEST_S3_SECRET_KEY",
)


class PrepareInfraExclusivity(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="zoen-prepare-infra-review-")
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.root = self.base / "repository"
        (self.root / "tooling").mkdir(parents=True)
        self.script = self.root / "tooling" / "prepare_infra.py"
        shutil.copyfile(SCRIPT, self.script)
        self.target = self.root / ".env.infra"

    def prepare(self):
        return subprocess.run(
            ["python3", str(self.script)],
            capture_output=True,
            text=True,
            check=False,
            umask=0o022,
        )

    def test_creates_private_configuration_without_logging_credentials(self):
        result = self.prepare()
        self.assertEqual(result.returncode, 0)
        self.assertEqual(stat.S_IMODE(self.target.stat().st_mode), 0o600)
        values = dict(line.split("=", 1) for line in self.target.read_text().splitlines())
        self.assertTrue(set(SECRET_KEYS).issubset(values))
        combined_output = result.stdout + result.stderr
        self.assertTrue(all(values[key] and values[key] not in combined_output for key in SECRET_KEYS))
        self.assertEqual(result.stderr, "")

    def test_second_invocation_fails_without_changing_configuration(self):
        self.assertEqual(self.prepare().returncode, 0)
        original = self.target.read_bytes()
        metadata = self.target.stat()
        result = self.prepare()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.target.read_bytes(), original)
        self.assertEqual(self.target.stat().st_ino, metadata.st_ino)
        self.assertEqual(stat.S_IMODE(self.target.stat().st_mode), 0o600)
        values = dict(line.split("=", 1) for line in original.decode().splitlines())
        self.assertTrue(all(values[key] not in result.stdout + result.stderr for key in SECRET_KEYS))

    def test_refuses_existing_and_dangling_symlinks(self):
        for exists in (True, False):
            with self.subTest(existing_target=exists):
                destination = self.base / f"outside-{exists}"
                if exists:
                    destination.write_bytes(b"existing external bytes")
                self.target.symlink_to(destination)
                result = self.prepare()
                self.assertNotEqual(result.returncode, 0)
                self.assertTrue(self.target.is_symlink())
                if exists:
                    self.assertEqual(destination.read_bytes(), b"existing external bytes")
                else:
                    self.assertFalse(destination.exists())
                self.target.unlink()


if __name__ == "__main__":
    unittest.main()
