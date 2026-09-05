# ZN-0022 — complete read guards / absence predicates (repair)

```text
PRECHECK domain version fences and predicate digests for absence/range guards.
OBSERVE Stale on phantom inserts that bump the guarded domain without touching prior rows.
PRESERVE approved intent; never recompute after a failed guard recheck.
VERIFY unrelated domain bumps do not invalidate a Case whose guard set excludes them.
```

Open gate: ZN-0024 chaos still unfinished on this stack.
