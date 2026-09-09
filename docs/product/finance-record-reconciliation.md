# Finanças / personal & small-business finance — reconciliação somente leitura

**Ticket:** ZA-25 · **ICP:** finanças / personal or small-business finance · **Surfaces:** web + CLI over `SemanticExecutor`

## Supported journey

A user compares a ledger/invoice list against an authorized statement, resolves one disagreement, and can undo — without mistaking a local interpretation for bank settlement, inventing payment rails, or activating a chat/voice agent product.

1. Authenticate with a normal account.
2. Create a personal World.
3. Import two JSON (or CSV) lists that use `worlds.v1` / `obligation.amount` with deterministic civil intervals and decimal amounts (see [examples/](examples/)): ledger/invoices (recognition) vs authorized statement (reported settlement cut).
4. Inspect one invoice/obligation (`subjectKey`) — the UI shows retained sources, exact amount/currency discrepancy when comparable amounts disagree, and the current interpretation; the CLI `inspect` returns the same facts and basis.
5. Propose a scoped correction (select one claim or mark unknown), confirm, then undo — originals and historical frames remain. Verification stays `unverified` (“não comprova pagamento”); selecting a claim is a local cut, not a provider settlement or payment receipt.
6. Share read access with an ordinary viewer and revoke — the revoked reader receives no new content.

## Recognition vs settlement (explicit)

- **Recognition** (ledger / invoice): amounts admitted as invoiced/owed observations from file inputs.
- **Settlement cut** (authorized statement): amounts admitted as a statement of reported movements — still a local source document, **not** live bank truth, provider confirmation, or payment initiation.
- Same numeric amount in different currencies is **not comparable** (`CurrencyMismatch`) — never forced into equivalence.
- Matching amounts across ledger and statement yield set-valued selection at most; they **do not** upgrade verification or invent a payment receipt.
- Reports identify the current World cut. No bank connector, investment advice, payment rails, market-data license, or trade execution.

## What is not claimed

- Complete personal/SMB finance operations or accounting completeness
- Bank settlement, provider payment confirmation, or payment initiation
- Clinical or bakery/clinic ICP completeness
- Empty packs/extensions or a second authority engine
- Eve/chat/voice product surface (removed from tip; this journey is Worlds verbs only)

## Acceptance (falsifiable)

| ID | Scenario | Observed outcome |
| --- | --- | --- |
| `ZA-25-01` | Two comparable records disagree | Sources retained; discrepancy shown with exact amount/currency and permitted evidence |
| `ZA-25-02` | Same numeric amount in different currency or recognized-vs-settled state | No forced equivalence; no inferred provider settlement (`unverified`) |
| `ZA-25-03` | Correction on stale frame or duplicate request | `Stale`/`Conflict` or same-intent replay; no external action or fabricated payment receipt |

## Seams

- Product examples: `docs/product/examples/finance-ledger-invoices.json`, `finance-authorized-statement.json`
- Integration (PG + object storage): `tests/integration/finance/record-reconciliation.ZA25.integration.test.ts`
- Browser + CLI acceptance: `apps/web/test/features/finance/finance.ZA25.browser.spec.ts` (requires live app URLs)
- Selection / amount law (finance-shaped): `packages/ontology/test/knowledge/selection.ZA25.test.ts`

Reuse existing worlds import/inspect/correct/undo and ordinary owner/viewer sharing. Domain language in examples and docs is finance; wire schemas stay `worlds.v1`.
