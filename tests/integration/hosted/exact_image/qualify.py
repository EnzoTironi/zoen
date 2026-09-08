#!/usr/bin/env python3
"""Build the all-in-one image once, run ZA-05/ZA-06 seams, emit admission evidence.

Optional GHCR push (main only) records an immutable registry digest for Deploy.
App-only `tooling/verify_container.py` remains a separate profile and never admits Fly.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from admission import PROFILE_ALL_IN_ONE, REQUIRED_SEAM_CHECKS, SCHEMA  # noqa: E402


def run(args: list[str], **options):
    options.setdefault("check", True)
    return subprocess.run(args, cwd=ROOT, **options)


def git_commit() -> str:
    explicit = os.environ.get("GITHUB_SHA") or os.environ.get("ZOEN_ADMISSION_COMMIT")
    if explicit:
        return explicit.strip().lower()
    return run(["git", "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip().lower()


def image_id(image: str) -> str:
    return run(
        ["docker", "image", "inspect", "--format", "{{.Id}}", image],
        capture_output=True,
        text=True,
    ).stdout.strip()


def load_json(path: Path) -> dict:
    return json.loads(path.read_text())


def find_latest_result(kind: str) -> Path:
    local = ROOT / ".local"
    if kind == "identity":
        pattern = "za05-*-identity/result.json"
    elif kind == "lifecycle":
        pattern = "za06-*-lifecycle/result.json"
    else:
        raise ValueError(f"unknown result kind: {kind}")
    candidates = sorted(local.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)
    if not candidates:
        raise RuntimeError(f"missing {kind} result.json under .local/ ({pattern})")
    return candidates[0]


def ghcr_repository() -> str:
    repo = os.environ.get("GITHUB_REPOSITORY", "EnzoTironi/zoen")
    owner, _, name = repo.partition("/")
    if not owner or not name:
        raise RuntimeError(f"invalid GITHUB_REPOSITORY: {repo!r}")
    return f"ghcr.io/{owner.lower()}/{name.lower()}/all-in-one"


def maybe_push(image: str, commit: str) -> tuple[str | None, str | None, str | None]:
    """Return (repository, digest, reference) when push is enabled."""
    if os.environ.get("ZOEN_EXACT_IMAGE_PUSH", "0") != "1":
        print("Skipping registry push (ZOEN_EXACT_IMAGE_PUSH!=1)", flush=True)
        return None, None, None
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if not token:
        raise RuntimeError("GITHUB_TOKEN required to push exact image")
    user = os.environ.get("GITHUB_ACTOR") or "github-actions"
    repository = ghcr_repository()
    tag = f"sha-{commit}"
    remote = f"{repository}:{tag}"
    login = subprocess.run(
        ["docker", "login", "ghcr.io", "-u", user, "--password-stdin"],
        cwd=ROOT,
        input=token,
        text=True,
        capture_output=True,
        check=False,
    )
    if login.returncode != 0:
        raise RuntimeError(f"docker login ghcr.io failed: {login.stderr}")
    run(["docker", "tag", image, remote])
    run(["docker", "push", remote])
    inspect = run(
        ["docker", "image", "inspect", "--format", "{{json .RepoDigests}}", remote],
        capture_output=True,
        text=True,
    ).stdout.strip()
    digests = json.loads(inspect)
    prefix = repository + "@"
    matched = [item for item in digests if item.startswith(prefix)]
    if not matched:
        raise RuntimeError(f"no RepoDigest for {repository} after push; observed={digests!r}")
    reference = matched[0]
    digest = reference.split("@", 1)[1]
    print(f"Pushed exact image {reference}", flush=True)
    return repository, digest, reference


def main() -> int:
    commit = git_commit()
    if len(commit) != 40:
        raise RuntimeError(f"refusing non-full commit SHA: {commit!r}")
    artifacts = ROOT / ".local" / f"exact-{commit[:12]}-admission"
    artifacts.mkdir(mode=0o700, parents=True)

    image = f"zoen-all-in-one:exact-{commit[:12]}"
    print(f"Building exact all-in-one once: {image}", flush=True)
    with (artifacts / "build.log").open("x") as log:
        run(
            [
                "docker",
                "build",
                "-f",
                "ops/containers/all-in-one.Dockerfile",
                "-t",
                image,
                ".",
            ],
            stdout=log,
            stderr=subprocess.STDOUT,
        )
    built_id = image_id(image)

    env = os.environ.copy()
    env["ZOEN_IDENTITY_IMAGE"] = image
    env["ZOEN_LIFECYCLE_IMAGE"] = image
    print("Running identity seam against exact image", flush=True)
    run([sys.executable, "tests/integration/hosted/identity/probe_all_in_one_identity.py"], env=env)
    print("Running lifecycle seam against exact image", flush=True)
    run([sys.executable, "tests/integration/hosted/lifecycle/probe_all_in_one_lifecycle.py"], env=env)

    identity_path = find_latest_result("identity")
    lifecycle_path = find_latest_result("lifecycle")
    identity = load_json(identity_path)
    lifecycle = load_json(lifecycle_path)
    if identity.get("imageId") != built_id or lifecycle.get("imageId") != built_id:
        raise RuntimeError(
            "seam reports imageId diverged from the exact build "
            f"(built={built_id} identity={identity.get('imageId')} lifecycle={lifecycle.get('imageId')})"
        )

    repository, digest, reference = maybe_push(image, commit)
    tag = f"sha-{commit}"
    checks = list(REQUIRED_SEAM_CHECKS)
    admission = {
        "schema": SCHEMA,
        "status": "passed",
        "profile": PROFILE_ALL_IN_ONE,
        "commit": commit,
        "ref": os.environ.get("GITHUB_REF"),
        "workflow": "verify.yml",
        "run_id": int(os.environ["GITHUB_RUN_ID"]) if os.environ.get("GITHUB_RUN_ID") else None,
        "run_attempt": int(os.environ["GITHUB_RUN_ATTEMPT"]) if os.environ.get("GITHUB_RUN_ATTEMPT") else None,
        "checks": checks,
        "reports": {
            "identity": identity,
            "lifecycle": lifecycle,
        },
        "image": {
            "local_tag": image,
            "image_id": built_id,
            "repository": repository,
            "tag": tag if repository else None,
            "digest": digest,
            "reference": reference,
        },
        "created_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    out = artifacts / "admission.json"
    out.write_text(json.dumps(admission, indent=2) + "\n")
    # Stable path for CI artifact upload
    stable = ROOT / ".local" / "exact-image-admission"
    stable.mkdir(mode=0o700, parents=True)
    (stable / "admission.json").write_text(json.dumps(admission, indent=2) + "\n")
    (stable / "identity-result.json").write_text(identity_path.read_text())
    (stable / "lifecycle-result.json").write_text(lifecycle_path.read_text())
    print(f"Wrote admission evidence to {stable / 'admission.json'}", flush=True)
    print(f"Exact image qualified: {image} ({built_id})", flush=True)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:  # noqa: BLE001
        print(f"Exact-image qualification failed: {error}", file=sys.stderr)
        raise SystemExit(1)
