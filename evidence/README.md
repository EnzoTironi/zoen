# Delivery evidence

Read `summary.json` first. The tested source commit is recorded there; the following delivery commit adds evidence and does not change tested source. `local-validation/core-report.json` records actual compiler/runtime and hashes.

The core tests and nine selected mutation probes passed. Full target verification and real-service tests exited 2 (blocked); ten authored real-service tests executed zero cases. This is not a globally passing application report.

`integrity.json` hashes tracked delivery files except itself/Git internals. It detects changes, not fabricated logs or lack of independent review. No v4 ticket is accepted.
