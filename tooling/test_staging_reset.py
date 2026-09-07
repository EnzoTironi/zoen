"""Filesystem ownership oracles for scoped staging reset (ZA-04)."""

from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest import mock

SCRIPT = Path(
    os.environ.get("ZOEN_STAGING_RESET_SCRIPT", Path(__file__).with_name("staging_reset.py"))
)
UP_SCRIPT = Path(
    os.environ.get("ZOEN_STAGING_UP_SCRIPT", Path(__file__).with_name("staging_up.py"))
)


def write_env(path: Path, values: dict[str, str]) -> None:
    path.write_text("".join(f"{key}={value}\n" for key, value in values.items()))
    os.chmod(path, 0o600)


class StagingResetOwnership(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory(prefix="zoen-staging-reset-")
        self.addCleanup(self.temporary.cleanup)
        self.root = (Path(self.temporary.name) / "repository").resolve()
        (self.root / "tooling").mkdir(parents=True)
        (self.root / "ops" / "local").mkdir(parents=True)
        shutil.copyfile(SCRIPT, self.root / "tooling" / "staging_reset.py")
        shutil.copyfile(UP_SCRIPT, self.root / "tooling" / "staging_up.py")
        # Minimal compose stub so wipe path could be mocked; default reset must not call it.
        (self.root / "ops" / "compose.yaml").write_text("name: zoen-rebuild\n")
        (self.root / "ops" / "local" / "provision.ts").write_text("// stub\n")
        self.suffix = "a" * 24
        self.database = f"zoen_local_{self.suffix}"
        self.bucket = f"zoen-local-{self.suffix}"
        self.roles = {
            "authority": f"zoen_authority_{self.suffix}",
            "identity": f"zoen_identity_{self.suffix}",
            "migration": f"zoen_migration_{self.suffix}",
            "progress": f"zoen_progress_{self.suffix}",
        }
        write_env(
            self.root / ".env.infra",
            {
                "ZOEN_TEST_DATABASE_URL": "postgresql://zoen_infra:x@127.0.0.1:55434/zoen_test",
                "ZOEN_TEST_S3_ENDPOINT": "http://127.0.0.1:59004",
                "ZOEN_TEST_S3_ACCESS_KEY": "ak",
                "ZOEN_TEST_S3_SECRET_KEY": "sk",
            },
        )

    def seed_staging_install(self, *, resources: bool = True, env: bool = True) -> Path:
        profile = self.root / ".local" / "staging"
        profile.mkdir(parents=True, mode=0o700)
        (profile / "installation.json").write_text('{"installation":{"cellId":"1"}}\n')
        (profile / "provision.json").write_text(
            json.dumps(
                {
                    "bucket": self.bucket,
                    "databaseName": self.database,
                    "names": self.roles,
                }
            )
            + "\n"
        )
        if resources:
            (profile / "resources.json").write_text(
                json.dumps(
                    {
                        "schemaVersion": "local-profile-resources.v1",
                        "profile": "staging",
                        "checkout": str(self.root.resolve()),
                        "composeProject": "zoen-rebuild",
                        "databaseName": self.database,
                        "bucket": self.bucket,
                        "roleNames": list(self.roles.values()),
                    }
                )
                + "\n"
            )
        if env:
            write_env(
                self.root / ".env.staging",
                {
                    "ZOEN_PUBLIC_URL": "http://127.0.0.1:4310",
                    "ZOEN_S3_ENDPOINT": "http://127.0.0.1:59004",
                    "ZOEN_S3_BUCKET": self.bucket,
                },
            )
        # Neighboring application install must survive path-only checks.
        write_env(self.root / ".env.application", {"SENTINEL": "keep-me"})
        (self.root / ".local" / "application").mkdir(parents=True, exist_ok=True)
        (self.root / ".local" / "application" / "sentinel.txt").write_text("alive\n")
        return profile

    def run_reset(self, *args: str, check_call_mock: mock.MagicMock | None = None):
        import importlib.util

        spec = importlib.util.spec_from_file_location(
            "staging_reset_under_test", self.root / "tooling" / "staging_reset.py"
        )
        assert spec and spec.loader
        module = importlib.util.module_from_spec(spec)
        # Point module ROOT at fixture checkout.
        spec.loader.exec_module(module)
        module.ROOT = self.root.resolve()
        with mock.patch.object(module, "deprovision_owned") as deprovision:
            deprovision.side_effect = lambda root, inventory: None
            if check_call_mock is not None:
                with mock.patch.object(module.subprocess, "check_call", check_call_mock):
                    code = module.main(list(args))
            else:
                code = module.main(list(args))
            return code, deprovision, module

    def test_default_reset_removes_staging_keeps_application_and_skips_volume_wipe(self):
        self.seed_staging_install()
        check_call = mock.MagicMock()
        code, deprovision, _ = self.run_reset(check_call_mock=check_call)
        self.assertEqual(code, 0)
        deprovision.assert_called_once()
        # Never invoke docker compose down --volumes on the default path.
        for call in check_call.call_args_list:
            flat = " ".join(str(part) for part in call.args[0])
            self.assertNotIn("--volumes", flat)
        self.assertFalse((self.root / ".env.staging").exists())
        self.assertFalse((self.root / ".local" / "staging").exists())
        self.assertEqual((self.root / ".env.application").read_text(), "SENTINEL=keep-me\n")
        self.assertEqual(
            (self.root / ".local" / "application" / "sentinel.txt").read_text(), "alive\n"
        )
        self.assertTrue((self.root / ".env.infra").is_file())

    def test_symlink_refused_before_any_delete(self):
        profile = self.seed_staging_install()
        outside = self.root.parent / "outside"
        outside.mkdir()
        (outside / "trap.txt").write_text("nope\n")
        # Replace profile dir with symlink after seeding files into real dir — move aside.
        real = self.root.parent / "staging-real"
        shutil.move(profile, real)
        (self.root / ".local" / "staging").symlink_to(real, target_is_directory=True)
        code, deprovision, _ = self.run_reset()
        self.assertEqual(code, 1)
        deprovision.assert_not_called()
        self.assertEqual((real / "provision.json").read_text().count(self.database), 1)
        self.assertTrue((self.root / ".env.staging").is_file())

    def test_hosted_url_refused(self):
        self.seed_staging_install()
        write_env(
            self.root / ".env.staging",
            {
                "ZOEN_PUBLIC_URL": "https://zoen.tironi.xyz",
                "ZOEN_S3_ENDPOINT": "http://127.0.0.1:59004",
                "ZOEN_S3_BUCKET": self.bucket,
            },
        )
        code, deprovision, _ = self.run_reset()
        self.assertEqual(code, 1)
        deprovision.assert_not_called()
        self.assertTrue((self.root / ".env.staging").is_file())

    def test_foreign_compose_project_refused(self):
        self.seed_staging_install()
        resources = self.root / ".local" / "staging" / "resources.json"
        data = json.loads(resources.read_text())
        data["composeProject"] = "someone-else"
        resources.write_text(json.dumps(data) + "\n")
        code, deprovision, _ = self.run_reset()
        self.assertEqual(code, 1)
        deprovision.assert_not_called()

    def test_malformed_manifest_refused(self):
        self.seed_staging_install()
        resources = self.root / ".local" / "staging" / "resources.json"
        resources.write_text("{not-json\n")
        code, deprovision, _ = self.run_reset()
        self.assertEqual(code, 1)
        deprovision.assert_not_called()

    def test_missing_inventory_refused(self):
        write_env(self.root / ".env.staging", {"ZOEN_PUBLIC_URL": "http://127.0.0.1:4310"})
        (self.root / ".local" / "staging").mkdir(parents=True)
        code, deprovision, _ = self.run_reset()
        self.assertEqual(code, 1)
        deprovision.assert_not_called()

    def test_sigkill_marker_blocks_phantom_ready_on_up(self):
        self.seed_staging_install()
        import importlib.util

        spec = importlib.util.spec_from_file_location(
            "staging_reset_marker", self.root / "tooling" / "staging_reset.py"
        )
        assert spec and spec.loader
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        module.ROOT = self.root.resolve()
        inventory = module.load_inventory(self.root)
        module.write_operation(self.root, inventory, "started")

        up_spec = importlib.util.spec_from_file_location(
            "staging_up_under_test", self.root / "tooling" / "staging_up.py"
        )
        assert up_spec and up_spec.loader
        up = importlib.util.module_from_spec(up_spec)
        up_spec.loader.exec_module(up)
        with self.assertRaises(ValueError) as ctx:
            up.assert_ready_or_absent(self.root)
        self.assertIn("Incomplete staging reset", str(ctx.exception))
        self.assertTrue((self.root / ".env.application").is_file())

    def test_shared_volume_wipe_requires_opt_in_and_enumerates(self):
        self.seed_staging_install()
        write_env(self.root / ".env.other", {"X": "1"})
        check_call = mock.MagicMock()
        code, _, module = self.run_reset("--wipe-shared-volumes", check_call_mock=check_call)
        self.assertEqual(code, 1)
        check_call.assert_not_called()
        check_call.reset_mock()
        code, _, _ = self.run_reset(
            "--wipe-shared-volumes",
            "--i-accept-removing-all-local-profiles",
            check_call_mock=check_call,
        )
        self.assertEqual(code, 0)
        check_call.assert_called()
        flat = " ".join(str(part) for part in check_call.call_args.args[0])
        self.assertIn("--volumes", flat)


if __name__ == "__main__":
    unittest.main()
