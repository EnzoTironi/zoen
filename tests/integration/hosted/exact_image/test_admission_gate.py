"""Policy fixtures for ZA-07 exact-image admission gates.

These do not replace the CI exact-image job or a real Verify→Deploy run.
"""

from __future__ import annotations

import copy
import unittest

from admission import (
    SCHEMA,
    AdmissionError,
    refuse_substituted_digest,
    refuse_unusable_verify_conclusion,
    validate_admission,
)


def _report(image_id: str) -> dict:
    return {
        "status": "passed",
        "imageId": image_id,
        "checks": ["ZA-05-01"],
    }


def sample_admission(**overrides) -> dict:
    image_id = "sha256:" + ("a" * 64)
    digest = "sha256:" + ("b" * 64)
    repository = "ghcr.io/enzotironi/zoen/all-in-one"
    base = {
        "schema": SCHEMA,
        "status": "passed",
        "profile": "all-in-one",
        "commit": "a" * 40,
        "run_id": 42,
        "checks": [
            "ZA-05-01",
            "ZA-05-02",
            "ZA-05-03a",
            "ZA-05-03b",
            "ZA-06-01",
            "ZA-06-02",
            "ZA-06-03",
            "ZA-06-04",
            "ZA-07-01",
        ],
        "reports": {
            "identity": _report(image_id),
            "lifecycle": _report(image_id),
        },
        "image": {
            "image_id": image_id,
            "repository": repository,
            "digest": digest,
            "reference": f"{repository}@{digest}",
            "tag": "sha-" + ("a" * 40),
        },
    }
    merged = copy.deepcopy(base)
    for key, value in overrides.items():
        if key == "image" and isinstance(value, dict):
            merged["image"].update(value)
        elif key == "reports" and isinstance(value, dict):
            merged["reports"].update(value)
        else:
            merged[key] = value
    return merged


class AdmissionGateTests(unittest.TestCase):
    def test_za07_01_green_exact_artifact_eligible(self) -> None:
        admitted = validate_admission(
            sample_admission(),
            expected_commit="a" * 40,
            require_registry_digest=True,
            expected_run_id=42,
        )
        self.assertEqual(admitted["profile"], "all-in-one")
        self.assertTrue(str(admitted["reference"]).endswith(admitted["digest"]))

    def test_za07_02_manual_missing_verify_refuses(self) -> None:
        with self.assertRaises(AdmissionError):
            refuse_unusable_verify_conclusion(None, event_name="workflow_dispatch")
        with self.assertRaises(AdmissionError):
            refuse_unusable_verify_conclusion("failure", event_name="workflow_dispatch")

    def test_za07_02_substituted_digest_refuses(self) -> None:
        admission = sample_admission()
        with self.assertRaises(AdmissionError):
            refuse_substituted_digest(
                admission,
                claimed_digest="sha256:" + ("c" * 64),
                expected_commit="a" * 40,
            )

    def test_za07_02_dispatch_cancelled_refuses(self) -> None:
        with self.assertRaises(AdmissionError):
            refuse_unusable_verify_conclusion("cancelled", event_name="workflow_dispatch")

    def test_za07_03_cancelled_push_is_no_deploy_not_certified(self) -> None:
        self.assertEqual(
            refuse_unusable_verify_conclusion("cancelled", event_name="push"),
            "no-deploy",
        )

    def test_za07_03_missing_test_report_refuses(self) -> None:
        admission = sample_admission()
        admission["reports"] = {"identity": _report("sha256:" + ("a" * 64))}
        with self.assertRaises(AdmissionError):
            validate_admission(
                admission,
                expected_commit="a" * 40,
                require_registry_digest=True,
            )

    def test_za07_03_cross_commit_evidence_refuses(self) -> None:
        admission = sample_admission(commit="b" * 40)
        with self.assertRaises(AdmissionError):
            validate_admission(
                admission,
                expected_commit="a" * 40,
                require_registry_digest=True,
            )

    def test_za07_03_failed_status_refuses(self) -> None:
        with self.assertRaises(AdmissionError):
            validate_admission(
                sample_admission(status="failed"),
                expected_commit="a" * 40,
                require_registry_digest=True,
            )

    def test_app_only_profile_never_admits_deploy(self) -> None:
        with self.assertRaises(AdmissionError):
            validate_admission(
                sample_admission(profile="application"),
                expected_commit="a" * 40,
                require_registry_digest=True,
            )

    def test_ready_probe_not_consulted_by_gate(self) -> None:
        # Gate API has no health/ready parameter; eligibility is admission-only.
        admitted = validate_admission(
            sample_admission(),
            expected_commit="a" * 40,
            require_registry_digest=True,
        )
        self.assertNotIn("ready", admitted)


if __name__ == "__main__":
    unittest.main()
