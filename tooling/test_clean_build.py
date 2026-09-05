"""Independent containment oracles for deletion of declared generated outputs."""

import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


WORKSPACES = (
    "packages/contracts",
    "packages/authority",
    "apps/server",
    "apps/cli",
    "apps/web",
)
SCRIPT = Path(os.environ.get("ZOEN_CLEAN_BUILD_SCRIPT", Path(__file__).with_name("clean_build.py")))


class CleanBuildContainment(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="zoen-clean-build-review-")
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.root = self.base / "repository"
        (self.root / "tooling").mkdir(parents=True)
        shutil.copyfile(SCRIPT, self.root / "tooling" / "clean_build.py")
        self.outside = self.base / "outside"
        (self.outside / "dist").mkdir(parents=True)
        self.external = self.outside / "dist" / "preserve.txt"
        self.external.write_text("Existing bytes outside the repository")
        for workspace in WORKSPACES:
            output = self.root / workspace / "dist"
            output.mkdir(parents=True)
            (output / "existing.js").write_text("export const existing = true;\n")

    def run_clean(self):
        return subprocess.run(
            ["python3", str(self.root / "tooling" / "clean_build.py")],
            capture_output=True,
            text=True,
            check=False,
        )

    def replace_workspace_with_link(self, workspace):
        package = self.root / workspace
        shutil.rmtree(package)
        package.symlink_to(self.outside, target_is_directory=True)

    def test_rejects_first_package_symlink_and_preserves_external_bytes(self):
        self.replace_workspace_with_link(WORKSPACES[0])
        result = self.run_clean()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.external.read_text(), "Existing bytes outside the repository")

    def test_preflights_last_package_before_removing_any_prior_output(self):
        self.replace_workspace_with_link(WORKSPACES[-1])
        result = self.run_clean()
        self.assertNotEqual(result.returncode, 0)
        for workspace in WORKSPACES[:-1]:
            self.assertEqual(
                (self.root / workspace / "dist" / "existing.js").read_text(),
                "export const existing = true;\n",
            )
        self.assertEqual(self.external.read_text(), "Existing bytes outside the repository")

    def test_preflights_metadata_symlink_before_removing_any_output(self):
        metadata = self.root / WORKSPACES[-1] / "tsconfig.build.tsbuildinfo"
        metadata.symlink_to(self.external)
        result = self.run_clean()
        self.assertNotEqual(result.returncode, 0)
        for workspace in WORKSPACES:
            self.assertTrue((self.root / workspace / "dist" / "existing.js").is_file())
        self.assertTrue(metadata.is_symlink())
        self.assertEqual(self.external.read_text(), "Existing bytes outside the repository")


if __name__ == "__main__":
    unittest.main()
