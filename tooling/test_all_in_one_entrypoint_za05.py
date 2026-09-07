"""Static oracles for ZA-05 all-in-one entrypoint hardening."""

from __future__ import annotations

import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
ENTRYPOINT = ROOT / "ops" / "containers" / "all-in-one-entrypoint.sh"


class AllInOneEntrypointZa05Test(unittest.TestCase):
    def setUp(self) -> None:
        self.source = ENTRYPOINT.read_text(encoding="utf-8")

    def test_bootstrap_failure_does_not_use_negation_status(self) -> None:
        # `if ! node ...; then status=$?` captures the negated status (0 on failure).
        self.assertIsNone(
            re.search(r"if\s+!\s+node\s+/app/apps/server/scripts/all-in-one-bootstrap", self.source)
        )
        self.assertIn("if node /app/apps/server/scripts/all-in-one-bootstrap.ts; then", self.source)
        self.assertIn("status=$?", self.source)

    def test_password_uses_psql_literal_binding(self) -> None:
        self.assertNotRegex(
            self.source,
            r"ALTER ROLE zoen_infra WITH LOGIN PASSWORD '\$\{PG_INFRA_PASSWORD\}'",
        )
        self.assertIn("PASSWORD :'infra_pw'", self.source)
        self.assertIn('-v "infra_pw=${PG_INFRA_PASSWORD}"', self.source)

    def test_runtime_env_not_sourced_as_root(self) -> None:
        self.assertNotRegex(self.source, r"^\s*source\s+\"\$\{ZOEN_RUNTIME_ENV_FILE\}\"", re.M)
        self.assertIn("load_runtime_env_file", self.source)

    def test_bootstrap_dir_outside_zoen_state(self) -> None:
        self.assertIn('BOOTSTRAP_DIR="${ZOEN_BOOTSTRAP_DIR:-${DATA_ROOT}/bootstrap}"', self.source)
        self.assertNotIn('BOOTSTRAP_DIR="${ZOEN_BOOTSTRAP_DIR:-${ZOEN_STATE}/bootstrap}"', self.source)


if __name__ == "__main__":
    unittest.main()
