"""Bind the local executable build to an exact, reproducible file manifest."""

import hashlib
import json
from pathlib import Path


def main():
    root = Path(__file__).resolve().parent.parent
    folders = [
        "packages/contracts/dist",
        "packages/authority/dist",
        "apps/server/dist",
        "apps/cli/dist",
    ]
    files = []
    for folder in folders:
        paths = sorted((root / folder).rglob("*.js"))
        if not paths:
            raise RuntimeError(f"No executable build files found in {folder}")
        for path in paths:
            files.append({
                "path": path.relative_to(root).as_posix(),
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            })
    manifest = {
        "format": "zoen-local-build-v1",
        "files": files,
        "lock_sha256": hashlib.sha256((root / "pnpm-lock.yaml").read_bytes()).hexdigest(),
    }
    output = json.dumps(manifest, sort_keys=True, separators=(",", ":")) + "\n"
    (root / "apps/server/dist/release.json").write_text(output)


if __name__ == "__main__":
    main()
