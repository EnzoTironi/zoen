#!/usr/bin/env python3
"""Operator prep for H-01 / H-02 / G-OPS / G-STORAGE-FENCE (fail-closed).

Writes honest Blocked/Unknown evidence under .local/. Never destroys Fly apps,
volumes, or buckets. Never claims fullHostedErased / productAccepted true.
Never provisions managed Postgres or runs alchemy prod adopt.

Usage (from repo root):
  pnpm ops:prep-hosted-gates
  python3 tests/integration/hosted/gates/prep.py
  python3 tests/integration/hosted/gates/prep.py --candidate /path/to/candidate.json

Exit codes:
  2 — fail-closed prep complete (expected while product gates stay closed)
  1 — invalid input / attempted protected-resource binding in candidate
  0 — unused while Full hosted Erased remains closed
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Mapping

ROOT = Path(__file__).resolve().parents[4]
EVIDENCE_DIR = ROOT / ".local" / "hosted-gates-prep"

PROTECTED_APPS = frozenset({"zoen", "zoen-rebuild"})
PROTECTED_BUCKETS = frozenset({"zoen"})
PROTECTED_VOLUMES = frozenset({"zoen_data"})
RETAINED_PROFILES = frozenset(
    {"worlds-hosted-retained-v1", "worlds-local-retained-v1"}
)

RunCmd = Callable[..., subprocess.CompletedProcess[str]]


def git_head(run: RunCmd = subprocess.run) -> str:
    proc = run(
        ["git", "rev-parse", "HEAD"],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    return (proc.stdout or "").strip().lower()


def write_evidence(payload: dict[str, Any]) -> Path:
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    path = EVIDENCE_DIR / "prep.json"
    path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return path


def base_gates() -> dict[str, Any]:
    return {
        "H-01": "Blocked",
        "H-02": "Blocked",
        "G-OPS": "Unknown",
        "G-STORAGE-FENCE": "Blocked",
        "fullHostedErased": False,
        "productAccepted": False,
        "restoreAfterErasure": False,
        "cloudSpeechEnabled": False,
        "textProfileAccepted": False,
    }


def refuse_candidate(candidate: Mapping[str, Any]) -> dict[str, Any] | None:
    """Mirror ops/fly/erasable-target protected refusals (Python dry-run)."""
    app = str(candidate.get("appName", "")).strip()
    bucket = str(candidate.get("bucketName", "")).strip()
    volume = str(candidate.get("volumeName", "")).strip()
    profile = str(candidate.get("policyProfileId", "")).strip()

    if app == "zoen":
        return {
            "admitted": False,
            "reason": "legacy-app-zoen",
            "status": "Blocked",
        }
    if bucket in PROTECTED_BUCKETS:
        return {
            "admitted": False,
            "reason": "retained-bucket-name-reuse",
            "status": "Blocked",
        }
    if profile in RETAINED_PROFILES:
        return {
            "admitted": False,
            "reason": "retained-install-profile",
            "status": "Blocked",
        }
    if app in PROTECTED_APPS or volume in PROTECTED_VOLUMES:
        # zoen-rebuild / zoen_data are retained live identities — refuse as prep.
        return {
            "admitted": False,
            "reason": "retained-protected-resource",
            "status": "Blocked",
        }
    # Even optimistic non-protected candidates stay closed without H-02 authority.
    return {
        "admitted": False,
        "reason": "gates-incomplete",
        "status": "Blocked",
    }


def load_candidate(path: Path) -> dict[str, Any]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("candidate must be a JSON object")
    required = (
        "appName",
        "bucketName",
        "imageDigest",
        "installId",
        "policyProfileId",
        "volumeName",
    )
    missing = [k for k in required if k not in raw]
    if missing:
        raise ValueError(f"candidate missing keys: {', '.join(missing)}")
    return raw


def build_payload(
    *,
    head: str,
    candidate_path: str | None,
    decision: dict[str, Any] | None,
    notes: list[str],
) -> dict[str, Any]:
    return {
        "schema": "zoen.hosted-gates-prep/v1",
        "status": "Blocked",
        "observedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "tipCommit": head or None,
        "gates": base_gates(),
        "refusals": {
            "destroyZoenRebuild": True,
            "destroyLegacyZoen": True,
            "destroyZoenData": True,
            "managedPostgres": True,
            "alchemyProdAdopt": True,
            "claimFullHostedErased": True,
        },
        "candidatePath": candidate_path,
        "candidateDecision": decision,
        "localControllerSeam": {
            "compose": "ops/compose.erasure-controller.yaml",
            "qualifiesH01Hosted": False,
            "note": "Local ZA-11 declared rollback separation only — not hosted H-01.",
        },
        "gOpsInventory": {
            "script": "ops/fly/scripts/inventory.sh",
            "mode": "read-only-when-operator-runs",
            "autoQualified": False,
            "status": "Unknown",
        },
        "gStorageFence": {
            "observeStorageFenceQualification": "Blocked",
            "objectLockIsWriterFence": False,
            "docs": [
                "docs/verification/erasure-object-writer-containment.md",
                "docs/verification/erasure-fly-object-lock.md",
            ],
        },
        "checklist": "docs/ops/hosted-gates-operator-checklist.md",
        "notes": notes,
    }


def main(argv: list[str] | None = None, run: RunCmd = subprocess.run) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--candidate",
        type=str,
        default=None,
        help="Optional staging-only candidate JSON for refuse dry-run (no remote mutate)",
    )
    args = parser.parse_args(argv)

    head = git_head(run=run)
    notes = [
        "Prep evidence only — tip gates remain Blocked/Unknown.",
        "fullHostedErased stays false; no destroy of zoen/zoen-rebuild/zoen_data.",
        "Do not alchemy prod adopt; do not provision managed Postgres from this harness.",
    ]
    decision: dict[str, Any] | None = None
    candidate_path: str | None = None

    if args.candidate:
        candidate_path = args.candidate
        try:
            candidate = load_candidate(Path(args.candidate))
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            print(f"hosted-gates prep: invalid candidate: {exc}", file=sys.stderr)
            return 1
        decision = refuse_candidate(candidate)
        assert decision is not None
        notes.append(
            f"Candidate dry-run refused: reason={decision['reason']} status={decision['status']}"
        )
        # Protected-resource attempts are still exit 2 (honest refuse), not a
        # silent admit — exit 1 only for malformed input above.

    payload = build_payload(
        head=head,
        candidate_path=candidate_path,
        decision=decision,
        notes=notes,
    )
    # Hard invariant — never emit true for product activation literals.
    assert payload["gates"]["fullHostedErased"] is False
    assert payload["gates"]["productAccepted"] is False
    assert payload["gates"]["restoreAfterErasure"] is False
    if decision is not None:
        assert decision.get("admitted") is False

    path = write_evidence(payload)
    print(
        "hosted-gates prep: fail-closed complete "
        f"(H-01/H-02/G-STORAGE-FENCE Blocked; G-OPS Unknown; fullHostedErased false)\n"
        f"evidence: {path}",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
