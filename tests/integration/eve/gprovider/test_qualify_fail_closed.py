"""Fail-closed unit proofs for G-PROVIDER qualify (no live network)."""

from __future__ import annotations

import importlib.util
import os
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
QUALIFY = Path(__file__).resolve().parent / "qualify.py"


def load_qualify():
    spec = importlib.util.spec_from_file_location("eve_gprovider_qualify", QUALIFY)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class QualifyFailClosedTest(unittest.TestCase):
    def test_key_present_false_when_env_blank(self) -> None:
        mod = load_qualify()
        saved = {
            k: os.environ.pop(k, None)
            for k in ("ZOEN_OPENCODE_API_KEY", "OPENCODE_API_KEY")
        }
        try:
            # Ensure blank does not count
            os.environ["ZOEN_OPENCODE_API_KEY"] = "   "
            # Temporarily hide .local/opencode.env by pointing cwd logic — key_present
            # reads ROOT/.local/opencode.env; if it exists with a key this would pass.
            # So only assert blank env key alone is insufficient when file absent OR
            # we monkeypatch Path.is_file — keep simple: blank string is not present
            # after strip inside key_present for env vars; file may still provide key.
            # Call key_present after clearing env; if local file has key, skip assert.
            env_file = ROOT / ".local" / "opencode.env"
            if env_file.is_file():
                self.skipTest(".local/opencode.env present on this machine")
            os.environ["ZOEN_OPENCODE_API_KEY"] = "   "
            self.assertFalse(mod.key_present())
            os.environ.pop("ZOEN_OPENCODE_API_KEY", None)
            self.assertFalse(mod.key_present())
        finally:
            for k, v in saved.items():
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v

    def test_cli_exit_2_when_key_absent(self) -> None:
        env = os.environ.copy()
        env.pop("ZOEN_OPENCODE_API_KEY", None)
        env.pop("OPENCODE_API_KEY", None)
        # Hide local env file for this subprocess via empty temp HOME? Script uses ROOT.
        # If opencode.env exists, skip.
        if (ROOT / ".local" / "opencode.env").is_file():
            self.skipTest(".local/opencode.env present on this machine")
        proc = subprocess.run(
            [sys.executable, str(QUALIFY)],
            cwd=ROOT,
            env=env,
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(proc.returncode, 2, proc.stderr)
        self.assertIn("Blocked", proc.stderr)
        self.assertNotRegex(proc.stderr, r"(?i)sk-|Bearer\s+\S{8}")
        evidence = ROOT / ".local" / "eve-gprovider-qualification" / "qualification.json"
        self.assertTrue(evidence.is_file())
        body = evidence.read_text(encoding="utf-8")
        self.assertIn('"G-PROVIDER": "Blocked"', body)
        self.assertIn('"textProfileAccepted": false', body)


if __name__ == "__main__":
    unittest.main()
