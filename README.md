# Zoen v4 — implementation candidate

**This is not the completed v4 product. No v4 ticket has independent acceptance.**

This repository contains implementation work against the v4 specification, real pure-component tests, and real-infrastructure tests that must not be replaced by mocks. The delivery environment has Node 22.16.0 / TypeScript 5.8.3, no PostgreSQL server, and cannot resolve package registries or GitHub. Consequently the target Node 24 / TypeScript 6 toolchain, service adapters and full application are **not qualified here**.

The preserved specification remains the scope of the product. Read `docs/IMPLEMENTATION-STATUS.md` and `evidence/summary.json` before treating any part as delivered. Missing providers, absent dependencies and unexecuted tests are failures/blocked results, never passes or offline fallbacks.

## Next-machine handoff

See `NEXT-MODEL.md`. Source code uses the real production dependency contracts. No authentication bypass, in-memory database or fake provider is included. Dependencies must be installed and qualified before the application runs. All public, agent and mini-app operations converge on the same semantic executor.
