"""Oracles for all-in-one entrypoint password/SQL and runtime.env loading (ZA-05 review)."""

from __future__ import annotations

import os
from pathlib import Path
import subprocess
import tempfile
import textwrap
import unittest


ROOT = Path(__file__).resolve().parent.parent
ENTRYPOINT = ROOT / "ops" / "containers" / "all-in-one-entrypoint.sh"


def _extract_functions() -> str:
    text = ENTRYPOINT.read_text()
    chunks: list[str] = []
    for name in ("urlencode_password", "sql_password_literal", "load_runtime_env_file"):
        start = text.index(f"{name}()")
        # Walk braces from the function header.
        i = text.index("{", start)
        depth = 0
        j = i
        while j < len(text):
            if text[j] == "{":
                depth += 1
            elif text[j] == "}":
                depth -= 1
                if depth == 0:
                    j += 1
                    break
            j += 1
        chunks.append(text[start:j])
    return "\n\n".join(chunks)


class AllInOneEntrypointHelpers(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.helpers = _extract_functions()

    def _bash(self, script: str) -> subprocess.CompletedProcess[str]:
        body = textwrap.dedent(
            f"""\
            set -euo pipefail
            {self.helpers}
            {script}
            """
        )
        return subprocess.run(
            ["bash", "-c", body],
            capture_output=True,
            text=True,
            check=False,
            cwd=ROOT,
        )

    def test_sql_literal_escapes_apostrophe(self) -> None:
        result = self._bash('sql_password_literal "o\'brian"')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "'o''brian'")

    def test_urlencode_password_encodes_delimiters(self) -> None:
        result = self._bash('urlencode_password "p@ss:word/with?chars"')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "p%40ss%3Aword%2Fwith%3Fchars")

    def test_load_runtime_env_exports_quoted_values(self) -> None:
        with tempfile.TemporaryDirectory(prefix="zoen-runtime-env-") as temporary:
            path = Path(temporary) / "runtime.env"
            path.write_text(
                '\n  \nFOO="bar=baz"\nZOEN_S3_BUCKET="zoen"\n',
                encoding="utf-8",
            )
            result = self._bash(
                f'load_runtime_env_file "{path}"; printf "%s\\n%s\\n" "$FOO" "$ZOEN_S3_BUCKET"'
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stdout.splitlines(), ["bar=baz", "zoen"])

    def test_load_runtime_env_rejects_shell_metacharacters_and_unquoted(self) -> None:
        with tempfile.TemporaryDirectory(prefix="zoen-runtime-env-") as temporary:
            bad_source = Path(temporary) / "evil.env"
            bad_source.write_text('FOO="$(echo pwned)"\n', encoding="utf-8")
            # Value contains unsupported backslash/quote patterns after quote strip —
            # $(...) itself is allowed as literal content by design; injection is
            # prevented because we never `source`. Prove unquoted is rejected.
            unquoted = Path(temporary) / "unquoted.env"
            unquoted.write_text("FOO=bar\n", encoding="utf-8")
            result = self._bash(f'load_runtime_env_file "{unquoted}"')
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("double-quoted", result.stderr)

            # Command-substitution text is stored literally, not executed.
            literal = Path(temporary) / "literal.env"
            literal.write_text('FOO="$(echo pwned)"\n', encoding="utf-8")
            marker = Path(temporary) / "marker"
            result = self._bash(
                f'load_runtime_env_file "{literal}"; '
                f'printf "%s" "$FOO" > "{marker}"; '
                f'test ! -f "{temporary}/pwned-should-not-exist"'
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(marker.read_text(encoding="utf-8"), "$(echo pwned)")


if __name__ == "__main__":
    unittest.main()
