"""Bring up disposable local staging: infra env, compose, staging profile.

No Fly staging. Uses ZOEN_LOCAL_PROFILE=staging so the default application
install is never overwritten.
"""

from __future__ import annotations

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


def main() -> int:
    os.chdir(ROOT)
    infra = ROOT / ".env.infra"
    if infra.is_symlink():
        print("Refusing to use a symlinked .env.infra", file=sys.stderr)
        return 1
    if not infra.is_file():
        subprocess.check_call([sys.executable, str(ROOT / "tooling" / "prepare_infra.py")])
    subprocess.check_call([*COMPOSE, "up", "-d", "--wait"])
    profile_env = ROOT / f".env.{PROFILE}"
    if profile_env.is_symlink():
        print(f"Refusing to use a symlinked .env.{PROFILE}", file=sys.stderr)
        return 1
    if profile_env.is_file():
        print(
            f"Staging profile already provisioned (.env.{PROFILE}). Compose is up.\n"
            f"Start with: ZOEN_LOCAL_PROFILE={PROFILE} pnpm start:server"
        )
        return 0
    env = {**os.environ, "ZOEN_LOCAL_PROFILE": PROFILE}
    subprocess.check_call(["pnpm", "provision:local"], env=env)
    print(
        f"Staging ready. Start with: ZOEN_LOCAL_PROFILE={PROFILE} pnpm start:server"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
