#!/usr/bin/env python3
"""Deploy-side exact-image admission gate (ZA-07).

Reads admission.json produced by Verify for this commit. Prints the immutable
image reference on success. Never accepts workflow inputs for digest/run injection.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from admission import (  # noqa: E402
    AdmissionError,
    refuse_unusable_verify_conclusion,
    validate_admission,
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--admission", type=Path, required=True)
    parser.add_argument("--commit", required=True, help="Full git SHA being deployed")
    parser.add_argument("--event-name", required=True, choices=("push", "workflow_dispatch"))
    parser.add_argument("--verify-conclusion", default=None)
    parser.add_argument("--verify-run-id", type=int, default=None)
    parser.add_argument(
        "--print",
        dest="print_field",
        default="reference",
        choices=("reference", "image_id", "digest", "intent"),
    )
    args = parser.parse_args()

    intent = refuse_unusable_verify_conclusion(args.verify_conclusion, event_name=args.event_name)
    if intent == "no-deploy":
        if args.print_field == "intent":
            print("no-deploy")
            return 0
        print("no-deploy", file=sys.stderr)
        return 0

    if not args.admission.is_file():
        raise AdmissionError(f"missing admission evidence: {args.admission}")

    admission = json.loads(args.admission.read_text())
    admitted = validate_admission(
        admission,
        expected_commit=args.commit.lower(),
        require_registry_digest=True,
        expected_run_id=args.verify_run_id,
    )
    if args.print_field == "intent":
        print("deploy")
    else:
        value = admitted[args.print_field]
        if not value:
            raise AdmissionError(f"admission missing {args.print_field}")
        print(value)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AdmissionError as error:
        print(f"Deploy admission refused: {error}", file=sys.stderr)
        raise SystemExit(1)
