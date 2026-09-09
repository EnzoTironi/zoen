#!/usr/bin/env python3
"""Operator G-PROVIDER qualify for OpenCode Zen (Eve).

Fail-closed when ZOEN_OPENCODE_API_KEY (or OPENCODE_API_KEY) is absent/blank.
Never prints key material. Does not flip tip frontier gates or claim full D05.

Usage (from repo root):
  pnpm eve:qualify-gprovider
  # or: python3 tests/integration/eve/gprovider/qualify.py

Exit codes:
  0 — live EX43 smoke passed (key present; evidence written under .local/)
  2 — fail-closed: key missing (no live call attempted)
  1 — key present but live smoke failed
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
EVIDENCE_DIR = ROOT / ".local" / "eve-gprovider-qualification"
EX43 = (
    "packages/ontology/test/ports/eve/opencode-zen.EX43.integration.test.ts"
)


def key_present() -> bool:
    for name in ("ZOEN_OPENCODE_API_KEY", "OPENCODE_API_KEY"):
        value = os.environ.get(name, "")
        if value.strip():
            return True
    # Optional local helper (gitignored); load names only — never print values.
    env_path = ROOT / ".local" / "opencode.env"
    if not env_path.is_file():
        return False
    for line in env_path.read_text(encoding="utf-8").splitlines():
        trimmed = line.strip()
        if not trimmed or trimmed.startswith("#") or "=" not in trimmed:
            continue
        key, _, raw = trimmed.partition("=")
        key = key.strip()
        value = raw.strip().strip("'").strip('"')
        if key in {"ZOEN_OPENCODE_API_KEY", "OPENCODE_API_KEY"} and value:
            # Populate for child vitest without echoing.
            os.environ.setdefault(key, value)
            return True
    return False


def write_evidence(payload: dict) -> Path:
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    path = EVIDENCE_DIR / "qualification.json"
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return path


def main() -> int:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    commit = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
    ).stdout.strip().lower()

    base = {
        "schema": "zoen.eve-gprovider-qualification/v1",
        "created_at": now,
        "commit": commit or None,
        "profile": "eve-opencode-zen-v1",
        "providerAdmission": "opencode-zen",
        "claims_rejected": [
            "full_d05",
            "textProfileAccepted_without_live_proof",
            "frontier_G-PROVIDER_flip_without_evidence",
            "key_logged",
        ],
    }

    if not key_present():
        evidence = {
            **base,
            "status": "Blocked",
            "G-PROVIDER": "Blocked",
            "textProfileAccepted": False,
            "reason": "ZOEN_OPENCODE_API_KEY (or OPENCODE_API_KEY) unset/blank; fail-closed — no live OpenCode call",
            "operator_next": [
                "Export ZOEN_OPENCODE_API_KEY in the shell (or write .local/opencode.env; never commit).",
                "Re-run: pnpm eve:qualify-gprovider",
                "Only after live EX43 passes may tip frontier flip G-PROVIDER / textProfileAccepted with real proof.",
            ],
        }
        path = write_evidence(evidence)
        print("G-PROVIDER: Blocked (key absent) — fail-closed; no live call.", file=sys.stderr)
        print(f"evidence: {path.relative_to(ROOT)}", file=sys.stderr)
        print("See docs/ops/eve-gprovider-operator-runbook.md", file=sys.stderr)
        return 2

    print("G-PROVIDER: key present (value not logged) — running EX43 live smoke…", file=sys.stderr)
    proc = subprocess.run(
        [
            "pnpm",
            "exec",
            "vitest",
            "run",
            "--project",
            "integration",
            EX43,
        ],
        cwd=ROOT,
        check=False,
    )
    if proc.returncode != 0:
        evidence = {
            **base,
            "status": "failed",
            "G-PROVIDER": "Blocked",
            "textProfileAccepted": False,
            "reason": "EX43 live smoke failed; tip gates remain Blocked",
            "ex43": EX43,
            "exit_code": proc.returncode,
        }
        path = write_evidence(evidence)
        print(f"G-PROVIDER: live smoke failed (exit {proc.returncode})", file=sys.stderr)
        print(f"evidence: {path.relative_to(ROOT)}", file=sys.stderr)
        return 1

    evidence = {
        **base,
        "status": "passed_live_boundary",
        "G-PROVIDER": "Qualified-live-boundary",
        "textProfileAccepted": False,
        "reason": (
            "Live OpenCode HTTP boundary EX43 passed. Product Eve admission / "
            "tip textProfileAccepted still require intentional frontier evidence PR; "
            "this script does not auto-flip tip gates."
        ),
        "ex43": EX43,
        "exit_code": 0,
        "operator_next": [
            "Open an evidence PR updating frontier G-PROVIDER / textProfileAccepted only with this live proof + tip SHA.",
            "Do not claim full D05 or activation-by-merge.",
        ],
    }
    path = write_evidence(evidence)
    print("G-PROVIDER: live boundary passed (tip gates not auto-flipped).", file=sys.stderr)
    print(f"evidence: {path.relative_to(ROOT)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
