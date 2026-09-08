"""Static oracles for ZA-06 all-in-one install lifecycle entrypoint."""

from __future__ import annotations

import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
ENTRYPOINT = ROOT / "ops" / "containers" / "all-in-one-entrypoint.sh"
BOOTSTRAP = ROOT / "apps" / "server" / "scripts" / "all-in-one-bootstrap.ts"
ALIGN = ROOT / "apps" / "server" / "src" / "all-in-one-release-align.ts"


class AllInOneEntrypointZa06Test(unittest.TestCase):
    def setUp(self) -> None:
        self.source = ENTRYPOINT.read_text(encoding="utf-8")
        self.bootstrap = BOOTSTRAP.read_text(encoding="utf-8")
        self.align = ALIGN.read_text(encoding="utf-8")

    def test_rustfs_readiness_env_precedes_node(self) -> None:
        # Trailing `node -e '...' U=...` puts U in argv; process.env.U stays unset.
        self.assertNotRegex(
            self.source,
            r"node --input-type=module -e\\\n\s+'[^']*'\\\n\s*U=",
        )
        self.assertIn(
            'U="http://127.0.0.1:9000/health/ready" node --input-type=module -e',
            self.source,
        )

    def test_supervisor_observes_dependency_exits(self) -> None:
        self.assertIn("supervise_dependencies", self.source)
        self.assertIn("supervisor-failure.txt", self.source)
        self.assertIn("RUSTFS_EXIT", self.source)
        self.assertIn("POSTGRES_NOT_READY", self.source)
        self.assertIn("MONITOR_PID", self.source)
        # Stale markers from prior boots must not poison a healthy exit status.
        self.assertIn('rm -f "${ZOEN_STATE}/supervisor-failure.txt"', self.source)
        # Dependency-driven nonzero wait must still reach cleanup (set -e safe).
        self.assertIn('if wait "${SERVER_PID}"; then', self.source)
        self.assertIn("trap cleanup TERM INT EXIT", self.source)

    def test_bootstrap_refuses_silent_digest_rewrite(self) -> None:
        self.assertIn("RESET_REQUIRED", self.align)
        self.assertIn("ZA-08 seam", self.bootstrap)
        self.assertIn("maybeCrashAfter", self.bootstrap)
        self.assertIn("writeAtomicString", self.bootstrap)
        self.assertIn("pending-s3-app-credentials.env", self.bootstrap)
        self.assertIn("parseHostedInstallationFile", self.bootstrap)
        self.assertIn("bootstrapSameReleaseRestart", self.bootstrap)
        self.assertIn("admitIncompleteInstallation", self.bootstrap)
        # Marker path: ZA-08 seam wraps runHostedReleaseRestartSeams
        # (migrate-then-align on admitted tip upgrade; align-then-migrate otherwise).
        helper = self.bootstrap.split(
            "function* sameReleaseRestart()", 1
        )[1].split("const program =", 1)[0]
        self.assertIn("runHostedReleaseRestartSeams", helper)
        seam = helper.index("ZA-08 seam")
        align = helper.index("alignExistingHostedRelease")
        migrate = helper.index("migrateExistingVolumeSchema")
        self.assertLess(seam, align)
        self.assertLess(seam, migrate)
        # Incomplete install under a different image must refuse before DDL.
        self.assertLess(
            self.bootstrap.index("admitIncompleteInstallation"),
            self.bootstrap.index("ensureDatabaseAndRoles"),
        )


if __name__ == "__main__":
    unittest.main()
