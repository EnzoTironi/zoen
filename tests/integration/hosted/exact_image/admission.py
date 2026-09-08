"""Exact all-in-one image admission policy (ZA-07).

Pure gates: no Docker, no network. Callers supply already-observed evidence.
Deploy must admit only the all-in-one profile qualified on the same commit;
app-only container proof is a different profile and never substitutes.
"""

from __future__ import annotations

from typing import Any, Mapping

SCHEMA = "zoen.exact-image-admission/v1"
PROFILE_ALL_IN_ONE = "all-in-one"
REQUIRED_SEAM_CHECKS = (
    "ZA-05-01",
    "ZA-05-02",
    "ZA-05-03a",
    "ZA-05-03b",
    "ZA-06-01",
    "ZA-06-02",
    "ZA-06-03",
    "ZA-06-04",
    "ZA-07-01",
)


class AdmissionError(ValueError):
    """Admission refused."""


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise AdmissionError(message)


def _as_mapping(value: Any, label: str) -> Mapping[str, Any]:
    _require(isinstance(value, Mapping), f"{label} must be an object")
    return value


def _nonempty_str(value: Any, label: str) -> str:
    _require(isinstance(value, str) and bool(value.strip()), f"{label} must be a non-empty string")
    return value.strip()


def validate_admission(
    admission: Mapping[str, Any],
    *,
    expected_commit: str,
    require_registry_digest: bool,
    expected_run_id: int | None = None,
) -> dict[str, Any]:
    """Validate an admission document for deploy eligibility.

    Fails closed on missing/failed status, wrong commit, wrong profile,
    missing seam reports, or (when required) missing/mismatched registry digest.
    Does not consult /ready — public health cannot certify the artifact.
    """
    expected = _nonempty_str(expected_commit, "expected_commit").lower()
    _require(len(expected) == 40 and all(c in "0123456789abcdef" for c in expected), "expected_commit must be a full lowercase git SHA")

    doc = _as_mapping(admission, "admission")
    _require(doc.get("schema") == SCHEMA, f"admission schema must be {SCHEMA}")
    _require(doc.get("status") == "passed", "admission status must be passed")
    _require(doc.get("profile") == PROFILE_ALL_IN_ONE, "admission profile must be all-in-one")

    commit = _nonempty_str(doc.get("commit"), "admission.commit").lower()
    _require(commit == expected, "admission.commit does not match the deploy commit (refusing cross-commit evidence)")

    if expected_run_id is not None:
        run_id = doc.get("run_id")
        _require(isinstance(run_id, int) and run_id == expected_run_id, "admission.run_id does not match the Verify run")

    checks = doc.get("checks")
    _require(isinstance(checks, list), "admission.checks must be a list")
    missing = [item for item in REQUIRED_SEAM_CHECKS if item not in checks]
    _require(not missing, f"admission.checks missing required seams: {missing}")

    reports = _as_mapping(doc.get("reports"), "admission.reports")
    for key in ("identity", "lifecycle"):
        report = _as_mapping(reports.get(key), f"admission.reports.{key}")
        _require(report.get("status") == "passed", f"admission.reports.{key}.status must be passed")
        report_image_id = _nonempty_str(report.get("imageId"), f"admission.reports.{key}.imageId")
        image = _as_mapping(doc.get("image"), "admission.image")
        image_id = _nonempty_str(image.get("image_id"), "admission.image.image_id")
        _require(report_image_id == image_id, f"admission.reports.{key}.imageId diverges from admission.image.image_id")

    image = _as_mapping(doc.get("image"), "admission.image")
    image_id = _nonempty_str(image.get("image_id"), "admission.image.image_id")
    _require(image_id.startswith("sha256:"), "admission.image.image_id must be a sha256 image id")

    digest = image.get("digest")
    reference = image.get("reference")
    if require_registry_digest:
        digest_s = _nonempty_str(digest, "admission.image.digest")
        _require(digest_s.startswith("sha256:"), "admission.image.digest must be sha256:…")
        reference_s = _nonempty_str(reference, "admission.image.reference")
        _require(
            reference_s.endswith("@" + digest_s),
            "admission.image.reference must pin the recorded digest",
        )
        repository = _nonempty_str(image.get("repository"), "admission.image.repository")
        _require(reference_s.startswith(repository + "@"), "admission.image.reference repository mismatch")
    elif digest is not None or reference is not None:
        # If present without require flag, still demand internal consistency.
        digest_s = _nonempty_str(digest, "admission.image.digest")
        reference_s = _nonempty_str(reference, "admission.image.reference")
        _require(reference_s.endswith("@" + digest_s), "admission.image.reference must pin the recorded digest")

    return {
        "commit": commit,
        "image_id": image_id,
        "digest": image.get("digest"),
        "reference": image.get("reference"),
        "repository": image.get("repository"),
        "profile": PROFILE_ALL_IN_ONE,
    }


def refuse_substituted_digest(
    admission: Mapping[str, Any],
    *,
    claimed_digest: str,
    expected_commit: str,
) -> None:
    """ZA-07-02: a caller-supplied digest cannot override admission evidence."""
    admitted = validate_admission(
        admission,
        expected_commit=expected_commit,
        require_registry_digest=True,
    )
    claimed = _nonempty_str(claimed_digest, "claimed_digest")
    _require(
        claimed == admitted["digest"],
        "substituted digest refused; deploy must use the Verify-admitted digest only",
    )


def refuse_unusable_verify_conclusion(conclusion: str | None, *, event_name: str) -> str:
    """Map a Verify conclusion to deploy intent.

    Returns "deploy" or "no-deploy". Raises AdmissionError when the event must fail closed.
    """
    normalized = (conclusion or "").strip().lower()
    if normalized == "success":
        return "deploy"
    if normalized in {"cancelled", "skipped"}:
        # Superseded push: intentionally no-deploy, not certified.
        if event_name == "push":
            return "no-deploy"
        raise AdmissionError(
            f"Verify conclusion {normalized!r} does not admit a manual deploy"
        )
    if normalized in {"", "failure", "timed_out", "action_required", "neutral", "stale"}:
        raise AdmissionError(
            f"Verify conclusion {normalized or 'missing'!r} refuses deploy"
        )
    raise AdmissionError(f"Verify conclusion {normalized!r} refuses deploy")
