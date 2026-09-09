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
  1 — invalid environment/input or protected retained-resource attempt
  0 — unused while Full hosted Erased remains closed
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Mapping

ROOT = Path(__file__).resolve().parents[4]
EVIDENCE_DIR = ROOT / ".local" / "hosted-gates-prep"
EVIDENCE_FILE = "prep.json"

PROTECTED_APPS = frozenset({"zoen", "zoen-rebuild"})
PROTECTED_BUCKETS = frozenset({"zoen"})
PROTECTED_VOLUMES = frozenset({"zoen_data"})
RETAINED_PROFILES = frozenset(
    {"worlds-hosted-retained-v1", "worlds-local-retained-v1"}
)
SUPPORTED_PROFILES = RETAINED_PROFILES | frozenset({"worlds-hosted-erasable-v1"})
CANDIDATE_FIELDS = (
    "appName",
    "bucketName",
    "imageDigest",
    "installId",
    "policyProfileId",
    "volumeName",
)
MAX_IDENTITY_LENGTH = 128
PROTECTED_REASONS = frozenset(
    {
        "legacy-app-zoen",
        "retained-bucket-name-reuse",
        "retained-install-profile",
        "retained-protected-resource",
    }
)
COMMIT_RE = re.compile(r"^[0-9a-f]{7,64}$")

RunCmd = Callable[..., subprocess.CompletedProcess[str]]


def evidence_path() -> Path:
    return EVIDENCE_DIR / EVIDENCE_FILE


def clear_stale_evidence() -> None:
    """Never let an invalid run leave an older result at the documented path."""
    try:
        evidence_path().unlink(missing_ok=True)
    except OSError as exc:
        raise ValueError(f"cannot clear stale evidence: {exc}") from exc


def git_head(run: RunCmd = subprocess.run) -> str:
    proc = run(
        ["git", "rev-parse", "HEAD"],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    head = (proc.stdout or "").strip().lower()
    if proc.returncode != 0 or not COMMIT_RE.fullmatch(head):
        raise ValueError("cannot bind prep evidence to a valid git commit")
    return head


def write_evidence(payload: dict[str, Any]) -> Path:
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    path = evidence_path()
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    temporary.replace(path)
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


def validate_candidate(raw: Mapping[str, Any]) -> dict[str, str]:
    """Validate the exact public candidate shape before any classification."""
    missing = [field for field in CANDIDATE_FIELDS if field not in raw]
    if missing:
        raise ValueError(f"candidate missing keys: {', '.join(missing)}")
    extra = sorted(set(raw) - set(CANDIDATE_FIELDS))
    if extra:
        raise ValueError(f"candidate has unsupported keys: {', '.join(extra)}")

    candidate: dict[str, str] = {}
    for field in CANDIDATE_FIELDS:
        value = raw[field]
        if not isinstance(value, str):
            raise ValueError(f"candidate {field} must be a string")
        value = value.strip()
        if not value:
            raise ValueError(f"candidate {field} must not be blank")
        if len(value) > MAX_IDENTITY_LENGTH:
            raise ValueError(
                f"candidate {field} exceeds {MAX_IDENTITY_LENGTH} characters"
            )
        candidate[field] = value

    if candidate["policyProfileId"] not in SUPPORTED_PROFILES:
        raise ValueError("candidate policyProfileId is unsupported")
    return candidate


def refuse_candidate(candidate: Mapping[str, str]) -> dict[str, Any]:
    """Mirror admission protected refusals plus stronger prep-only protections."""
    app = candidate["appName"]
    bucket = candidate["bucketName"]
    volume = candidate["volumeName"]
    profile = candidate["policyProfileId"]

    if app == "zoen":
        return {"admitted": False, "reason": "legacy-app-zoen", "status": "Blocked"}
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
        return {
            "admitted": False,
            "reason": "retained-protected-resource",
            "status": "Blocked",
        }
    return {"admitted": False, "reason": "gates-incomplete", "status": "Blocked"}


def load_candidate(path: Path) -> dict[str, str]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("candidate must be a JSON object")
    return validate_candidate(raw)


def candidate_digest(candidate: Mapping[str, str]) -> str:
    canonical = json.dumps(
        dict(candidate), sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")
    return f"sha256:{hashlib.sha256(canonical).hexdigest()}"


def build_payload(
    *,
    head: str,
    candidate_path: str | None,
    candidate: dict[str, str] | None,
    decision: dict[str, Any] | None,
    notes: list[str],
) -> dict[str, Any]:
    return {
        "schema": "zoen.hosted-gates-prep/v1",
        "status": "Blocked",
        "observedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "tipCommit": head,
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
        "candidateSnapshot": candidate,
        "candidateSha256": candidate_digest(candidate) if candidate else None,
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

    try:
        clear_stale_evidence()
        head = git_head(run=run)
    except ValueError as exc:
        print(f"hosted-gates prep: invalid environment: {exc}", file=sys.stderr)
        return 1

    notes = [
        "Prep evidence only — tip gates remain Blocked/Unknown.",
        "fullHostedErased stays false; no destroy of zoen/zoen-rebuild/zoen_data.",
        "Do not alchemy prod adopt; do not provision managed Postgres from this harness.",
    ]
    decision: dict[str, Any] | None = None
    candidate: dict[str, str] | None = None
    candidate_path: str | None = None

    if args.candidate:
        candidate_path = args.candidate
        try:
            candidate = load_candidate(Path(args.candidate))
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            print(f"hosted-gates prep: invalid candidate: {exc}", file=sys.stderr)
            return 1
        decision = refuse_candidate(candidate)
        notes.append(
            f"Candidate dry-run refused: reason={decision['reason']} status={decision['status']}"
        )

    payload = build_payload(
        head=head,
        candidate_path=candidate_path,
        candidate=candidate,
        decision=decision,
        notes=notes,
    )
    assert payload["gates"]["fullHostedErased"] is False
    assert payload["gates"]["productAccepted"] is False
    assert payload["gates"]["restoreAfterErasure"] is False
    if decision is not None:
        assert decision.get("admitted") is False

    path = write_evidence(payload)
    protected_attempt = bool(
        decision is not None and decision.get("reason") in PROTECTED_REASONS
    )
    result = "protected input refused" if protected_attempt else "fail-closed complete"
    print(
        f"hosted-gates prep: {result} "
        f"(H-01/H-02/G-STORAGE-FENCE Blocked; G-OPS Unknown; fullHostedErased false)\n"
        f"evidence: {path}",
        file=sys.stderr,
    )
    return 1 if protected_attempt else 2


if __name__ == "__main__":
    raise SystemExit(main())
