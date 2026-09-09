# Doméstico / household — reconciliação de compromissos

**Ticket:** ZA-22 · **ICP:** doméstico / household · **Surfaces:** web + CLI over `SemanticExecutor`

## Supported journey

A household user compares two ordinary bill/commitment lists, resolves one disagreement, and can undo it — without inventing a persona pack or alternate authorization path.

1. Authenticate with a normal account.
2. Create a personal World.
3. Import two JSON (or CSV) lists that use `worlds.v1` / `obligation.amount` with deterministic civil due intervals and decimal amounts (see [examples/](examples/)).
4. Inspect one commitment (`subjectKey`) — the UI explains both sources and the current interpretation; the CLI `inspect` returns the same facts and basis.
5. Propose a scoped correction (select one claim or mark unknown), confirm, then undo — originals and historical frames remain.
6. Share read access with an ordinary viewer and revoke — the revoked reader receives no new content.

## What is not claimed

- Complete household operations or caregiver account recovery
- Clinical, financial settlement, or provider behavior
- Empty packs/extensions or a second authority engine
- Eve/chat/voice product surface (removed from tip; this journey is Worlds verbs only)

## Acceptance (falsifiable)

| ID | Scenario | Observed outcome |
| --- | --- | --- |
| `ZA-22-01` | Two lists differ on the same comparable commitment | UI shows both sources + contested interpretation; CLI agrees on claims/selection/basis |
| `ZA-22-02` | Unrelated commitment or different unit/time | No forced conflict and no silent merge |
| `ZA-22-03` | Undo and revocation after review | Originals + scoped history remain; revoked reader gets `NotFoundOrDenied` on new reads |

## Seams

- Product examples: `docs/product/examples/household-bill-list-*.json`
- Integration (PG + object storage): `tests/integration/household/commitment-reconciliation.ZA22.integration.test.ts`
- Browser + CLI acceptance: `apps/web/test/features/household/household.ZA22.browser.spec.ts` (requires live app URLs)
- Selection law (household-shaped): `packages/ontology/test/knowledge/selection.ZA22.test.ts`

Reuse existing worlds import/inspect/correct/undo and ordinary owner/viewer sharing. Domain language in examples and docs is household; wire schemas stay `worlds.v1`.
