# Repair runbook — semantic dispatcher (ZN-0043)

**Status:** implementation-in-progress; not accepted.

Scope: Semantic dispatcher and stable error translation for web/CLI adapters.

```text
PRECHECK released operation registry and contract digests.
REJECT raw SQL, table invokes and unregistered methods at every entrypoint.
VALIDATE expectedContractDigest against release; mismatch => ContractChanged (no silent fallback).
MAP all failures through toPublicFailure disclosure-safe envelope.
VERIFY AC/NEG/BOUNDARY on real Postgres via SemanticDispatcher → SemanticExecutor.
```

SPEC-007 / SPEC-050 · `SemanticDispatcher` · `SemanticExecutor`.
