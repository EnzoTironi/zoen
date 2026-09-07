"""Run Vitest integration-legacy then integration, forwarding path filters."""

from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parent.parent
VITEST = ROOT / "node_modules" / "vitest" / "vitest.mjs"


def main():
    filters = list(sys.argv[1:])
    if filters[:1] == ["--"]:
        filters = filters[1:]
    # Path filters are project-scoped: a legacy-only path matches nothing in
    # `integration`, and vice versa. Allow empty selection only when filtering.
    allow_empty = ["--passWithNoTests"] if filters else []
    for project in ["integration-legacy", "integration"]:
        completed = subprocess.run(
            [
                "node",
                "--env-file=.env.infra",
                str(VITEST),
                "run",
                "--project",
                project,
                *allow_empty,
                *filters,
            ],
            cwd=ROOT,
            check=False,
        )
        if completed.returncode != 0:
            raise SystemExit(completed.returncode)


if __name__ == "__main__":
    main()
