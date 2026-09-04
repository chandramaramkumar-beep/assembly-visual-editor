# lib/engine — deterministic ground-truth core

This is the one part of the system that must never be wrong. Everything else in the product (animation, narration, seek/jump) trusts this core's output without re-checking it.

## Rules

- **Pure functions only.** Every instruction handler is `(priorState, instruction) => newState`. No mutation of shared state, no I/O, no randomness, no calls into `lib/agents/` or any LLM.
- **Immutable snapshots.** Each step produces a new state object. Never mutate a previous snapshot in place — the seek/jump mechanic depends on old snapshots staying exactly as they were computed.
- **Instructions are a discriminated union** (e.g. `{ kind: "push"; operand: Operand }`). Every switch over instruction kind must be exhaustive — let the TypeScript compiler enforce this (no default case that silently swallows unhandled kinds).
- **Adding a new instruction requires three things together**: the union member, the state-transition rule, and a property-based test. Don't land one without the others.
- **No example-only tests for new logic.** Use fast-check (`@fast-check/vitest`) to state the invariant (e.g. "stack pointer position always equals pushes minus pops so far, for any generated sequence") and let it generate cases. Example tests are fine as a first sanity check, not as the only coverage.
- **Output includes trace metadata**, not just final state — which frame each snapshot belongs to, what changed since the previous snapshot — so `lib/agents/` and the UI never need to recompute anything, only read.

## Scope reminder

This is a fixed lookup table over a defined teaching instruction subset, not a general instruction executor. If a change here would let the engine run arbitrary/unbounded programs against real memory semantics, it belongs outside this project's scope — flag it rather than building it.
