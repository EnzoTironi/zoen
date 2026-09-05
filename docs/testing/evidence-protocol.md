# Evidence-bound completion and promotion

## Evidence record

The machine contract is [evidence.schema.json](../schemas/evidence.schema.json). Required fields are ticket ID, immutable source commit, dependency-lock SHA-256, operating profile, author, independent review, outcome and one record for every required check. Each check binds the same source/lock, its promised layer, positive executed count, zero skipped required checks, a relative artifact path and SHA-256 of that file.

Evidence paths resolve under the explicitly supplied CI-artifact root. Absolute paths, parent traversal, symlinks, missing files and hash mismatches are rejected. Source commit is 40- or 64-character lowercase hexadecimal; lock/artifact digests are 64-character SHA-256. Review records bind the exact source commit and lock and use an identity different from the author.

The three required check IDs per ticket are `ZN-nnnn-AC`, `ZN-nnnn-NEG` and `ZN-nnnn-BOUNDARY`. `executed_count` is actual collected/executed test assertions, or completed independently evidenced admission checks at the admission layer. It must never be the number of rows printed by a generator. Admission records reference real provider/account approvals and test reports; they cannot be backed only by synthetic protocol replies.

Do not ship a prefilled passing example as if it were real evidence. The control-tool unit tests create synthetic evidence in temporary directories only to test rejection behavior; none enters execution state.

## Lifecycle

`planned → in-progress → accepted` is permitted only with valid prerequisites, complete evidence and independent review. `in-progress → blocked` records the exact missing contract/resource. Blocked work requires an explicit owner disposition before resumption. A green summary or edited status string alone is rejected. Scope checks require every changed path to be in the ticket allowlist; shared resources are serialized by the planner.

Accepted code remains historically accepted evidence for its own commit/profile. Material changes reopen affected work; the renderer rejects changes to accepted ticket contracts until their evidence is explicitly reopened. Provider gate expiry does not delete historical evidence or block unrelated code work. **Current production promotion** separately requires current gate approval, exact scope and new candidate support-matrix evidence. A previous approval is not transferable to a different broker, model, region, API version or purpose.

Gate records contain accountable owner identity, permitted scope, review expiry and evidence references. The admission evidence’s `gate_scope` must equal the approved scope. Resources-available means tests may run, not that production is approved. Final qualification requires every intended gate currently approved; missing qualifications stay visible rather than being converted to exclusions by the agent.

## Trust boundary of this tooling

The local checker verifies structure and file integrity; it cannot know whether a log was honestly produced or a review identity is genuine. Enforce protected branches, authenticated CI artifacts, signed build provenance, controlled evidence storage and independent review in the target repository. Do not let a coding model rewrite both the implementation and its accepted evidence/history without oversight.

No execution report in this package claims an application deployment, real provider qualification, clinical authorization, financial permission or enterprise scale. Only actual future runs can supply those artifacts.
