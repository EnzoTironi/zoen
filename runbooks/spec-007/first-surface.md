# Repair runbook — minimum web/CLI divergence flow (ZN-0045)

**Status:** implementation-in-progress; not accepted.

Scope: Same two-source bill journey through web and CLI semantic transports.

```text
PRECHECK SemanticDispatcher web/cli transports share one SemanticExecutor.
RUN upload → inspect → open evidence on both transports with identical envelopes.
ASSERT equal semantic digests and permitted meaning; surface gaps/units/verification.
VERIFY browser control model has labels and keyboard order; opaque denials leak nothing.
```

SPEC-007 · journey · depends on ZN-0044 (+ ZN-0291/0292 SemanticClient binding still open).
