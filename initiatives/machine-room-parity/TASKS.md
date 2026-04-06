# Machine Room Parity — Tasks

## Phase 1: Research

- [x] Create `.context/research/machines.md` from template; add entry to INDEX.md
- [x] Use CodeQL to map the full C call chain from `addMachines` and `buildAMachine`;
      document in research doc
- [x] Document blueprint data structures, flags (`BP_*`), and the blueprint catalog
      (count types, note depth ranges and frequencies for major types)
- [x] Document the machine trigger/activation path in C: how key pickup leads to machine
      effects (trace `keyOnTileAt`, `updateEnvironment`, dungeon feature activation)
- [x] Document dormant monster mechanics in C: how monsters enter/exit dormant state,
      what activates them, relevant flags
- [x] Verify `gaps-Architect.md` NEEDS-VERIFICATION and MISSING claims against current
      TS code for the 6 key machine functions: `buildAMachine`, `addMachines`,
      `runAutogenerators`, `redesignInterior`, `fillSpawnMap`, `spawnDungeonFeature`
- [x] Finalize research doc: integration points, invariants, known TS gaps confirmed

# --- handoff point ---

## Phase 2: Tooling

- [x] Locate title screen menu in TS codebase; identify where to add the debug menu
      entry point
- [x] Enumerate all blueprint types from the C blueprint catalog; establish readable
      names for the checklist
- [x] Design and implement the debug menu: checklist of all machine types, accessible
      from title screen
- [x] Wire selected types: boost `frequency` significantly and set `depthRange[0]` to 1
      for all checked blueprints before game generation
- [x] Smoke-test: verify that selected types appear on shallow floors and that
      unselected types are not suppressed

# --- handoff point ---

## Phase 3: Gap Analysis

- [x] Compare `buildAMachine` C vs TS: document any logic divergence
- [x] Compare `addMachines` and `runAutogenerators` C vs TS
- [x] Compare `redesignInterior` and `prepareInteriorWithMachineFlags` C vs TS
- [x] Trace the key-pickup → machine-trigger path in TS; compare to C; document gaps
- [x] Trace dormant monster activation in TS; compare to C; document gaps
- [x] Examine B128 fix (`462ba1a`): determine if turret tile placement is a regression
      and document what the correct behavior should be
- [x] Consolidate all findings into a gap list in PLAN.md under a new
      `## Gap List` section; prioritize systemic gaps above per-machine gaps

# --- handoff point ---

## Phase 4: Fixes

*Tasks below are provisional — refine after Phase 3 gap list is complete.*

- [ ] Implement `evacuateCreatures` (systemic: affects all machines with terrain spawning)
- [ ] Fix the key-pickup → machine-trigger mechanism (systemic: affects all key-gated machines)
- [ ] Fix dormant monster activation (systemic: affects guardian, statue, rat, turret rooms)
- [ ] Fix glyph + guardian room: guardian spawn and teleport-on-glyph-step behavior
- [ ] Fix rat trap room: batched wall shattering sequence and rat spawning
- [ ] Fix arrow turret room: dormant-until-key behavior; correct tile placement
      (includes assessing and potentially reverting B128 regression)
- [ ] Fix dormant statue vault: monster revealed correctly on statue shatter
- [ ] Address any remaining per-machine gaps from the Phase 3 gap list

# --- handoff point ---

## Phase 5: Verification

- [ ] Use debug tool to cycle through each machine type; record pass/fail per type
- [ ] Playtest sign-off: all major machine types behave as expected
- [ ] Update research doc with any findings from fix/verification work
- [ ] Regenerate port health snapshot (`cd tools/analysis && npx tsx scan-stubs.ts && npx tsx port-health.ts`)

## Deferred
