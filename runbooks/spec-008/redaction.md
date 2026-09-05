# Repair runbook — structured telemetry redaction (ZN-0047)

**Status:** implementation-in-progress; not accepted.

Scope: Allowlisted log schema, OTel correlation, hash/omit IDs; forbid credentials/evidence/prompts; separate security-audit vs operator-metrics export.

```text
PRECHECK redaction allowlist and export scope permissions.
RECORD failures only through RedactionService; scan sinks for secrets/clinical content.
EXPORT security-audit separately from operator-metrics.
VERIFY Case remains traceable via caseIdHash while raw Case ID is absent from logs.
```

SPEC-008 · `RedactionService`.
