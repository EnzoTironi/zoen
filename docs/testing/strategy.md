# Testing and qualification strategy

## What this delivery can prove

The execution-pack verifier proves schema consistency, dependency acyclicity, capability/test traceability, deterministic rendering and baseline preservation. Its unit tests exercise the planner/evidence checks. Those are **not product tests**. All product test IDs in the backlog are required implementation deliverables and initially not run.

## Evidence layers

| Layer | Tools/profile | Permitted claim |
|---|---|---|
| static | strict TypeScript, ESLint/dependency-cruiser, schema/compiler, secret/license checks | A contract or import invariant was checked for this source/lock. |
| law | Vitest + fast-check, explicit clocks/seeds and shrinking | A pure invariant held over recorded examples/generated cases. |
| component | Actual admitted PostgreSQL, Cedar binding, object store/catalog/runner where relevant | The specific implementation and dependency profile behaved as asserted. |
| protocol | Direct parsing of authorized recorded input data, or actual admitted provider endpoints | Only the exact parser/real endpoint behavior observed; no substitute service or provider qualification from fixtures. |
| journey | Real composition through normal semantic API/UI, authorized synthetic data | A user outcome works across the exercised components/surfaces. |
| chaos | Actual process death/network interruption/fencing/restore with named barriers | Recovery laws held under the tested failures and workloads. |
| performance | Reproducible workload+hardware+data distribution and cost report | Measured results for this operating envelope, not an unlimited scale claim. |
| admission | Real provider sandbox/account, external documentation/approvals, independent review | Only the named provider, region, API, licensed use and operating scope are qualified. |

In this workspace parsers are tested directly and components use actual admitted dependencies; no stubs substitute services. Recorded provider replies are redacted fixtures, not current provider qualification. Fault injection targets real components whenever the claim concerns their behavior. No real person's data is needed to prove the semantic laws. Human usability and regulated operating scope have separate external gates.

## Required checks per ticket

Each ticket names an observable acceptance oracle, its test file, a required `AC`, `NEG` and `BOUNDARY` check. `AC` proves the stated outcome; `NEG` proves denial/no partial state for an invalid or unauthorized variant; `BOUNDARY` proves the ticket-specific replay, overflow, concurrency, outage or falsified-evidence boundary. Static/admission checks have corresponding non-execution evidence requirements; do not write a meaningless runtime test merely to match a layer.

Every required check must have a collected, non-skipped test ID, output, source commit and dependency profile. The verifier rejects zero selected tests, filtered-away checks, failing or skipped required checks, changed oracles without a spec amendment, and unreviewed critical work. A test may exercise several assertions but every required ID must be explicitly reported. Test selection by filename alone is insufficient.

## Independent review

Critical tickets require a reviewer identity different from the author, and a review of the actual diff, test oracles, privilege paths and evidence. Another automated agent may assist; material security, clinical, financial, cloud or provider admission needs the accountable human function indicated by its gate. The review is commit-bound; subsequent code changes reopen review. No model may approve its own expanded authority.

## Test-first sequence

Implement the smallest failing acceptance and negative tests against the published contract. Add production code only inside the declared write set. Run laws then real components then the required journey/fault profile. Capture evidence. Independently review. Remove temporary scaffolding. Run affected upstream/downstream regression checks before acceptance. Never change an expected result merely because the implementation fails it.

Fixtures are versioned synthetic records with exact expected results. Use deterministic seeds and injected clocks for laws. Store failing seeds and minimized examples as regression cases. Separate nondeterministic model wording from deterministic meaning: judge citation grounding, scope, disclosed uncertainty and tool behavior, not one exact sentence. Deterministic authorized context composition remains directly testable.

## Global security/regression obligations

Every new data-bearing path inherits cross-World, cross-realm, hidden-rival noninterference, stale ACL, revocation, prompt-injection, bounded input and evidence-lineage cases. Every mutation inherits duplicate operation, changed-intent conflict, stale read-set, transaction atomicity and permission recheck. Every external effect inherits lost reply, duplicate callback, expired permit, cancellation race and reconciliation. Every runtime change inherits self-escalation, isolated evaluation and activation race. Every data deletion inherits derivative invalidation and restore suppression. Every cell change inherits real fencing and escaped-effect reconciliation.

## Merge versus promotion

Code acceptance uses actual components and direct pure-function tests; protocol peers do not substitute services in this workspace. Promotion additionally requires the applicable external gates. No missing WhatsApp license, sandbox or cloud account is treated as a reason to mock a live profile green. A feature may merge behind a disabled capability flag with honest unqualified status; that does not finish its admission ticket.

## Regression and evidence invalidation

A change to code, dependency lock, contract, fixture, policy semantics, provider API or operating profile invalidates the affected proof closure. Compare-and-swap on the accepted evidence index prevents stale acceptance. Provider qualifications have explicit review dates and scope; an expiry disables affected promotion, not unrelated capabilities. Security/erasure emergency denies override previously accepted evidence.

## CI commands to implement in SPEC-000

```sh
pnpm check
pnpm test:law -- --seed <recorded-seed>
pnpm test:component -- --profile <admitted-profile>
pnpm test:journey -- --profile <admitted-profile>
pnpm verify:ticket --ticket ZN-0001 --profile <admitted-profile>
```

These are required **target repository** commands, not scripts already implemented in this documentation ZIP. The workspace controls are `python tooling/workspace.py validate`, `python tooling/workspace.py packet` and `python -m unittest discover -s tooling/execution -p 'test_*.py'`. Confusing these proof levels is a release-blocking error.


## v4 mandatory mini-app suite

[Mini-app conformance](mini-app-conformance.md) adds semantic equivalence, authority-free links, recipient/session binding, private asset bootstrap, no-bypass route closure, current disclosure at streams/exports, host confirmation, immutable runtime staging, recalled-state recovery and three-audience journeys. Protected guest data release needs the admitted information-flow profile; CSP is not accepted as universal browser DLP.

The generator declares 35 additional critical tickets with specific positive/negative/boundary oracles. The original check IDs are stable. New schemas and synthetic fixtures are only execution-contract checks here; the candidate application is partial; no browser, PostgreSQL, Cedar or Rivet profile is qualified by adding these plans. All required product checks remain unrun.
