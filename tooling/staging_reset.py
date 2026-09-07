"""Reset only the staging profile install owned by this checkout.

Shared Compose services stay up. Default reset never runs
`compose down --volumes` (that would wipe every local profile's data).
Whole-infrastructure wipe is an explicit opt-in that enumerates installs.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from typing import Any
from urllib.parse import urlparse

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
SCHEMA = "local-profile-resources.v1"
COMPOSE_PROJECT = "zoen-rebuild"
DATABASE_RE = re.compile(r"^zoen_local_[0-9a-f]{24}$")
BUCKET_RE = re.compile(r"^zoen-local-[0-9a-f]{24}$")
ROLE_RE = re.compile(r"^zoen_(authority|identity|migration|progress)_[0-9a-f]{24}$")


def _lexical_under_root(root: Path, path: Path) -> Path:
    """Absolute path under root without following the final symlink target."""
    root = root.resolve()
    absolute = path if path.is_absolute() else root / path
    absolute = absolute.absolute()
    # macOS maps /var -> /private/var; keep lexical leaf for symlink detection.
    text = str(absolute)
    root_text = str(root)
    if text.startswith("/var/") and root_text.startswith("/private/var/"):
        absolute = Path("/private" + text)
    return absolute


def ensure_no_symlinks(root: Path, path: Path) -> None:
    root = root.resolve()
    absolute = _lexical_under_root(root, path)
    try:
        parts = absolute.relative_to(root).parts
    except ValueError as exc:
        raise ValueError(f"Staging path escapes checkout: {path}") from exc
    cursor = root
    for part in parts:
        cursor /= part
        if cursor.is_symlink():
            raise ValueError(f"Refusing symlinked staging path: {cursor}")


def parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key] = value.strip().strip('"')
    return values


def require_local_url(label: str, value: str) -> None:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "postgresql", "postgres"}:
        raise ValueError(f"{label} must be a local URL")
    host = parsed.hostname or ""
    if host not in {"127.0.0.1", "localhost"}:
        raise ValueError(f"Refusing hosted or foreign endpoint for {label}: {host}")


def profile_paths(root: Path) -> tuple[Path, Path]:
    return root / f".env.{PROFILE}", root / ".local" / PROFILE


def operation_path(root: Path) -> Path:
    return root / ".local" / PROFILE / "reset-operation.json"


def load_inventory(root: Path) -> dict[str, Any]:
    """Build ownership inventory from resources.json or provision.json."""
    env_path, profile_dir = profile_paths(root)
    resources_path = profile_dir / "resources.json"
    provision_path = profile_dir / "provision.json"

    for path in (
        root / ".env.infra",
        env_path,
        root / ".local",
        profile_dir,
        resources_path,
        provision_path,
        profile_dir / "installation.json",
    ):
        if path.exists() or path.is_symlink():
            ensure_no_symlinks(root, path)

    if resources_path.is_file():
        inventory = json.loads(resources_path.read_text())
    elif provision_path.is_file():
        provision = json.loads(provision_path.read_text())
        inventory = {
            "schemaVersion": SCHEMA,
            "profile": PROFILE,
            "checkout": str(root.resolve()),
            "composeProject": COMPOSE_PROJECT,
            "databaseName": provision.get("databaseName"),
            "bucket": provision.get("bucket"),
            "roleNames": list((provision.get("names") or {}).values()),
        }
    else:
        raise ValueError(
            "No staging ownership inventory (.local/staging/resources.json or provision.json)"
        )

    if inventory.get("schemaVersion") not in {SCHEMA, "staging-resources.v1"}:
        raise ValueError("Unknown staging resource schema; refuse automatic reset")
    if inventory.get("profile") not in {None, PROFILE}:
        raise ValueError("Inventory profile is not staging; refuse automatic reset")
    if inventory.get("composeProject") not in {None, COMPOSE_PROJECT}:
        raise ValueError(
            f"Foreign Compose project {inventory.get('composeProject')!r}; refuse automatic reset"
        )
    checkout = inventory.get("checkout")
    if checkout is not None and Path(checkout).resolve() != root.resolve():
        raise ValueError("Inventory checkout does not match this repository root")

    database_name = inventory.get("databaseName")
    bucket = inventory.get("bucket")
    if not isinstance(database_name, str) or not DATABASE_RE.fullmatch(database_name):
        raise ValueError("Malformed owned database name in staging inventory")
    if not isinstance(bucket, str) or not BUCKET_RE.fullmatch(bucket):
        raise ValueError("Malformed owned bucket name in staging inventory")

    role_names = inventory.get("roleNames") or []
    if not isinstance(role_names, list) or not role_names:
        raise ValueError("Staging inventory missing roleNames")
    for role in role_names:
        if not isinstance(role, str) or not ROLE_RE.fullmatch(role):
            raise ValueError(f"Malformed owned role name: {role!r}")

    if env_path.is_file():
        env = parse_env_file(env_path)
        for key in ("ZOEN_PUBLIC_URL", "ZOEN_S3_ENDPOINT"):
            if key in env:
                require_local_url(key, env[key])
        if env.get("ZOEN_S3_BUCKET") not in {None, bucket}:
            raise ValueError("Staging env bucket does not match ownership inventory")

    infra = root / ".env.infra"
    if not infra.is_file():
        raise ValueError("No .env.infra; cannot verify local admin path")
    infra_env = parse_env_file(infra)
    for key in ("ZOEN_TEST_DATABASE_URL", "ZOEN_TEST_S3_ENDPOINT"):
        if key not in infra_env:
            raise ValueError(f".env.infra missing {key}")
        require_local_url(key, infra_env[key])

    return {
        "schemaVersion": SCHEMA,
        "profile": PROFILE,
        "checkout": str(root.resolve()),
        "composeProject": COMPOSE_PROJECT,
        "databaseName": database_name,
        "bucket": bucket,
        "roleNames": role_names,
    }


def write_operation(root: Path, inventory: dict[str, Any], status: str) -> None:
    folder = root / ".local" / PROFILE
    folder.mkdir(parents=True, exist_ok=True, mode=0o700)
    ensure_no_symlinks(root, folder)
    payload = {
        "status": status,
        "profile": PROFILE,
        "inventory": inventory,
    }
    path = operation_path(root)
    if path.is_symlink():
        raise ValueError(f"Refusing symlinked reset operation file: {path}")
    path.write_text(json.dumps(payload, indent=2) + "\n")
    os.chmod(path, 0o600)


def read_operation(root: Path) -> dict[str, Any] | None:
    path = operation_path(root)
    if path.is_symlink():
        raise ValueError(f"Refusing symlinked reset operation file: {path}")
    if not path.is_file():
        return None
    return json.loads(path.read_text())


def remove_profile_files(root: Path) -> None:
    env_path, profile_dir = profile_paths(root)
    ensure_no_symlinks(root, env_path)
    if env_path.is_file():
        env_path.unlink()
    ensure_no_symlinks(root, profile_dir)
    if profile_dir.is_dir():
        for item in sorted(profile_dir.rglob("*"), reverse=True):
            ensure_no_symlinks(root, item)
        shutil.rmtree(profile_dir)


def deprovision_owned(root: Path, inventory: dict[str, Any]) -> None:
    env = {
        **os.environ,
        "ZOEN_LOCAL_PROFILE": PROFILE,
        "ZOEN_LOCAL_RESET_DATABASE": inventory["databaseName"],
        "ZOEN_LOCAL_RESET_BUCKET": inventory["bucket"],
        "ZOEN_LOCAL_RESET_ROLES": ",".join(inventory["roleNames"]),
    }
    subprocess.check_call(
        [
            "node",
            "--env-file=.env.infra",
            "ops/local/provision.ts",
            "--reset-owned",
        ],
        cwd=root,
        env=env,
    )


def enumerate_local_profiles(root: Path) -> list[str]:
    names: list[str] = []
    for path in sorted(root.glob(".env.*")):
        if path.name in {".env.infra"} or path.is_symlink():
            continue
        suffix = path.name.removeprefix(".env.")
        if re.fullmatch(r"[a-z][a-z0-9-]{0,31}", suffix):
            names.append(suffix)
    return names


def wipe_shared_volumes(root: Path) -> int:
    profiles = enumerate_local_profiles(root)
    print(
        "Explicit shared-volume wipe will affect local profiles: "
        + (", ".join(profiles) if profiles else "(none found)"),
        file=sys.stderr,
    )
    infra = root / ".env.infra"
    if not infra.is_file() or infra.is_symlink():
        print("Refusing wipe without a regular .env.infra", file=sys.stderr)
        return 1
    subprocess.check_call([*COMPOSE, "down", "--volumes"], cwd=root)
    print("Shared Compose volumes removed after explicit opt-in.")
    return 0


def reset_owned_profile(root: Path) -> int:
    existing = read_operation(root)
    if existing is not None and existing.get("status") == "started":
        inventory = existing.get("inventory")
        if not isinstance(inventory, dict):
            raise ValueError("Incomplete reset operation has unusable inventory; blocked")
        # Resume from recorded inventory; neighboring installs stay untouched.
        validated = {
            "schemaVersion": SCHEMA,
            "profile": PROFILE,
            "checkout": str(root.resolve()),
            "composeProject": COMPOSE_PROJECT,
            "databaseName": inventory["databaseName"],
            "bucket": inventory["bucket"],
            "roleNames": inventory["roleNames"],
        }
        if not DATABASE_RE.fullmatch(validated["databaseName"]):
            raise ValueError("Blocked: recorded reset database name is invalid")
        if not BUCKET_RE.fullmatch(validated["bucket"]):
            raise ValueError("Blocked: recorded reset bucket name is invalid")
    else:
        # Refuse before any mutation when inventory/paths are unsafe.
        if not (root / f".env.{PROFILE}").exists() and not (root / ".local" / PROFILE).exists():
            print("No staging profile install to reset.", file=sys.stderr)
            return 1
        validated = load_inventory(root)
        write_operation(root, validated, "started")

    deprovision_owned(root, validated)
    remove_profile_files(root)
    print(
        "Staging profile resources owned by this checkout were removed. "
        "Shared Compose volumes and other profiles were not targeted. "
        "Run `pnpm staging:up` to recreate."
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    os.chdir(ROOT)
    try:
        if "--wipe-shared-volumes" in argv:
            if "--i-accept-removing-all-local-profiles" not in argv:
                print(
                    "Refusing shared volume wipe without "
                    "--i-accept-removing-all-local-profiles "
                    f"(profiles: {', '.join(enumerate_local_profiles(ROOT)) or 'none'})",
                    file=sys.stderr,
                )
                return 1
            return wipe_shared_volumes(ROOT)
        return reset_owned_profile(ROOT)
    except (ValueError, OSError, json.JSONDecodeError, subprocess.CalledProcessError) as exc:
        print(f"Staging reset refused or incomplete: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
