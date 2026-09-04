# Assembly Visual Editor

An interactive web app that teaches x86_64 assembly (Intel syntax, NASM conventions) by animating exactly how the stack and registers change as you write and step through code.

Existing stack visualizers show you a static "current value" table. That lets you look state up, but it doesn't build the skill assembly actually demands: predicting how state changes, one instruction at a time. This tool makes that change visible and animated, live as you type.

This is a teaching tool, not a general-purpose assembly environment. It assumes you already know assembly basics — the visualization reinforces and clarifies, it doesn't tutor from zero.

## What it does

- **Registers update live as you type.** A plain `mov` is reflected immediately, with no play control involved.
- **The play control activates only once your program touches the stack.** Register-only code leaves it greyed out.
- **Each function call renders as its own labelled block**, so nested calls stack as separate boxes.
- **Any stack slot expands on click** to reveal what occupies it. Several can be open at once.
- **Click any line to seek there** — before or after the current position. The resulting state is looked up from the trace instantly, then collapses into a persistent corner thumbnail.
- **Loops are classified and compressed.** Loops that only change register values play the first iteration in full, then pulse the changed cell with an iteration counter. Loops that grow or shrink the stack are *never* compressed — watching that happen is the entire point. A "Full loops" toggle forces uncompressed playback.
- **Playback speed is adjustable** (0.5× / 1× / 2×).

## Not a compiler, not a VM

The engine is a fixed lookup table of state-transition rules over a defined teaching subset of instructions — closer to a spreadsheet of if-this-then-that rules than a CPU emulator.

There is no real memory addressing beyond a simulated stack, no syscalls, no interrupts, no paging. Nothing is ever read from a real process, debugger, or hardware: every value on screen is produced by simulating our own rules. The simulated `rsp` starts at an arbitrary plausible-looking address that means nothing.

## Architecture

Two strictly separated responsibilities, kept visible in the folder structure:

```
lib/engine/      deterministic ground-truth core — pure functions, immutable
                 snapshots, zero judgment calls. Must never be wrong.
lib/analysis/    pure derived readings of a trace (loop classification, playback plan)
lib/editor/      CodeMirror 6 + custom Lezer grammar, syntax highlighting, decorations
lib/playback/    XState machine owning playback position
lib/agents/      AI presentation layer — consumes the trace, never computes state
components/      UI panels
app/             Next.js App Router
```

The engine computes a full ordered trace — one immutable snapshot per instruction, plus per-step deltas and frame metadata — so seeking to any point is a lookup, never a replay. Everything downstream reads that trace and never recomputes state.

Register values are `bigint` wrapped to unsigned 64 bits, so two's-complement overflow behaves correctly. Faults (stack underflow, `ret` without `call`, divide-by-zero) are reported *on* the trace rather than thrown — a faulted trace still contains every step completed before the fault.

## Instruction subset

| Category | Instructions |
|---|---|
| Data movement | `mov`, `lea` |
| Arithmetic | `add`, `sub`, `inc`, `dec`, `imul`, `idiv`, `neg` |
| Logic | `and`, `or`, `xor`, `not`, `shl`, `shr` |
| Comparison | `cmp`, `test` |
| Control flow | `jmp`, `je`/`jne`, `jg`/`jl`, `jge`/`jle`, `loop` |
| Stack & calls | `push`, `pop`, `call`, `ret` |
| No-op | `nop` |

Instructions are modelled as a discriminated union, so adding one fails to compile until its state-transition rule exists.

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:3000. Paste [`examples/tour.asm`](examples/tour.asm) into the editor for a program that exercises every feature — arithmetic, division, branching, both loop kinds, and nested call frames.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm test` | Vitest once, including fast-check property tests |
| `npm run test:watch` | Vitest watch mode |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

The Lezer grammar is compiled from `lib/editor/assembly.grammar` into gitignored generated files; `dev`, `build`, `test`, and `typecheck` regenerate it automatically via pre-scripts.

## Testing

The engine is the one component that can never be wrong, so it's covered by property-based tests (fast-check via `@fast-check/vitest`) rather than hand-picked examples alone — invariants like "stack depth always equals pushes minus pops" are checked across generated instruction sequences, with seeded reproducible failures.

## Tech stack

TypeScript end to end. Next.js (App Router), CodeMirror 6 with a custom Lezer grammar, Motion for layout animation, GSAP for choreographed sequences, XState for playback position, Zustand for UI state, Vitest + fast-check for the core.

## Status

Build phases 1–6 are complete: scaffold, deterministic core, static UI shell, animation layer, seek/jump, and loop compression.

The AI narration layer (phase 7) is scaffolded but not implemented. The intent/chatbox feature — where you state your intent and the tool flags logical errors against the trace — is deliberately deferred; `lib/agents/` is its attachment point.

## Design docs

Full rationale lives in `docs/` one level up from this repo: visualization and animation design, visualization tech-stack choices, full-stack architecture decisions, and the original build prompt.
