"""Bring up disposable local staging: infra env, compose, staging profile.

No Fly staging. Uses ZOEN_LOCAL_PROFILE=staging so the default application
install is never overwritten. Shared Compose stays the application/CI path;
staging only adds an owned profile inventory inside that project.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
COMPOSE = (
    "docker",
    "compose",
    "--env-file",
    ".env.infra",
    "-f",
    "ops/compose.yaml",
)
PROFILE = "staging"


def refuse_symlink(path: Path, label: str) -> None:
    if path.is_symlink():
        raise ValueError(f"Refusing to use a symlinked {label}: {path}")


def assert_ready_or_absent(root: Path) -> None:
    """Reject stale / partial staging pointers instead of skipping provision."""
    env_path = root / f".env.{PROFILE}"
    local_parent = root / ".local"
    profile_dir = local_parent / PROFILE
    operation = profile_dir / "reset-operation.json"
    refuse_symlink(local_parent, ".local")
    refuse_symlink(env_path, f".env.{PROFILE}")
    refuse_symlink(profile_dir, f".local/{PROFILE}")
    refuse_symlink(operation, "reset-operation.json")

    if operation.is_file():
        payload = json.loads(operation.read_text())
        if not isinstance(payload, dict):
            raise ValueError("Malformed reset-operation.json; expected object")
        if payload.get("status") == "started":
            raise ValueError(
                "Incomplete staging reset recorded; finish or clear with "
                "`pnpm staging:reset` before staging:up (no phantom ready env)"
            )

    if env_path.is_file():
        installation = profile_dir / "installation.json"
        provision = profile_dir / "provision.json"
        resources = profile_dir / "resources.json"
        ready = profile_dir / "ready.json"
        for path, label in (
            (installation, "installation.json"),
            (provision, "provision.json"),
            (resources, "resources.json"),
            (ready, "ready.json"),
        ):
            refuse_symlink(path, label)
        if (
            not installation.is_file()
            or not provision.is_file()
            or not resources.is_file()
        ):
            raise ValueError(
                "Partial staging install (.env.staging without installation/"
                "provision/resources inventory); run `pnpm staging:reset` then staging:up"
            )
        if not ready.is_file():
            # Files written before DB/bucket creation do not prove provision finished.
            raise ValueError(
                "Partial staging install (missing ready.json completion marker); "
                "run `pnpm staging:reset` then staging:up"
            )
        print(
            f"Staging profile already provisioned (.env.{PROFILE}). Compose is up.\n"
            f"Start with: ZOEN_LOCAL_PROFILE={PROFILE} pnpm start:server"
        )
        return

    if profile_dir.exists() and any(profile_dir.iterdir()):
        raise ValueError(
            "Stale .local/staging without .env.staging; "
            "run `pnpm staging:reset` before staging:up"
        )


def main() -> int:
    os.chdir(ROOT)
    try:
        infra = ROOT / ".env.infra"
        refuse_symlink(infra, ".env.infra")
        if not infra.is_file():
            subprocess.check_call([sys.executable, str(ROOT / "tooling" / "prepare_infra.py")])
        subprocess.check_call([*COMPOSE, "up", "-d", "--wait"])
        assert_ready_or_absent(ROOT)
        env_path = ROOT / f".env.{PROFILE}"
        if env_path.is_file():
            return 0
        env = {**os.environ, "ZOEN_LOCAL_PROFILE": PROFILE}
        subprocess.check_call(["pnpm", "provision:local"], env=env)
        print(
            f"Staging ready. Start with: ZOEN_LOCAL_PROFILE={PROFILE} pnpm start:server"
        )
        return 0
    except (ValueError, OSError, json.JSONDecodeError, subprocess.CalledProcessError) as exc:
        print(f"Staging unavailable: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
