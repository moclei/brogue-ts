# Game Design Ideas — Feature Wishlist & Anti-Patterns

> **Purpose:** Living document of game design ideas extracted from cross-game analysis.
> Features are categorized as "aspirational" (would be nice to have in some form) or
> "anti-patterns" (should be actively avoided). Each entry has a proper game design name,
> reference games, and preliminary implementation thoughts for a Brogue-like context.
>
> **Status:** Ideation phase. Practicality constraints deferred to future iterations.
>
> **Design Philosophy:** The FromSoft principle — every mechanic must earn its place.
> Nothing is assumed. No mechanic should introduce "false gameplay" that captures time
> without serving the grander experience. Remove before you add.

---

## Table of Contents

1. [Design Pillars](#design-pillars)
2. [Aspirational Features](#aspirational-features)
3. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
4. [Brogue Audit — Existing Features Through This Lens](#brogue-audit)
5. [Mashup Concepts — The Emerging Game](#mashup-concepts)
6. [Reference Games by Relevance](#reference-games)

---

## Design Pillars

These are the abstract principles extracted from the feature analysis. They should
guide every future design decision.

### Opinionated Design (Auteur Design)
The designer's job is not to give players what they ask for, but to create the
experience that produces the most genuine enjoyment. Features must justify their
existence; genre conventions are not automatic inclusions. "Fun traps" — things
players think they want but that actually reduce enjoyment — should be identified
and removed.

Practitioners: Hidetaka Miyazaki (FromSoft), Fumito Ueda (Team Ico), Jonathan Blow
(Braid, The Witness), Brian Walker (Brogue).

### Intentional Friction vs. Unnecessary Friction
Friction is acceptable when it creates meaningful tension (Dark Souls' slow Estus
animation forces commitment). Friction is unacceptable when it's busywork disguised
as gameplay (sorting 200 inventory items to find the one you need).

Test: "Does this friction create a genuine decision, or just waste time?"

### Organic Systems Over Explicit Mechanics
The best mechanics emerge from systems interacting, not from explicit rules. Players
should discover possibilities, not be told about them. When a fire spell ignites a
grease pool and the smoke blinds enemies — that's organic. When a tooltip says
"Fire + Grease = Smoke Screen (15% evasion bonus)" — that's explicit and worse.

### Respect the Player's Time
Every moment the player spends should either be fun in itself OR serve something
that's fun. Resource grinding, inventory sorting, and container checking fail this
test. If an activity isn't fun AND doesn't serve fun, cut it.

---

## Aspirational Features

### 1. Checkpoint with Reset Cost
**Proper name:** Risk-Reward Rest System / Checkpoint with Reset Penalty
**Source inspiration:** Dark Souls bonfires, Hollow Knight benches

Resting heals and restores resources, but imposes a cost on the world — enemies
respawn, the dungeon becomes more alert, or some other penalty fires. Creates a
genuine decision: "Can I afford to rest, or should I push forward?"

**Reference games:**
- Dark Souls / Elden Ring — bonfires / Sites of Grace (enemies respawn)
- Hollow Knight — benches (enemies respawn, shade spawns at death location)
- Star Wars Jedi: Fallen Order — meditation points (enemies respawn)
- Tunic — foxfire shrines
- Blasphemous — Prie Dieu altars

**Brogue-adjacent roguelikes:** No direct equivalent found. This would be novel in
the traditional roguelike space.

**Implementation sketch:** Resting for N turns could fully heal the player but
advance a "dungeon awareness" counter — monsters gain buffs, new packs spawn, or
the next depth becomes harder. Alternatively, resting could extinguish nearby light
sources (creating new tactical challenges) or attract a wandering predator. The
existing hunger clock already creates anti-rest pressure; a rest mechanic would need
to interact with it carefully.

---

### 2. Mastery-Based Difficulty (Skill-Gated Challenge)
**Proper name:** Skill-Gated Difficulty / Mastery Curve Design
**Source inspiration:** Dark Souls, Brogue (already present)

Difficulty comes from player understanding and execution, not stat walls or RNG.
Every death should feel like the player's mistake.

**Reference games:**
- Dark Souls / Elden Ring — pattern recognition, spacing, timing
- Spelunky 1 & 2 — knowledge-based mastery
- Into the Breach — perfect information tactical puzzles
- Celeste — precision platforming (different genre, same principle)

**Brogue-adjacent roguelikes:**
- DCSS — community mantra: "if you died, it was avoidable"
- Cogmind — every engagement is a solvable tactical puzzle
- Brogue itself — already a gold standard for this

**Status in Brogue:** Already present and strong. Preserve and protect this quality.
New features should not undermine it (e.g., no RNG-dependent combat outcomes that
the player can't mitigate through positioning or item use).

---

### 3. Partial Permadeath / Retrievable Loss
**Proper name:** Corpse Run / Retrievable Loss / Graduated Death Penalty
**Source inspiration:** Dark Souls (lose souls, retrieve from corpse)

Death has real consequences (tension), but you don't lose everything (not
demoralizing). Sits between full permadeath and trivial death.

**Reference games:**
- Dark Souls — lose souls/runes, retrievable once
- Hollow Knight — lose geo, shade marks death location
- Salt and Sanctuary — lose salt
- Minecraft — drop inventory, despawn timer

**Brogue-adjacent roguelikes:**
- ToME (Tales of Maj'Eyal) — "Adventure" mode with limited lives
- Shattered Pixel Dungeon — ankh resurrection item (consumable, limited)
- Hades / Dead Cells — roguelite model (lose run progress, keep meta-progress)

**Implementation sketch:** Several possible approaches:
1. **Stash system** — the player can bank items at certain depths; banked items
   survive death. New runs can retrieve them, but the stash location is dangerous.
2. **Legacy system** — dying leaves a ghost/corpse in future runs at the same depth
   with some of your items. Finding your own ghost is a mini-event.
3. **Partial reset** — death sends you back N depths rather than ending the run,
   but you lose your best item or all enchantments above +3.
4. **Light meta-progression** — knowledge persists (identified items stay identified
   across runs), but no material advantage carries over.

---

### 4. Environmental Storytelling / Lore Discovery
**Proper name:** Environmental Storytelling / Passive Narrative / Item Lore
**Source inspiration:** Dark Souls item descriptions, Hollow Knight lore tablets

Story is embedded in the world rather than delivered through cutscenes or dialog.
Players who want story can find it; players who don't are never interrupted.
Multi-playthrough discovery extends the game's life.

**Reference games:**
- Dark Souls / Elden Ring — item descriptions contain the entire narrative
- Hollow Knight — lore tablets, NPC fragments, environmental clues
- Outer Wilds — the entire game is discovering story through exploration
- Tunic — fake game manual you piece together
- Hyper Light Drifter — zero dialog, pure environmental storytelling

**Brogue-adjacent roguelikes:**
- Caves of Qud — extremely rich lore discoverable through items and NPCs
- Brogue — vault designs already tell spatial stories

**Implementation sketch:** Item descriptions could contain fragments of dungeon
history. Scrolls could have lore text alongside their mechanical effect. Vault
layouts could reference events from other vaults. A "codex" or "journal" could
accumulate discovered lore across runs (light meta-progression that doesn't affect
gameplay). The key constraint: lore must never interrupt gameplay flow. It should
be pull, not push.

---

### 5. Build Crafting / Combinatorial Synergies
**Proper name:** Combinatorial Power System / Synergy-Driven Build Crafting
**Source inspiration:** Hades boons, Slay the Spire cards, BG equipment optimization

The joy of discovering that two individually modest choices combine into something
powerful. Partially controlled (you choose your weapon) and partially emergent (the
boons/cards you're offered are random).

**Reference games:**
- Hades — weapon aspects + boons + duo boons
- Slay the Spire — card synergies (arguably the gold standard)
- Risk of Rain 2 — item stacking and interaction
- Binding of Isaac — item synergies (often wild and unexpected)
- Balatro — poker hand + joker synergies
- Path of Exile — passive tree + gem links (extreme end)

**Brogue-adjacent roguelikes:**
- DCSS — species + background + god + equipment synergies
- Caves of Qud — mutations + cybernetics + equipment + skills
- Cogmind — part-swapping IS the build system
- Brogue — item enchantment choices create builds (+10 war pike vs +10 stealth ring)

**Implementation sketch:** Brogue's existing enchantment system is a primitive
version of this. It could be deepened by:
1. **Runic combinations** — two runics on different items interact (e.g., a weapon
   of confusion + armor of reflection = confused enemies attack each other)
2. **Ally synergies** — certain ally types buff certain playstyles
3. **Terrain exploitation** — items that interact with dungeon features (staff of
   fire + flammable terrain = tactical area denial)
4. **Depth-gated modifiers** — deeper items have more complex interaction profiles

Brogue already has emergent terrain-item interactions (fire + gas, water + levitation).
The foundation exists; it could be made more varied and discoverable.

---

### 6. Base Building / Spatial Planning
**Proper name:** Base Building / Colony Management / Spatial Planning
**Source inspiration:** Dwarf Fortress fortress mode, Minecraft building

The satisfaction of carving out a space, deciding where things go, building
production chains, and defending against threats.

**Reference games:**
- Dwarf Fortress — the original, maximum depth
- Rimworld — the most accessible colony sim
- Oxygen Not Included — physics-driven base building
- Factorio / Satisfactory — production-chain focused
- Minecraft — creative + survival building

**Brogue-adjacent roguelikes:**
- KeeperRL — roguelike + dungeon management hybrid (very relevant)
- Dungeon Keeper — you build and manage the dungeon
- Dwarf Fortress adventure mode — explore a world with DF's depth

**Implementation sketch:** This is a major departure from Brogue's design. Possible
lighter-weight interpretations:
1. **Camp system** — the player can establish a small camp at certain locations,
   placing barricades, traps, and light sources from inventory items. The camp
   persists as long as you're on that depth.
2. **Room claiming** — cleared vault rooms could be "claimed" and provide passive
   benefits (healing over time, monster vision, safe rest).
3. **Ally management** — rather than building structures, you build a party. Allies
   have needs, can be equipped, and can be assigned roles.

---

### 7. Production Chains / Crafting Progression
**Proper name:** Crafting Progression / Tech Tree / Material Bootstrapping
**Source inspiration:** Minecraft progression, Dwarf Fortress production, Factorio

The loop of gathering materials to make tools that let you gather better materials
to make better tools. The bootstrapping feeling.

**Reference games:**
- Minecraft — wood → stone → iron → diamond progression
- Terraria — deeper progression tree with more branches
- Valheim — curated, milestone-based progression
- Factorio — the extreme: automation of automation

**Brogue-adjacent roguelikes:**
- Caves of Qud — tinker system (find blueprints, combine components)
- Cataclysm: DDA — deep crafting system in a roguelike
- Cogmind — parts are your progression (better parts = better capabilities)

**Implementation sketch:** Brogue's item system is found-not-crafted. Crafting could
be introduced lightly:
1. **Scroll combination** — two scrolls of the same type combine into a more
   powerful version
2. **Potion mixing** — combine potions for hybrid effects (discovery-based)
3. **Runic forging** — find runic components in the dungeon; apply them to
   equipment at a forge location (depth-gated)
4. **Material quality** — items have material tiers that affect enchantment ceiling

---

### 8. Multi-Vector Threat / Existential Tension
**Proper name:** Multi-Vector Threat System / Emergent Crisis
**Source inspiration:** Dwarf Fortress sieges/flooding/starvation, Rimworld raids

Danger comes from multiple directions simultaneously and unpredictably. The tension
of juggling multiple threats creates memorable moments.

**Reference games:**
- Dwarf Fortress — sieges, floods, cave-ins, forgotten beasts, tantrum spirals
- Rimworld — raids, disease, mental breaks, toxic fallout
- Frostpunk — cold, hunger, hope, discontent (multiple failure axes)
- They Are Billions — expanding threat perimeter

**Brogue-adjacent roguelikes:**
- Brogue itself — already has this: monsters + hunger + terrain + gas + fire + water
- DCSS — multiple threat types per floor
- Caves of Qud — faction conflicts, environmental hazards

**Status in Brogue:** Already present and strong. The interaction between fire, gas,
water, monsters, and terrain creates genuine multi-vector tension. This could be
deepened with more environmental hazard types or cascading chain reactions.

---

### 9. Periodic Trade / Economic Events
**Proper name:** Trade Caravans / Periodic Economy Events
**Source inspiration:** Dwarf Fortress traders, Moonlighter

Periodic opportunities to exchange resources. The preparation loop: "the merchant
comes on depth 5; I need to decide what to keep and what to trade."

**Reference games:**
- Dwarf Fortress — seasonal trade caravans
- Rimworld — trade caravans and orbital traders
- Recettear — you run the item shop that RPG heroes buy from
- Moonlighter — dungeon crawl to stock your shop

**Brogue-adjacent roguelikes:**
- DCSS — shops on certain floors (static, not periodic)
- Brogue — no shops or trade (by design)

**Implementation sketch:** A wandering NPC merchant who appears at random intervals.
The tension: the merchant offers powerful items but their prices require sacrificing
current equipment or consumables. This conflicts somewhat with Brogue's "no shops"
philosophy, but could work if the merchant is rare, dangerous to reach, and the
trade involves genuine sacrifice rather than accumulated currency.

---

### 10. Creature Ecology / Living World
**Proper name:** Creature Ecology / Living World Simulation / Monster Ecosystem
**Source inspiration:** Baldur's Gate world, Dwarf Fortress simulated history

The feeling that the world exists independently of the player. Creatures have
relationships, territories, and behaviors that play out whether you're watching
or not.

**Reference games:**
- Monster Hunter — monsters hunt and fight each other
- Dwarf Fortress — thousands of years of simulated history
- Gothic 1 & 2 — NPCs with full daily routines
- Kenshi — fully simulated world with factions
- Caves of Qud — factions with relationships and politics

**Brogue-adjacent roguelikes:**
- Brogue — already has creature relationships (jackals in packs, ogre-goblin
  enslaver relationships, dar war parties, eel ambush behavior)
- DCSS — some inter-monster interactions
- Caves of Qud — deep faction system

**Implementation sketch:** Brogue's existing creature ecology could be deepened:
1. **Off-screen simulation** — monsters move and interact even in rooms the player
   hasn't visited. You might arrive to find the aftermath of a battle.
2. **Faction dynamics** — groups of creatures that cooperate or conflict. Finding
   a troll fighting kobolds is an opportunity.
3. **Territorial behavior** — monsters defend specific areas more aggressively.
4. **Predator-prey chains** — some creatures hunt others; the player can exploit this.

---

### 11. NPC Delegation / Autonomous Allies
**Proper name:** NPC Delegation / Follower AI / Autonomous Agent Management
**Source inspiration:** Minecraft villagers (desire for more), Dwarf Fortress jobs

NPCs that can be given tasks, assigned roles, and operate semi-autonomously. The
player becomes a commander rather than a solo actor.

**Reference games:**
- Rimworld — colonists are semi-autonomous agents with skills and moods
- Mount & Blade — companions and army management
- Dwarf Fortress — job assignment and labor management
- Medieval Dynasty — villagers build and produce

**Brogue-adjacent roguelikes:**
- Brogue — allies follow and fight but can't be commanded beyond empowerment
- KeeperRL — full creature management in a roguelike context
- Caves of Qud — companions with full inventories and AI

**Implementation sketch:** Brogue's ally system could be expanded:
1. **Ally commands** — basic orders: hold position, guard area, scout ahead, retreat
2. **Ally roles** — tank, scout, support, based on creature type
3. **Equipment sharing** — give items to allies to change their capabilities
4. **Ally needs** — allies that get hungry, scared, or injured create management
   tension without being pure micromanagement

---

### 12. Quick Run Loop / Low Friction Retry
**Proper name:** Tight Gameplay Loop / Low Friction Retry
**Source inspiration:** Hades, Spelunky, Slay the Spire

Short enough runs that failure is a learning opportunity, not a setback. Fast
restart encourages experimentation.

**Reference games:**
- Hades — 20-40 minute runs
- Spelunky — 5-20 minute runs
- Into the Breach — 30-60 minute runs
- Slay the Spire — 30-60 minute runs
- Vampire Survivors — 15-30 minute runs

**Brogue-adjacent roguelikes:**
- Brogue — runs are 1-2 hours (medium length)
- Shattered Pixel Dungeon — 30-60 minute runs
- Jupiter Hell — 30-45 minute runs

**Status in Brogue:** Brogue runs are already reasonably short for a traditional
roguelike. Making them shorter would risk sacrificing depth. However, optional
"sprint" modes (fewer depths, denser content) could offer a tighter loop for
players who want it.

---

### 13. Recipe Discovery / Experimental Crafting
**Proper name:** Discovery-Based Crafting / Experimental Crafting
**Source inspiration:** Minecraft recipe discovery, BotW cooking

The joy of experimenting with combinations and discovering something new. The
crafting system rewards curiosity.

**Reference games:**
- Zelda: Breath of the Wild — cooking system (combine ingredients freely)
- Noita — alchemy (combine materials for emergent effects)
- Little Alchemy — pure combination discovery
- Minecraft — recipe experimentation

**Brogue-adjacent roguelikes:**
- Caves of Qud — tinker system
- Brogue — item identification is a simpler version of this (discovering what a
  potion/scroll does through experimentation)

**Implementation sketch:** Brogue's identification system already has the kernel of
this: drinking unknown potions, reading unknown scrolls. This could be expanded:
1. **Potion mixing** — combine two potions for a new effect. Some combinations are
   useful, some are dangerous. Discovery persists across runs (light meta).
2. **Scroll layering** — use two scrolls on the same item for a compound enchantment.
3. **Environmental reactions** — throw a potion into fire, water, or gas for
   different effects than drinking it.

---

### 14. Persistent NPC Relationships / Inter-Run Story
**Proper name:** Persistent NPC Relationships / Inter-Run Narrative Progression
**Source inspiration:** Hades NPC conversations between deaths

NPCs remember you across runs. Relationships develop over many attempts. Story
unfolds gradually through repeated interaction.

**Reference games:**
- Hades — NPCs have hundreds of unique dialog lines that play out over many runs
- Rogue Legacy — the castle and its inhabitants evolve
- Moonlighter — town relationships develop as you fund upgrades

**Brogue-adjacent roguelikes:** No direct equivalent found. This would be novel.

**Implementation sketch:** A "hub" area between runs where persistent NPCs reside.
They comment on your previous runs, offer hints, or unlock new starting options.
The key constraint: this must not become a barrier to starting a new run (no
mandatory dialog, no "talk to everyone before you can play").

---

## Anti-Patterns to Avoid

### AP1. Inventory Tax (Inventory Management as False Gameplay)
**What it is:** When the player spends significant time sorting, comparing, and
discarding items rather than engaging with the actual game.

**Why it's bad:** It creates a sense of "playing the game" without actual fun.
Players optimize compulsively, spending 40% of playtime in menus.

**Offenders:** Skyrim, Baldur's Gate, Diablo, Fallout, most CRPGs.

**The FromSoft counter:** Elden Ring's effectively unlimited inventory. Carry
everything; the constraint is on what you can EQUIP, not what you can CARRY.

**Brogue's position:** 26-slot pack with sparse items. Rarely hits the limit.
The real constraint is enchantment commitment, which is a meaningful decision,
not busywork. Currently well-designed — protect this.

---

### AP2. Container Compulsion (Loot Fatigue)
**What it is:** Dozens of interactable containers (barrels, crates, chests) scattered
throughout the world, most containing trivial or worthless items.

**Why it's bad:** Exploits variable-ratio reinforcement (Skinner box). Players feel
compelled to check every container despite the activity being unfun. "I have 50,000
gold but I MUST open this barrel in case there's 3 gold in it."

**Offenders:** Skyrim, Baldur's Gate, Divinity: Original Sin, most open-world RPGs.

**The FromSoft counter:** Items are placed deliberately in the world. Environmental
cues telegraph important items. No generic containers.

**Brogue's position:** No containers. Items are visible on the floor. Already avoids
this entirely — protect this.

---

### AP3. Resource Grind (Currency Sinks as Content)
**What it is:** "Collect 20 bones to unlock the next tier." Activities that aren't
fun in themselves, justified only by the reward. Extrinsic motivation masquerading
as gameplay.

**Why it's bad:** Pulls the player out of the world. The mechanic is transparent and
arbitrary. Time spent grinding is time not spent on actual gameplay.

**Offenders:** Hades (to a degree), most mobile games, many MMOs, Destiny.

**The FromSoft counter:** Resources come from playing naturally. You CAN grind, but
it's not required, and diminishing returns discourage it.

**Brogue's position:** No XP, no currency, no unlock trees. Items are found, not
purchased. Already avoids this entirely — protect this.

---

### AP4. Consequence-Free Death
**What it is:** Death has no meaningful cost. Infinite resurrection, reload from
save, respawn with all gear. Removes tension from the experience.

**Why it's bad:** Without stakes, combat becomes a formality. The player never feels
genuine danger, and victories feel hollow.

**Offenders:** Baldur's Gate (infinite resurrection), most games with save-scumming.

**Brogue's position:** Full permadeath. Maximum stakes. Any softening of this (see
Aspirational #3) should be carefully designed to preserve tension.

---

### AP5. Excessive Micromanagement (Decision Fatigue)
**What it is:** Granularity of control that exceeds what's enjoyable. Setting
individual work orders for each material type, managing supply chains item by item.

**Why it's bad:** The decisions aren't interesting individually; they're only tedious
collectively. The player wants to say "make swords" not "make 3 iron swords, 2
copper swords, 1 steel sword, using the east forge, on Tuesdays."

**Offenders:** Dwarf Fortress (work orders), some 4X games, city builders.

**The solution:** Intelligent defaults, material substitution, category-based
ordering. Let the player express intent, not specify every detail.

**Brogue's position:** Very little micromanagement. No crafting, no production.
If crafting or base-building is added, this anti-pattern must be guarded against.

---

### AP6. Z-Level Readability Failure (Spatial Illegibility)
**What it is:** Multi-level environments where the player can't mentally model what's
happening across levels. Switching between z-levels is disorienting.

**Why it's bad:** The player's spatial model breaks down. Movement feels "janky."
Can't tell where things are relative to each other.

**Offenders:** Dwarf Fortress (notoriously), some base-builders.

**Better examples:** Oxygen Not Included (clear z-level UI), Into the Breach (flat).

**Brogue's position:** Single-plane per depth. The depth transition is a clean
context switch. If multi-level features are added, spatial legibility is critical.

---

### AP7. Content Ceiling (Solved State)
**What it is:** The game has a finite set of goals, and once achieved, there's no
reason to continue. The strategic space is "solved."

**Why it's bad:** Even games with hundreds of hours of content eventually hit this.
The player feels "done" not because they're satisfied, but because there's nothing
left to discover.

**Offenders:** Minecraft (after Ender Dragon + all materials), most story-driven
games.

**The antidote:** Emergent complexity — systems that interact to produce novel
situations indefinitely. Roguelikes are inherently strong here (procedural
generation + permadeath = infinite novelty), but even roguelikes can feel "solved"
if the strategic space is fully explored.

**Brogue's position:** Generally strong due to procedural generation and permadeath.
The strategic space could be deepened with more item interactions, ally types, and
environmental mechanics.

---

### AP8. Overt Narrative / Forced Story
**What it is:** Unskippable cutscenes, mandatory dialog trees, story that interrupts
gameplay flow.

**Why it's bad:** Players who want to play can't. Players who want story get it
whether they're ready or not. Neither group is well-served.

**The FromSoft counter:** Story exists but is never forced. It's embedded in item
descriptions, environmental details, and optional NPC dialog. Players who seek it
find it rewarding because it was their choice.

**Brogue's position:** Minimal narrative. The dungeon itself is the story. Any
narrative additions should follow the environmental storytelling model — embedded,
optional, and never interrupting gameplay.

---

### AP9. Fluffy Combat (Low Impact Feel)
**What it is:** Combat that lacks weight, consequence, or tactical interest. Button
presses don't feel connected to outcomes. Encounters are speed bumps, not decisions.

**Why it's bad:** Combat is the primary interaction in most games. If it doesn't
feel good, the game doesn't feel good.

**Offenders:** Minecraft, many early-access survival games.

**The positive:** Games where every hit feels meaningful — Dark Souls (weight,
commitment), Brogue (tactical positioning), Into the Breach (puzzle combat).

**Brogue's position:** Strong. Every combat encounter is a tactical decision. Should
be preserved and deepened, not simplified.

---

## Brogue Audit

Analyzing Brogue's existing features through the "earn your place" lens.

### Features That Have Earned Their Place
| Feature | Why It Works |
|---|---|
| No character classes | Items ARE your build; every run starts equal |
| No shops/currency | Removes gold-hoarding; items are found, not bought |
| No XP/leveling | Removes grind incentive entirely; depth IS progression |
| Permadeath | Maximum stakes; every decision matters |
| Transparent mechanics | Damage numbers, percentages — no hidden information |
| Sparse meaningful items | Every item matters; no trash loot |
| Creature ecology | Jackals pack, ogres enslave goblins, dar form parties |
| Terrain interactions | Fire + gas + water + plants = emergent tactical space |
| Ally system | Empowered allies are builds unto themselves |
| Vault/key design | Each vault tells a spatial story |
| Hunger clock | Forces forward progress (debatable — see below) |

### Features Worth Questioning
| Feature | Question | Analysis |
|---|---|---|
| Hunger clock | Intentional or unnecessary friction? | Forces pace, prevents camping. But it's a blunt instrument — could it be more interesting? Maybe hunger should create opportunities (desperate scavenging, risky foraging) rather than just a countdown to death. |
| Item identification | Meaningful discovery or punishment? | The gamble of an unknown potion is genuinely exciting. But "this scroll could be Remove Curse or it could waste my only scroll" is sometimes frustrating rather than fun. The system works but could offer more agency. |
| 26-item pack | Doing useful work? | Rarely hit, so it's not Inventory Tax. But it also rarely creates meaningful decisions. It might be dead weight — neither helpful nor harmful. |
| Single-use scrolls | Too punishing? | Reading a scroll of enchantment on the wrong item is devastating and irreversible. Is this "fair but tough" (you should have identified first) or just cruel? |
| Depth-only progression | Missing horizontal variety? | Each depth is harder, but is there enough variety in HOW it's harder? More environmental variety, branching paths, or optional challenge areas could add horizontal richness. |

---

## Mashup Concepts

These concepts synthesize multiple aspirational features into concrete game mechanics.
They represent the "emerging game" — the thing this project might actually become if
the ideas survive the practicality filter.

### Unified Vision

> A roguelike where you're not just surviving a dungeon — you're taming one. Above
> ground, you build a settlement fueled by what you bring back from below. Below
> ground, each descent is a classic Brogue-style roguelike run, but with purpose:
> resources for the colony, territory to secure, allies to rescue. Death is permanent
> for the run but strategic — bonfire-caches let you invest in the future. The colony
> grows between runs, providing better tools and intel. A new stat rewards non-combat
> problem-solving and leadership, making "commander" runs as viable as "warrior" runs.

This is not Brogue (pure descent roguelike), not Dwarf Fortress (pure colony sim),
not Hades (pure action roguelite). It sits at their intersection, held together by
the FromSoft principle: every mechanic earns its place, nothing is busywork.

---

### M1. The Bonfire — Voluntary Sacrifice / Strategic Cache

**Combines:** Checkpoint with Reset Cost + Partial Permadeath + Respect Player's Time

A bonfire is not a rest point. It is a *surrender point*. The player assesses their
situation mid-run and can choose to deliberately end the run, caching selected items
at the bonfire's depth for a future run to retrieve.

**The decision it creates:** "I have a +5 war pike and three enchantment scrolls. Do
I push deeper and risk losing everything, or do I bonfire here, cache the scrolls,
and guarantee my next run starts with a massive advantage on depth 12?"

**Subversion value:** Players who've internalized the Souls bonfire will expect to sit,
rest, and continue. Instead: "You can't rest here. You can *quit* here, wisely." This
is opinionated design — the mechanic contradicts player expectation in a way that
creates a better, more honest experience.

**Cache degradation:** Caches should not persist indefinitely, or players will
repeatedly bonfire-cache to stockpile a god-tier starting loadout. Options:
- One item lost from the cache per run that passes without retrieval
- Monsters have a chance to loot the cache (you arrive to find it partially emptied)
- Cache attracts a guardian creature — retrieval is a mini-boss encounter
- Cache items lose enchantment levels over time (a +5 war pike becomes +3 after two
  runs, then +1, then it's a mundane war pike)

The degradation model matters: it should create urgency to retrieve without making
caching feel pointless. The "guardian creature" option is interesting because it
creates emergent encounters — you cached a powerful staff, and now a creature has
picked it up and is using it against you.

**What this replaces:** Traditional permadeath becomes "permadeath with a will."
You die for real, but you can choose to die on your own terms.

---

### M2. Secured Depths / Territory Locking

**Combines:** Base Building + Partial Permadeath + Multi-Vector Threat

After conquering a sufficient number of depths (clearing key threats, completing
vault puzzles, defeating a depth boss), the player can "lock" a stairway, making
all depths above it secured territory. Secured depths become:

- **Safe for traversal** — no random monster spawns, though environmental hazards
  may remain
- **Available for construction** — the colony sim operates in secured depths
- **A supply line** — resources flow between the colony and the active dungeon front

**The decision it creates:** Locking a stairway is a permanent commitment. You're
declaring "I've conquered this far." But the dungeon might push back — periodic
incursions from below could threaten secured territory, requiring the player to
return and defend. This prevents the colony from being a pure safe zone and
maintains tension.

**Scaling:** Early game has no secured depths — it's pure Brogue. Mid-game, you
secure your first few depths and the colony begins. Late game, you're managing a
substantial colony while pushing into increasingly dangerous depths. The game's
character shifts gradually from "survival roguelike" to "roguelike + colony sim."

**Depth boss concept:** Each "lockable" stairway could be guarded by a unique,
procedurally-varied boss encounter. This gives structure to the "when can I lock?"
question and creates memorable milestones.

---

### M3. Surface Colony / Settlement Management

**Combines:** Base Building + NPC Delegation + Production Chains + Creature Ecology

A surface-level map sits above the cave entrance. This is the colony — the
player's persistent base of operations between runs. It starts empty and grows
through ally rescue and resource investment.

**Colonist sources:** Allies freed during dungeon runs who are not suited for
combat. A rescued goblin tinker becomes a workshop manager. A freed human prisoner
becomes a guard captain. A tamed animal becomes livestock. The type of colonist
determines what they can do, creating variety in colony capability based on who
you rescue.

**Colony systems (high-level direction, not micromanagement):**
- **Buildings** — smithy, alchemist, barracks, watchtower, farm. Player chooses
  what to build and where; colonists handle construction.
- **Production** — the smithy needs iron from depth 6; the alchemist needs
  mushrooms from depth 4. Production creates *missions* for dungeon runs.
- **Defense** — periodic threats from the cave entrance. Colony defenses reduce
  this risk but never eliminate it. The player may need to return to defend.
- **Trade** — periodic visitors to the colony who buy and sell. Preparation for
  trade creates a Dwarf-Fortress-style anticipation loop.

**Anti-micromanagement principle:** The colony must run with intelligent defaults.
You say "build a smithy" and the colonists choose materials, assign workers, and
build it. You say "make weapons" and the smithy uses whatever materials are
available. You never specify "make 3 iron swords using the east anvil." If DF's
micromanagement is a 10 and Rimworld's is a 5, this should be a 3 — closer to
"set policies and watch them execute" than "issue individual orders."

**Between-run loop:** After a run (whether you died, bonfired, or returned
voluntarily), you arrive at the colony. You check on construction, talk to
colonists, prepare equipment, choose your next mission, and descend. This is the
Hades "House of Hades" equivalent — but one you built.

---

### M4. Item Economy — Dungeon as Resource Mine

**Combines:** Production Chains + Build Crafting + Respect Player's Time

Every item found in the dungeon has dual value: *personal use value* (use it this
run) and *colony investment value* (bring it up for the settlement). This creates
the best kind of inventory decision — not "which of these do I throw away" but
"which of these serves me more here vs. up there?"

**Examples:**
- A +3 staff of lightning: use it for combat this run, OR give it to the colony
  enchantress to study (unlocks lightning-type items in future colony production)
- Three health potions: drink them to survive deeper, OR deliver to the colony
  alchemist (expands her recipe knowledge)
- A war hammer: equip it now, OR give it to the guard captain (improves colony
  defenses while you're underground)

**The bootstrapping loop:** Colony grows → provides better starting equipment/intel
for next descent → push deeper → find rarer resources → colony grows more. This
is the Factorio satisfaction loop in a roguelike context.

**What this avoids:** No currency. No gold coins. No "sell 50 rat pelts." Items
have inherent value through their function, both personal and communal. Trade with
visiting merchants uses barter, not money. This preserves Brogue's "no shops/
currency" philosophy while adding an economic layer.

---

### M5. Consumable Combination / Experimental Alchemy

**Combines:** Recipe Discovery + Build Crafting + Organic Systems

Scrolls, potions, and staffs can be combined for emergent effects. The system
rewards experimentation and creates a second layer of discovery on top of Brogue's
existing identification mechanic.

**Design principles:**
- Combinations should follow *principles*, not *recipes*. "Fire + any liquid =
  steam effect" is a principle. "Potion #7 + Scroll #12 = Fireball" is a recipe.
  Principles are discoverable; recipes are memorizable homework.
- Some combinations should be dangerous. Risk of mixing creates a genuine decision.
- The colony alchemist could reduce risk — she identifies dangerous combinations
  before you try them. This makes the colony mechanically useful.

**Possible combination axes:**
- **Potion + potion** — hybrid effects (healing + fire = cauterize, a weaker heal
  that also cures poison and burns away debuffs)
- **Scroll + item** — compound enchantments (scroll of protection + scroll of fire
  on a weapon = a flame-warded blade)
- **Potion + environment** — throw a potion into fire, water, or gas for a
  different effect than drinking it (potion of levitation thrown into water creates
  a floating platform; potion of confusion thrown into gas creates a hallucinogenic
  cloud)
- **Staff + staff** — a dual-staff that alternates effects (staff of fire +
  staff of tunneling = a staff that melts through walls)

**What this avoids:** No crafting menu. No recipe book. No "gather 5 mushrooms
and 2 fairy dust to make a potion." Combination happens in the field, with items
you already have, through direct interaction.

---

### M6. A Third Stat — Cunning / Resonance / Presence

**Combines:** Build Crafting + Mastery-Based Difficulty + NPC Delegation

Brogue's run viability is gated on strength potions and enchantment scrolls. A
third stat creates an alternative path to power — one that doesn't require combat
superiority.

**Candidates (not mutually exclusive — could be aspects of a single stat):**

**Cunning** — ability to exploit systems rather than overpower them. Higher cunning
means: repurpose traps (set them for monsters), improved stealth, smarter allies,
ability to manipulate monster behavior (lure, distract, pit against each other). A
high-cunning character wins by making the dungeon fight itself.

**Resonance** — connection to the dungeon's magical systems. Higher resonance means:
scrolls/potions are more effective, detect hidden things earlier, vault mechanisms
respond, staff recharge faster. A high-resonance character is a "knowledge mage"
whose consumables are devastating.

**Presence** — ability to lead. Higher presence means: more ally slots, allies gain
buffs, freed creatures more likely to join, colony is more effective. A high-presence
character is a warlord who descends with a squad.

**How it grows:** This stat should grow from *choices*, not from finding potions.
Every time you free an ally instead of killing them, solve a vault puzzle instead of
brute-forcing it, use terrain instead of weapons — the stat increases. Your
playstyle shapes your character, not random drops. This is very FromSoft: the game
watches how you play and rewards you for it.

**What this enables:** Three viable character archetypes emerge organically:
1. **Warrior** — traditional Brogue: strength + enchanted weapon, fight everything
2. **Sage** — resonance + consumable mastery, solve everything
3. **Commander** — presence + allies, delegate everything

A given run might blend these based on what the player finds and how they play.
The archetypes are not classes chosen at the start — they're identities that emerge
from play.

---

### M7. Food Reimagined — Ascent Cost, Not Survival Timer

**Combines:** Respect Player's Time + Intentional Friction + Item Economy

Food is not needed to go down. Descending is free — gravity, desperation, adventure.
Food IS needed to go back up. Ascending costs energy: climbing, carrying loot,
escorting allies.

**What this changes:**
- **No time pressure going down** — explore freely, camp if you want, take your time
  with tactical decisions. The hunger clock's anti-camping function is replaced by
  the natural danger of the dungeon itself.
- **Ascending is a logistics decision** — each food unit lets you ascend one depth.
  Carrying more food means carrying fewer items. You have 4 food and 6 items worth
  bringing back — what do you leave behind?
- **Bonfire-caching interacts with food** — if you can't afford to ascend with all
  your loot, you can cache it at a bonfire and come back with more food next run.
- **Colony creates food demand** — deeper runs require more food to return from. The
  colony's farm produces food, creating a supply loop: farm grows food → player
  descends with food → player brings back resources → colony grows → farm produces
  more food.

**What this avoids:** The "you starve in 800 turns" countdown, which is Brogue's
most divisive feature. It replaces a blunt survival timer with a logistics resource
that creates the same forward-pressure effect through a more organic mechanism. You
don't die from standing still — you run out of supplies to carry your treasure home.

**Edge case — dying deep:** If you die on depth 20, you've "spent" 20 food descending
(free) but the cache mechanic means your items aren't totally lost. A future run
descends for free to depth 20, retrieves the cache, but needs 20 food to bring it
all the way up. This creates a natural "expedition planning" layer: deep recovery
missions need significant food investment.

---

### M8. Expanded Map / Two-Layer World

**Combines:** Base Building + Creature Ecology + Exploration Pillar

The game world has two layers: a surface settlement (colony sim) and the underground
dungeon (roguelike). They feel different spatially and tonally.

**Surface:** Wider, more open, well-lit. You can see your buildings, watch colonists
move, plan construction. The mood is safety-with-responsibility. This is where you
prepare, plan, and manage.

**Underground:** Tight, claustrophobic, dangerous. Brogue's current 79x29 viewport
may be exactly right. The mood is tension-and-discovery. This is where you execute,
survive, and acquire.

**The contrast reinforces both:** Returning to the sunlit colony after a harrowing
descent creates relief. Descending back into the dark after peaceful colony
management creates dread. The emotional rhythm of alternating between safety and
danger is one of Dark Souls' greatest strengths (Firelink Shrine → anywhere else).

**Map size question:** The underground map doesn't necessarily need to be bigger.
Brogue's density is one of its strengths — every tile matters. Bigger maps risk
diluting encounter density and creating empty space. However, optional "wide"
depths (large caverns, underground lakes) could provide variety without becoming
the norm.

The surface map can be larger because it serves a different purpose — spatial
planning for building placement, not tactical combat navigation.

---

### M9. Incursion Defense / Colony Threat

**Combines:** Multi-Vector Threat + Colony Management + Mastery-Based Difficulty

The dungeon doesn't passively wait to be conquered. Periodically, creatures from
below mount incursions against secured territory and the surface colony. This
prevents the colony from becoming a pure safe zone and creates a "defend what
you've built" tension.

**Incursion triggers:**
- Time-based — every N runs, an incursion occurs regardless
- Depth-based — locking deeper stairs provokes stronger incursions
- Event-based — certain dungeon actions (killing a boss, disturbing a vault) anger
  the depths

**Defense options:**
- Colony defenses (walls, traps, guard NPCs) handle minor incursions automatically
- Major incursions require the player to return and fight — a "boss defense" event
- Ally equipment and colony upgrades affect defense capability
- Losing a defense can "unlock" secured depths, pushing the frontier back — real
  consequences for neglecting colony defenses

**What this avoids:** The defense shouldn't become a tower-defense minigame or a
mandatory chore. It should be rare enough to be an event, consequential enough to
demand attention, and solvable through the same tactical combat that makes the
dungeon fun.

---

*Relationship between mashup concepts:*

```
Surface Colony (M3) ←→ Item Economy (M4)
     ↕                      ↕
Food as Ascent Cost (M7) ←→ Bonfire Cache (M1)
     ↕                      ↕
Secured Depths (M2) ←→ Incursion Defense (M9)
     ↕                      ↕
Third Stat (M6) ←→ Alchemy/Combination (M5)
     ↕
Two-Layer World (M8)
```

Each concept reinforces the others. The colony needs items (M4) which need food
to transport (M7). The bonfire (M1) provides a safety valve when food runs out.
Secured depths (M2) enable the colony (M3) but invite incursions (M9). The third
stat (M6) makes non-combat approaches viable, which interacts with alchemy (M5)
and ally management (M3). The two-layer world (M8) gives everything physical space.

---

## Reference Games

### Roguelikes & Roguelites (Most Relevant)
| Game | Why It's Relevant |
|---|---|
| **Caves of Qud** | Rich lore, creature ecology, mutations as build-crafting, living world simulation. The closest to "Brogue + environmental storytelling + build depth." |
| **DCSS** | Streamlined roguelike design, species/god synergies, "deaths are avoidable" philosophy. |
| **Cogmind** | Part-swapping as build system, tactical combat, curated loot. Extremely polished. |
| **KeeperRL** | Roguelike + dungeon management. The best existing example of "Brogue meets Dwarf Fortress." |
| **Slay the Spire** | Gold standard for combinatorial build systems in a roguelike structure. |
| **Hades** | Gold standard for roguelite meta-progression and NPC relationships. |
| **Dead Cells** | Soulslike melee combat in a roguelite. Meta-progression done well. |
| **Into the Breach** | Perfect-information tactical roguelike. Mastery-based difficulty. |
| **Spelunky 1 & 2** | Emergent systems, knowledge-based mastery, tight run loop. |
| **Noita** | Physics-driven emergent gameplay, hidden lore, experimental discovery. |
| **ToME** | Deep build crafting, Adventure mode (limited lives), long roguelike tradition. |
| **Shattered Pixel Dungeon** | Mobile roguelike clearly inspired by Brogue. Build variety, quick runs. |
| **Jupiter Hell** | Turn-based tactical roguelike with build diversity, satisfying combat feel. |
| **Cataclysm: DDA** | Deep crafting system, living world simulation, survival mechanics. |

### Non-Roguelikes (Design Reference)
| Game | Relevant Features |
|---|---|
| **Elden Ring / Dark Souls** | Opinionated design, risk-reward rest, mastery difficulty, environmental storytelling, frictionless inventory |
| **Hollow Knight** | Benches (rest-with-cost), environmental lore, mastery combat, interconnected world |
| **Outer Wilds** | Exploration as the entire game, discovery-based knowledge, time loop as meta-structure |
| **Rimworld** | Colony management, autonomous NPCs, multi-vector threats, storyteller AI |
| **Factorio** | Production chains, blueprint systems, automation, infinite scaling |
| **Dwarf Fortress** | World simulation, material taxonomy, emergent narrative, base building |
| **Zelda: BotW/TotK** | Exploration reward, physics-driven systems, experimental crafting |
| **Monster Hunter** | Creature ecology, equipment-based builds, mastery combat, material progression |
| **Subnautica** | Exploration, base building, crafting progression, environmental storytelling, existential threat |
| **Moonlighter** | Dungeon crawl + shop management hybrid. Interesting bridge between roguelike and trade economy. |
| **Kenshi** | Living world simulation, squad management, emergent narrative |

---

*Last updated: 2026-03-25 — Added mashup concepts (M1–M9) and unified vision*
*Next step: Prioritize features, assess practicality, identify conflicts between aspirational features*
