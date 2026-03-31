# Port Parity Audit

## Intent

Determine how close the TypeScript port is to true completion, identify
any behavioral drift from the C source, and wire the remaining context
builder stubs so that every game-loop-reachable C function has a real
implementation in every TS context that references it.

## Goals

- A clear, data-backed picture of port completeness: what's done, what's
  stubbed, what's missing, what's drifted.
- All gameplay-critical stubs wired (or explicitly documented as
  intentional gaps).
- Confidence that fixing a bug won't create accidental new behavior — the
  port is traceable to C, not a divergent fork.

## Scope

In:
- Classifying all 220 unique stub names using the analysis tools
- Wiring stubs where real implementations exist but aren't plumbed
  into all context builders
- Investigating and fixing drift where TS behavior may differ from C
- Porting any missing functions that are on critical gameplay paths
- Updating the port health dashboard after each phase

Out:
- Persistence layer (save/load/recording/playback) — separate initiative
- Pixel art rendering — separate track entirely
- New features or gameplay changes — port only

## Constraints

- **600-line file limit.** Split files that grow past this.
- **C source is ground truth.** Read the C before writing TS. Every
  wired stub must match the C behavior, not improvise.
- **No silent stubs.** After this initiative, every remaining stub must
  either be in the persistence layer, an intentional gap documented in
  `docs/BACKLOG.md`, or throw an error on an unreachable path.
- **Analysis tools track progress.** Re-run `scan-stubs.ts` and
  `port-health.ts` after each phase. The numbers should monotonically
  decrease.
