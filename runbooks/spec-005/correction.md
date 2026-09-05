# Scoped correction repair — ZN-0034

**Status:** implementation-in-progress; ticket unaccepted.

```text
PRECHECK questionDigest, authority principal, case guards, explicit answerKind.
APPEND assertion/identity-decision with actor+evidence; rule_created always false.
UNDO via new retraction receipt (mark prior retracted=true); never DELETE prior reply.
SCOPE: only scoped_subject_id + valid interval for that case; other subjects untouched.
PRIOR cuts replay via activeCorrectionAtCut(cutDigest) — independent of later corrections.
RESUME only after independent review.
```
