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

    def _run_git(self, head: str = "abc123"):
        def run(cmd: list[str], **kwargs: Any) -> SimpleNamespace:
            if cmd[:2] == ["git", "rev-parse"]:
                return SimpleNamespace(stdout=f"{head}\n", stderr="", returncode=0)
            return SimpleNamespace(stdout="", stderr="", returncode=0)

        return run

    def test_main_exit_2_writes_blocked_evidence(self) -> None:
        code = self.mod.main(argv=[], run=self._run_git("deadbeef"))
        self.assertEqual(code, 2)
        evidence = (
            self.fake_root / ".local" / "hosted-gates-prep" / "prep.json"
        )
        self.assertTrue(evidence.is_file())
        body = json.loads(evidence.read_text(encoding="utf-8"))
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

    def test_refuse_legacy_and_retained(self) -> None:
        self.assertEqual(
            self.mod.refuse_candidate(
                {
                    "appName": "zoen",
                    "bucketName": "x",
                    "imageDigest": "sha256:a",
                    "installId": "i",
                    "policyProfileId": "worlds-hosted-erasable-v1",
                    "volumeName": "v",
                }
            )["reason"],
            "legacy-app-zoen",
        )
        self.assertEqual(
            self.mod.refuse_candidate(
                {
                    "appName": "other",
                    "bucketName": "zoen",
                    "imageDigest": "sha256:a",
                    "installId": "i",
                    "policyProfileId": "worlds-hosted-erasable-v1",
                    "volumeName": "v",
                }
            )["reason"],
            "retained-bucket-name-reuse",
        )
        self.assertEqual(
            self.mod.refuse_candidate(
                {
                    "appName": "zoen-rebuild",
                    "bucketName": "erasable-proof",
                    "imageDigest": "sha256:a",
                    "installId": "i",
                    "policyProfileId": "worlds-hosted-erasable-v1",
                    "volumeName": "zoen_data",
                }
            )["reason"],
            "retained-protected-resource",
        )

    def test_optimistic_candidate_still_gates_incomplete(self) -> None:
        decision = self.mod.refuse_candidate(
            {
                "appName": "zoen-erasable-proof",
                "bucketName": "erasable-proof-bucket",
                "imageDigest": "sha256:deadbeef",
                "installId": "install-proof",
                "policyProfileId": "worlds-hosted-erasable-v1",
                "volumeName": "erasable_data",
            }
        )
        self.assertEqual(decision["reason"], "gates-incomplete")
        self.assertIs(decision["admitted"], False)

    def test_candidate_dry_run_exit_2(self) -> None:
        cand = self.fake_root / "candidate.json"
        cand.write_text(
            json.dumps(
                {
                    "appName": "zoen-erasable-proof",
                    "bucketName": "erasable-proof-bucket",
                    "imageDigest": "sha256:deadbeef",
                    "installId": "install-proof",
                    "policyProfileId": "worlds-hosted-erasable-v1",
                    "volumeName": "erasable_data",
                }
            ),
            encoding="utf-8",
        )
        code = self.mod.main(
            argv=["--candidate", str(cand)], run=self._run_git("cafeba")
        )
        self.assertEqual(code, 2)
        body = json.loads(
            (
                self.fake_root / ".local" / "hosted-gates-prep" / "prep.json"
            ).read_text(encoding="utf-8")
        )
        self.assertEqual(body["candidateDecision"]["reason"], "gates-incomplete")
        self.assertIs(body["gates"]["fullHostedErased"], False)

    def test_invalid_candidate_exit_1(self) -> None:
        cand = self.fake_root / "bad.json"
        cand.write_text('{"appName":"x"}', encoding="utf-8")
        code = self.mod.main(argv=["--candidate", str(cand)], run=self._run_git())
        self.assertEqual(code, 1)
