# World erasure Web (EX33)

Owner-only panel. Assembles public `InspectWorldErasure` / `RequestWorldErasure` requests; the browser never writes authority state. Viewers receive no erasure controls. Restore UI is absent.

Stale clears pending confirmation and requires a fresh inspect plus explicit confirm with a new operationId. Unavailable keeps the last request for Retry (same opID/payload). Closing receipts stay immutable and are never promoted to Erased in the UI.

## Integrator touches (EX33)

- `packages/contracts/src/d01/api.ts` — `ErasureApiGroup` → `POST /api/erasure/execute`
- `apps/server/src/http/erasure.ts` + `composition.ts`
- `apps/cli/src/d01/transport.ts` + `command.ts` registration
- `apps/web/src/features/d01/{client,model,state,feature}.tsx` routing into this feature
