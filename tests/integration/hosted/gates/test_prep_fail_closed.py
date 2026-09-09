"""Fail-closed unit proofs for hosted-gates prep (no Fly / no destroy)."""

from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest import mock

PREP = Path(__file__).resolve().parent / "prep.py"


def load_prep():
    spec = importlib.util.spec_from_file_location("hosted_gates_prep", PREP)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class PrepFailClosedTest(unittest.TestCase):
    def setUp(self) -> None:
        self.mod = load_prep()
        self._tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmpdir.cleanup)
        self.fake_root = Path(self._tmpdir.name)
        (self.fake_root / ".local").mkdir(parents=True)
        self._root_patch = mock.patch.object(self.mod, "ROOT", self.fake_root)
        self._root_patch.start()
        self.addCleanup(self._root_patch.stop)
        self._ev_patch = mock.patch.object(
            self.mod,
            "EVIDENCE_DIR",
            self.fake_root / ".local" / "hosted-gates-prep",
        )
        self._ev_patch.start()
        self.addCleanup(self._ev_patch.stop)

    def _run_git(
        self, head: str = "abc1234", returncode: int = 0
    ):
        def run(cmd: list[str], **kwargs: Any) -> SimpleNamespace:
            if cmd[:2] == ["git", "rev-parse"]:
                return SimpleNamespace(
                    stdout=f"{head}\n", stderr="git error", returncode=returncode
                )
            return SimpleNamespace(stdout="", stderr="", returncode=0)

        return run

    def _candidate(self, **changes: Any) -> dict[str, Any]:
        candidate: dict[str, Any] = {
            "appName": "zoen-erasable-proof",
            "bucketName": "erasable-proof-bucket",
            "imageDigest": "sha256:deadbeef",
            "installId": "install-proof",
            "policyProfileId": "worlds-hosted-erasable-v1",
            "volumeName": "erasable_data",
        }
        candidate.update(changes)
        return candidate

    def _write_candidate(self, body: Any, name: str = "candidate.json") -> Path:
        path = self.fake_root / name
        path.write_text(json.dumps(body), encoding="utf-8")
        return path

    def _evidence(self) -> Path:
        return self.fake_root / ".local" / "hosted-gates-prep" / "prep.json"

    def test_main_exit_2_writes_blocked_evidence(self) -> None:
        code = self.mod.main(argv=[], run=self._run_git("deadbeef"))
        self.assertEqual(code, 2)
        body = json.loads(self._evidence().read_text(encoding="utf-8"))
        self.assertEqual(body["status"], "Blocked")
        self.assertEqual(body["tipCommit"], "deadbeef")
        self.assertEqual(body["gates"]["H-01"], "Blocked")
        self.assertEqual(body["gates"]["H-02"], "Blocked")
        self.assertEqual(body["gates"]["G-STORAGE-FENCE"], "Blocked")
        self.assertEqual(body["gates"]["G-OPS"], "Unknown")
        self.assertIs(body["gates"]["fullHostedErased"], False)
        self.assertIs(body["gates"]["productAccepted"], False)
        self.assertTrue(body["refusals"]["destroyZoenRebuild"])
        self.assertTrue(body["refusals"]["alchemyProdAdopt"])
        self.assertFalse(body["localControllerSeam"]["qualifiesH01Hosted"])
        self.assertFalse(body["gOpsInventory"]["autoQualified"])
        self.assertFalse(body["gStorageFence"]["objectLockIsWriterFence"])

    def test_optimistic_candidate_exit_2_with_snapshot_and_digest(self) -> None:
        candidate = self._candidate()
        path = self._write_candidate(candidate)
        code = self.mod.main(
            argv=["--candidate", str(path)], run=self._run_git("cafebad")
        )
        self.assertEqual(code, 2)
        body = json.loads(self._evidence().read_text(encoding="utf-8"))
        self.assertEqual(body["candidateDecision"]["reason"], "gates-incomplete")
        self.assertEqual(body["candidateSnapshot"], candidate)
        self.assertRegex(body["candidateSha256"], r"^sha256:[0-9a-f]{64}$")
        self.assertIs(body["gates"]["fullHostedErased"], False)

    def test_protected_candidate_writes_refusal_and_exit_1(self) -> None:
        candidate = self._candidate(appName="zoen-rebuild", volumeName="zoen_data")
        path = self._write_candidate(candidate)
        code = self.mod.main(
            argv=["--candidate", str(path)], run=self._run_git("cafebad")
        )
        self.assertEqual(code, 1)
        body = json.loads(self._evidence().read_text(encoding="utf-8"))
        self.assertEqual(
            body["candidateDecision"]["reason"], "retained-protected-resource"
        )
        self.assertIs(body["candidateDecision"]["admitted"], False)

    def test_refuse_legacy_bucket_and_retained_profile(self) -> None:
        legacy = self.mod.validate_candidate(self._candidate(appName="zoen"))
        self.assertEqual(
            self.mod.refuse_candidate(legacy)["reason"], "legacy-app-zoen"
        )
        bucket = self.mod.validate_candidate(self._candidate(bucketName="zoen"))
        self.assertEqual(
            self.mod.refuse_candidate(bucket)["reason"],
            "retained-bucket-name-reuse",
        )
        retained = self.mod.validate_candidate(
            self._candidate(policyProfileId="worlds-hosted-retained-v1")
        )
        self.assertEqual(
            self.mod.refuse_candidate(retained)["reason"],
            "retained-install-profile",
        )

    def test_rejects_malformed_field_shapes(self) -> None:
        malformed = [
            {"appName": ["zoen"]},
            {"appName": {"protected": "zoen"}},
            {"appName": None},
            {"appName": ""},
            {"appName": " "},
            {"appName": "x" * 129},
            {"policyProfileId": "unsupported"},
        ]
        for index, changes in enumerate(malformed):
            with self.subTest(changes=changes):
                path = self._write_candidate(
                    self._candidate(**changes), f"malformed-{index}.json"
                )
                code = self.mod.main(
                    argv=["--candidate", str(path)],
                    run=self._run_git("cafebad"),
                )
                self.assertEqual(code, 1)
                self.assertFalse(self._evidence().exists())

    def test_rejects_extra_candidate_keys(self) -> None:
        path = self._write_candidate(self._candidate(secret="do-not-record"))
        code = self.mod.main(
            argv=["--candidate", str(path)], run=self._run_git("cafebad")
        )
        self.assertEqual(code, 1)
        self.assertFalse(self._evidence().exists())

    def test_invalid_run_clears_previous_evidence(self) -> None:
        self.assertEqual(self.mod.main(argv=[], run=self._run_git("deadbeef")), 2)
        self.assertTrue(self._evidence().exists())
        bad = self._write_candidate({"appName": "x"}, "bad.json")
        self.assertEqual(
            self.mod.main(
                argv=["--candidate", str(bad)], run=self._run_git("deadbeef")
            ),
            1,
        )
        self.assertFalse(self._evidence().exists())

    def test_git_identity_failure_clears_previous_evidence(self) -> None:
        self.assertEqual(self.mod.main(argv=[], run=self._run_git("deadbeef")), 2)
        self.assertTrue(self._evidence().exists())
        for head, returncode in [("", 0), ("not-a-commit", 0), ("deadbeef", 1)]:
            with self.subTest(head=head, returncode=returncode):
                self._evidence().parent.mkdir(parents=True, exist_ok=True)
                self._evidence().write_text("old", encoding="utf-8")
                code = self.mod.main(
                    argv=[], run=self._run_git(head, returncode=returncode)
                )
                self.assertEqual(code, 1)
                self.assertFalse(self._evidence().exists())
