"""Run Vitest integration-legacy then integration, forwarding path filters."""

from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parent.parent
VITEST = ROOT / "node_modules" / "vitest" / "vitest.mjs"


def run_project(project, filters, allow_empty):
    command = [
        "node",
        "--env-file=.env.infra",
        str(VITEST),
        "run",
        "--project",
        project,
        *allow_empty,
        *filters,
    ]
    process = subprocess.Popen(
        command,
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    assert process.stdout is not None
    output = []
    for line in process.stdout:
        sys.stdout.write(line)
        output.append(line)
    code = process.wait()
    text = "".join(output)
    found = "No test files found" not in text
    return code, found


def main():
    filters = list(sys.argv[1:])
    if filters[:1] == ["--"]:
        filters = filters[1:]
    # Path filters are project-scoped: a legacy-only path matches nothing in
    # `integration`, and vice versa. Allow empty selection only when filtering,
    # but require at least one project to actually collect tests.
    allow_empty = ["--passWithNoTests"] if filters else []
    matched = False
    for project in ["integration-legacy", "integration"]:
        code, found = run_project(project, filters, allow_empty)
        if code != 0:
            raise SystemExit(code)
        matched = matched or found
    if filters and not matched:
        print(
            "No integration tests matched the given filters.",
            file=sys.stderr,
        )
        raise SystemExit(1)


if __name__ == "__main__":
    main()
