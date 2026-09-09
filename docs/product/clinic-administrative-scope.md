# Clínica / clinic — administração com exclusão clínica explícita

**Ticket:** ZA-24 · **ICP:** clínica / clinic administration · **Surfaces:** web + CLI over `SemanticExecutor`

## Supported journey

A clinic administrative user reconciles appointment/fee commitments without gaining clinical access — no diagnosis, treatment, or clinical corpus in this admitted fixture/profile.

1. Authenticate with a normal account.
2. Create a personal World.
3. Import two JSON (or CSV) administrative lists that use `worlds.v1` / `obligation.amount` with deterministic civil intervals and decimal quoted amounts (see [examples/](examples/)): agenda vs fee schedule.
4. Inspect one appointment commitment (`subjectKey`) — the UI shows scoped competing claims and the current interpretation; the CLI `inspect` returns the same facts and basis.
5. Propose a scoped correction (select one claim or mark unknown), confirm — originals and historical frames remain.
6. Share read access with an ordinary viewer. If rights are revoked while evidence content is being fetched, final disclosure refuses; the owner’s other authorized administrative work stays intact.

## Clinical exclusion (explicit)

- Clinical predicates and excluded fields (`diagnosis.*`, `treatment.*`, `clinical.*`, etc.) are **not** in the admitted `worlds.v1` wire schema for this profile. Decode fails closed (`InvalidInput`) **before** capture/retrieval or any model prompt — no clinical corpus is sent to models.
- Requesting an excluded/unknown clinical evidence ref or historical frame yields `NotFoundOrDenied` without leaking existence metadata.
- Clinical scope remains a separate, qualified profile (README). This journey does **not** activate clinical, financial-provider, or chat/voice agent behavior.

## What is not claimed

- Complete clinic / dental operations or provider workflows
- Patient diagnosis or treatment intelligence
- Bank settlement or financial provider claims
- Empty packs/extensions or a second authority engine
- Eve/chat/voice product surface (removed from tip; this journey is Worlds verbs only)

## Acceptance (falsifiable)

| ID | Scenario | Observed outcome |
| --- | --- | --- |
| `ZA-24-01` | Authorized appointment/fee conflict | Admin sees only permitted evidence and can record scoped correction through the executor |
| `ZA-24-02` | User requests clinical fields/excluded source | Denied or profile-blocked before retrieval/model prompt; metadata does not leak |
| `ZA-24-03` | Source rights revoked while content is being fetched | Final disclosure refuses; other authorized administrative work remains intact |

## Seams

- Product examples: `docs/product/examples/clinic-appointment-agenda.json`, `clinic-fee-schedule.json`
- Integration (PG + object storage): `tests/integration/clinic/administrative-scope.ZA24.integration.test.ts`
- Browser + CLI acceptance: `apps/web/test/features/clinic/clinic.ZA24.browser.spec.ts` (requires live app URLs)
- Selection / clinical-exclusion law (clinic-shaped): `packages/ontology/test/knowledge/selection.ZA24.test.ts`

Reuse existing worlds import/inspect/correct/open and ordinary owner/viewer sharing. Domain language in examples and docs is clinic-administrative; wire schemas stay `worlds.v1`.
