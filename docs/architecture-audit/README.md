# Architecture audit — post-#74 execution frontier

**Provenance:** Condensed from the post-rename agent audit snapshot at `d679f5b` (`zoen-post74-agent-audit/`). That ZIP has no Git history; remote tip and CI were not independently established in the audit itself.

**Tip moved since the snapshot:** `#75`–`#82` landed after `d679f5b`, including rename fallout / hang fixes, Vitest integration split, and `RELEASE_MISMATCH` alignment on all-in-one redeploy (`#82`, tip `edbf72f`). Before executing any ZA slice on tip, rebind with **G-TIP** (reconcile actual remote `main` + source changes against ticket anchors). Do not treat the ZIP paths as current ownership without that rebind.

**Status of this folder:** Documentation only. **0 ZA tickets accepted.** Architecture-repair work stays on **HOLD** — port designed slices onto tip; never blind-patch from the audit archive.

## Index

| Doc | Role |
| --- | --- |
| [anti-list.md](anti-list.md) | What not to invent from atlas/ambition drawings |
| [frontier.md](frontier.md) | Decided ownership / product grammar frontier |
| [za-plan.md](za-plan.md) | ZA-01..26 one-line titles + gates note |

Related product docs: [roadmap](../roadmap.md) (PT frontier section), [AGENTS.md](../../AGENTS.md) Pre-launch Evolution, honest increments in [`planning/progress.json`](../../planning/progress.json).
