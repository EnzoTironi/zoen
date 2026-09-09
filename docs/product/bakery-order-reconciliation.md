# Confeitaria / bakery — reconciliação de pedidos

**Ticket:** ZA-23 · **ICP:** confeitaria / bakery · **Surfaces:** web + CLI over `SemanticExecutor`

## Supported journey

A bakery operator compares customer order commitments against the shop production list before production, resolves one disagreement, and can undo — without inventing a persona pack, recipe costing, or alternate authorization path.

1. Authenticate with a normal account.
2. Create a personal World.
3. Import two JSON (or CSV) lists that use `worlds.v1` / `obligation.amount` with deterministic due intervals and decimal quoted amounts (see [examples/](examples/)).
4. Inspect one order commitment (`subjectKey`) — the UI shows scoped competing claims and the current interpretation; the CLI `inspect` returns the same facts and basis.
5. Propose a scoped correction (select one claim or mark unknown), confirm, then undo — originals and historical frames remain.
6. Share read access with an ordinary viewer and revoke — the revoked reader receives no new content; viewers never see scoped correction history (staff context stays hidden).

## What is not claimed

- Complete bakery / confeitaria operations, recipe costing, or physical inventory
- Grams, stock quantities, or mass units as admitted amount currencies — unsupported inputs fail closed (`InvalidInput`); they are never coerced into BRL/USD/EUR revenue
- Clinical, bank settlement, or provider behavior
- Empty packs/extensions or a second authority engine
- Eve/chat/voice product surface (removed from tip; this journey is Worlds verbs only)

## Acceptance (falsifiable)

| ID | Scenario | Observed outcome |
| --- | --- | --- |
| `ZA-23-01` | Two sources disagree on one order commitment | UI/CLI shows scoped competing claims; authorized correction is recorded |
| `ZA-23-02` | Recipe weights or stock quantity without matching semantics | Unsupported/missing interpretation is explicit; grams are not coerced into currency or revenue |
| `ZA-23-03` | Concurrent order correction/revocation | Old consent cannot overwrite changed basis (`Stale`/`Conflict`); hidden staff context stays hidden from viewers |

## Seams

- Product examples: `docs/product/examples/bakery-order-list-*.json`
- Integration (PG + object storage): `tests/integration/bakery/order-reconciliation.ZA23.integration.test.ts`
- Browser + CLI acceptance: `apps/web/test/features/bakery/bakery.ZA23.browser.spec.ts` (requires live app URLs)
- Selection / amount law (bakery-shaped): `packages/ontology/test/knowledge/selection.ZA23.test.ts`

Reuse existing worlds import/inspect/correct/undo and ordinary owner/viewer sharing. Domain language in examples and docs is bakery; wire schemas stay `worlds.v1`.
