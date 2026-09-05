# Independent review protocol

Read the ticket before the implementation summary. Compare actual code and tests to the normative spec, not to the author's explanation. Verify all changed files are allowed; all affected invariants are tested; failures do not leak data; concurrency guards cover absent rows and predicates; retries preserve intent and current authorization; runtime changes cannot self-authorize; and external results remain evidence-bound.

Inspect the test collection report, not just a green CI badge. Find each required check ID and verify it executed at the promised layer/profile against the reviewed commit. Reject changed expected outcomes without a reviewed spec revision. Check actual output and state after injected failure. No service simulators are permitted as implementation or component-test substitutes in this workspace. Direct parser fixtures are only parser evidence.

Record identity, reviewed commit/lock, decision, findings and evidence references. Approval is invalid when reviewer and author identities match or the code changes after review. External admission also requires the gate's accountable function and exact provider/region/operating scope. Unresolved critical findings block acceptance; no waiver may remove a constitutional law.
