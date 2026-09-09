# Eve G-PROVIDER operator runbook (OpenCode Zen)

**Status:** tip keeps `G-PROVIDER: Blocked` and `textProfileAccepted: false` until a **live** qualify produces evidence. This runbook never fabricates keys and never claims full D05.

## What this qualifies

| Item | Outcome |
| --- | --- |
| Live OpenCode Zen HTTP boundary (EX43) | Optional — only when `ZOEN_OPENCODE_API_KEY` present |
| Product Eve admission / tip frontier gates | **Not** auto-flipped by the script |
| Full D05 / cloud speech / multi-provider | **Not** claimed |

Key alone does **not** admit product Eve (ZA-17). Journal (ZA-18), evidence grounding (ZA-19), and narrow text profile (ZA-20) remain separate gates.

## Prerequisites

1. Tip green (Verify) on the commit you intend to bind.
2. Operator-held OpenCode Zen API key — set in the **shell environment** or gitignored `.local/opencode.env`:

```bash
# .local/opencode.env (never commit; already under .local/ in .gitignore)
ZOEN_OPENCODE_API_KEY=…          # required
# ZOEN_OPENCODE_BASE_URL=https://opencode.ai/zen/v1   # optional
# ZOEN_OPENCODE_MODEL=big-pickle                        # optional
```

Fly secrets on `zoen-rebuild` may already hold `ZOEN_OPENCODE_*` for hosted runtime; **local qualify still needs the key in the operator shell** (do not scrape Fly secrets into chat/logs).

## One command

From repo root:

```bash
pnpm eve:qualify-gprovider
```

Equivalent:

```bash
python3 tests/integration/eve/gprovider/qualify.py
```

### Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Live EX43 smoke passed; evidence under `.local/eve-gprovider-qualification/` |
| `2` | **Fail-closed** — key unset/blank; no live call |
| `1` | Key present but live smoke failed; tip gates stay Blocked |

The script **never logs** the key. Evidence JSON records status only.

## After a live pass

1. Keep `.local/eve-gprovider-qualification/qualification.json` as operator evidence (local; not committed by default).
2. Open an **intentional** tip evidence PR that updates frontier `G-PROVIDER` / `textProfileAccepted` **only** with real proof + tip SHA/lockfile/image — do not flip gates from this runbook alone.
3. Do not claim full D05, activation-by-merge, or cloud speech.

## Fail-closed proofs (no key / no network)

```bash
python3 -m unittest discover -s tests/integration/eve/gprovider -p 'test_*.py'
```

## Related docs

- `docs/verification/eve-opencode-zen.md` — EX42/EX43 client + headers
- `docs/verification/eve-grounded-text.md` — ZA-20 text profile
- `docs/verification/frontier-status.json` — tip gate honesty
