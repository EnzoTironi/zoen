"""Build the frozen, pre-identity executable used to create real compatibility history."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tarfile


ROOT = Path(__file__).resolve().parent.parent
REVISION = "06535bdcec668f62ba6d91d8ebb17e0235ed568b"


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def observed(arguments, cwd=ROOT):
    return subprocess.check_output(arguments, cwd=cwd, text=True).strip()


def prepare(destination):
    if destination.exists() or destination.is_symlink():
        raise ValueError("Output already exists; choose a new directory. Existing evidence is preserved.")
    node = observed(["node", "--version"])
    if not node.startswith("v24."):
        raise ValueError("Select Node 24 on PATH before preparing the baseline.")
    package_manager = observed(["pnpm", "--version"])
    if package_manager != "11.25.0":
        raise ValueError("Select pnpm 11.25.0, as required by the frozen baseline.")
    available = subprocess.run(
        ["git", "cat-file", "-e", f"{REVISION}^{{commit}}"], cwd=ROOT,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False,
    )
    if available.returncode != 0:
        subprocess.run(["git", "fetch", "--no-tags", "--depth=1", "origin", REVISION], cwd=ROOT, check=True)
    if observed(["git", "rev-parse", f"{REVISION}^{{commit}}"]) != REVISION:
        raise ValueError("The frozen commit could not be resolved exactly.")

    destination.mkdir(parents=True, mode=0o700)
    archive = destination / "source.tar"
    with archive.open("xb") as output:
        subprocess.run(["git", "archive", "--format=tar", REVISION], cwd=ROOT, stdout=output, check=True)
    source = destination / "source"
    source.mkdir()
    with tarfile.open(archive, "r:") as contents:
        contents.extractall(source, filter="data")
    # No current workspace aliases, node_modules, builds, environment files or service state are copied.
    environment = {key: value for key, value in os.environ.items() if not key.startswith("ZOEN_") and key not in {"NODE_PATH", "NODE_OPTIONS"}}
    steps = [(["pnpm", "install", "--frozen-lockfile"], "install.log"), (["pnpm", "build"], "build.log")]
    for command, filename in steps:
        print(f"Baseline {REVISION[:12]}: {' '.join(command)}; log {destination / filename}", flush=True)
        with (destination / filename).open("x") as output:
            subprocess.run(command, cwd=source, env=environment, stdout=output, stderr=subprocess.STDOUT, check=True)

    release_path = source / "apps/server/dist/release.json"
    release = json.loads(release_path.read_text())
    if release["format"] != "zoen-local-build-v1" or release["lock_sha256"] != sha256(source / "pnpm-lock.yaml"):
        raise ValueError("The baseline release does not match its archived lockfile.")
    for entry in release["files"]:
        artifact = (source / entry["path"]).resolve()
        if not artifact.is_relative_to(source.resolve()) or sha256(artifact) != entry["sha256"]:
            raise ValueError("The baseline release contains a missing, changed or external artifact.")
    record = {
        "format": "zoen-identity-baseline-build-v1",
        "revision": REVISION,
        "source_root": str(source.resolve()),
        "archive_sha256": sha256(archive),
        "release_sha256": sha256(release_path),
        "lock_sha256": sha256(source / "pnpm-lock.yaml"),
        "node": node,
        "pnpm": package_manager,
        "verified_release_files": len(release["files"]),
        "purpose": "pre-identity-history-generation; no deployment or World upgrade admission",
    }
    with (destination / "build-proof.json").open("x") as output:
        json.dump(record, output, indent=2, sort_keys=True)
        output.write("\n")
    print(json.dumps(record, sort_keys=True))


def main():
    parser = argparse.ArgumentParser(
        description="Archive and build the fixed pre-identity commit with its own lock and dependencies. No services are changed.",
        epilog="Example: python3 tooling/prepare_identity_baseline.py --out .local/identity-baseline-01. Failed outputs and logs are retained; use a new path to retry.",
    )
    parser.add_argument("--out", type=Path, required=True, help="New output directory for source, logs and observed build manifest")
    arguments = parser.parse_args()
    try:
        prepare(arguments.out.absolute())
    except (ValueError, OSError, subprocess.CalledProcessError, tarfile.TarError) as error:
        parser.exit(1, f"Baseline preparation failed: {error}\n")


if __name__ == "__main__":
    main()
