# Phase 6: Stabilization — Plan

## Approach

Unlike previous phases which had a fixed scope of work, Phase 6 is iterative:

```
Playtest → Discover bugs → Analyze root causes → Fix → Verify → Repeat
```

Bugs are organized into **playtest rounds**. Each round is a playtesting session that produces a numbered list of bugs. Bugs within a round are prioritized by gameplay impact and grouped by code surface area for efficient fixing.

### Session Strategy

To manage context window limits during AI-assisted fixing, bugs are tackled in small groups of 2–3 per chat session, grouped by which files they touch:

- Bugs in the same function → same session
- Bugs in unrelated subsystems → separate sessions
- Systemic issues (patterns affecting many files) → dedicated session

### Lessons Learned from Phase 4 Playtest Fixes

The first round of playtest-driven fixes (12 bugs in Phase 4 Step 3g) revealed systemic patterns:

1. **DI "value copy" anti-pattern:** Primitive `rogue` state fields copied by value into contexts lose mutations. Fix: pass `rogue` by reference.
2. **"Simplified" implementations:** Functions labeled as simplified often omit critical behavior paths. Fix: compare against C source systematically.
3. **Missing event handling:** The main input loop didn't process all event types. Fix: audit event dispatch for completeness.
4. **Static analysis ≠ integration testing:** Compilation + unit tests don't catch integration issues. Manual playtesting is essential.

These lessons inform the approach for Phase 6: every fix should be validated by playing the affected scenario, not just checking compilation.

## Verification

After each round of fixes:
1. `npx tsc --noEmit` — zero compilation errors
2. `npm test` — all tests passing
3. Manual playtest of the specific scenarios that were broken
4. General playtest to check for regressions
