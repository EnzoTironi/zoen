# Specification and backlog change control

`planning/catalog.json` is the reviewed specification/task source. `planning/module-recipes.json` and `planning/files.json` own algorithm/file-plan inputs. `tooling/generate-plans.py` derives current specs/tickets, algorithms, co-located plans, check mappings and navigation. `planning/state.json` is execution state, not authored design. Generated artifacts must not be edited independently; promote a source record before implementing it so generation cannot overwrite code.

A material change needs: stated problem; affected invariant/contract/capability; smallest proposed change; migration and compatibility consequences; new or changed test oracle; dependency/activation impact; and independent approval. Update authored source, record a decision in `architecture/amendments/`, regenerate, validate and reopen affected evidence. Pure wording fixes also regenerate but need not invalidate unrelated runtime proofs.

Identifiers are stable. Do not renumber accepted tickets, capabilities or check IDs. Retired work remains visible with a replacement link; no deletion that makes audit history disappear. This initial pack assigns IDs once; later additions append IDs rather than inserting into the middle of the source list. Generation must reject reuse or mutation of identity after an execution-state acceptance exists.

A weaker model may implement within a contract, but does not arbitrate security or financial meaning. When a ticket exposes an unmodeled requirement, it reports a spec gap rather than producing a convenience abstraction. Gate owners decide operating scope; they do not waive semantic correctness.
