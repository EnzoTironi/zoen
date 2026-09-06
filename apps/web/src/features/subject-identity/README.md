# Subject identity Web (EX28)

Owner-only panel. Assembles public requests; the browser never writes authority state. Viewers do not receive private identity controls.

Stale clears the pending Question and requires a fresh inspect plus explicit confirm. Unavailable keeps the last request for Retry (same opID/digest). Recovery UI surfaces `comparison: not-requested` before structural confirm.

## Integrator touches (documented for EX28)

Root-owned wiring required so surfaces can call handlers:

- `packages/contracts/src/d01/api.ts` — `SubjectIdentityApiGroup` → `POST /api/d02/subject-identity`
- `apps/server/src/http/subject-identity.ts` + `composition.ts`
- `apps/cli/src/d01/transport.ts` + `command.ts` registration
- `apps/web/src/features/d01/{client,model,state,feature}.tsx` routing into this feature
