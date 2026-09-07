"""Wipe local staging compose volumes and the staging profile install only.

Leaves .env.infra and other ZOEN_LOCAL_PROFILE installs (e.g. application) alone.
"""

from __future__ import annotations

import os
from pathlib import Path
import shutil
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
    if not infra.is_file():
        print("No .env.infra; nothing to reset.", file=sys.stderr)
        return 1
    if infra.is_symlink():
        print("Refusing to use a symlinked .env.infra", file=sys.stderr)
        return 1
    subprocess.check_call([*COMPOSE, "down", "--volumes"])
    profile_env = ROOT / f".env.{PROFILE}"
    profile_dir = ROOT / ".local" / PROFILE
    for path in (profile_env, profile_dir):
        if path.is_symlink():
            print(f"Refusing to remove symlink {path}", file=sys.stderr)
            return 1
        if path.is_file():
            path.unlink()
        elif path.is_dir():
            shutil.rmtree(path)
    print(
        f"Staging volumes and profile `{PROFILE}` removed. "
        "Run `pnpm staging:up` to recreate."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
