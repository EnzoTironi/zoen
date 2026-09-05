# Runbook — time kinds and half-open intervals (ZN-0009)

**Status:** implementation-in-progress; not accepted. Law-layer only.

## Scope

UTC `Instant`, `LocalDate`, half-open `[from,until)` intervals, injected `ClockSample`, and zoned wall-time appointments resolved only from released offset lookups (never host TZ).

## Observe

1. Capture wall time, zoneId and released offsets (overlap vs gap).
2. Adjacent intervals sharing an endpoint must not overlap; intersection is Empty.
3. Ambiguous local time without `earlier`/`later`/explicit offset => `AMBIGUOUS_LOCAL_TIME`.
4. Keep `ValidTime` separate from `CommitCut`.

## Repair

```sh
node --experimental-strip-types --test tests/law/spec-001/temporal.test.ts
```

Do not invent TZ rules from the host. Ticket remains unaccepted until independent review.
