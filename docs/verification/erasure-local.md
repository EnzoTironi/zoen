# Erasure — evidência local (EX30–EX34)

Em 2026-09-06 (PT), o **congelamento mínimo** de erasure está em [`docs/contracts/d03-erasure-freeze.md`](../contracts/d03-erasure-freeze.md). Schemas `erasure.v1` e a porta `ErasureAttemptRegister` existem como contrato/interface.

## Estado honesto

| Item | Estado |
| --- | --- |
| Freeze F01–F09 | Landed |
| Schemas Request/Inspect | Landed (unidade EX30) |
| Porta de registro | Interface + oráculo Unavailable sem controlador |
| Closing local (EX32) | Planejado — não implementado neste tip |
| Web/CLI (EX33) | Planejado |
| Purge / Erased | **Bloqueado** (controlador, backups, Object Lock, fencing World) |
| restoreAfterErasure | **false** / fechado |

Worlds `d01-local-retained-v1` continuam sem erasure. Perfil candidato `d03-local-erasable-v1` só para Worlds **novos** após EX34 e gates.

Isto **não** marca erasure `verified_for_profile` e **não** autoriza apagar dados reais.
