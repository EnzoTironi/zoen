# Repair runbook — S0 truth-without-chat journey (ZN-0051)

**Status:** implementation-in-progress; not accepted.

Scope: File-based S0 acceptance under a clean local profile without LLM/messaging/finance credentials; web+CLI; upload replay, divergent sources, idempotency, forbidden read, restore drill.

```text
PRECHECK admitted-local-s0-file profile; confirm LLM/messaging/finance credentials absent.
RUN web and CLI file-truth paths; archive commit, lock digest, test counts, outstanding gates.
NEVER emit enterprise-readiness or unsupported external results for missing services.
ON restore drill: dispatch disabled; deleted content undisclosed.
DO NOT mark ZN-0051 or S0 milestone accepted without independent review.
```

SPEC-008 · S0 journey.
