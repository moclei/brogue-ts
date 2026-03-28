/*
 *  game-debug-panel.ts — In-game cheat/debug panel (F2 toggle)
 *  Port V2 — rogue-ts
 *
 *  Floating HTML panel with three controls:
 *    1. Invincibility toggle — persists while panel is closed
 *    2. Depth jump — teleport to any dungeon level 1-40
 *    3. Give item — category + kind dropdowns → add to inventory
 */

import { getGameState } from "../core.js";
import { startLevel } from "../lifecycle.js";
import { debugFlags } from "../game/game-init.js";
import { generateItem } from "../items/item-generation.js";
import { addItemToPack } from "../items/item-inventory.js";
import { buildDebugItemContext } from "../lifecycle-debug.js";
import { forceFullRedraw } from "../platform.js";
import {
    ItemCategory,
    WeaponKind, ArmorKind, FoodKind, PotionKind,
    ScrollKind, StaffKind, WandKind, RingKind, CharmKind,
} from "../types/enums.js";

// =============================================================================
// Item kind data for dropdowns
// =============================================================================

interface KindEntry { kind: number; name: string }
interface CategoryEntry { category: number; label: string; kinds: KindEntry[] }

const ITEM_CATEGORIES: CategoryEntry[] = [
    {
        category: ItemCategory.FOOD, label: "Food",
        kinds: [
            { kind: FoodKind.Ration, name: "Ration" },
            { kind: FoodKind.Fruit,  name: "Mango" },
        ],
    },
    {
        category: ItemCategory.WEAPON, label: "Weapon",
        kinds: [
            { kind: WeaponKind.Dagger,         name: "Dagger" },
            { kind: WeaponKind.Sword,           name: "Sword" },
            { kind: WeaponKind.Broadsword,      name: "Broadsword" },
            { kind: WeaponKind.Whip,            name: "Whip" },
            { kind: WeaponKind.Rapier,          name: "Rapier" },
            { kind: WeaponKind.Flail,           name: "Flail" },
            { kind: WeaponKind.Mace,            name: "Mace" },
            { kind: WeaponKind.Hammer,          name: "Hammer" },
            { kind: WeaponKind.Spear,           name: "Spear" },
            { kind: WeaponKind.Pike,            name: "Pike" },
            { kind: WeaponKind.Axe,             name: "Axe" },
            { kind: WeaponKind.WarAxe,          name: "War Axe" },
            { kind: WeaponKind.Dart,            name: "Dart" },
            { kind: WeaponKind.IncendiaryDart,  name: "Incendiary Dart" },
            { kind: WeaponKind.Javelin,         name: "Javelin" },
        ],
    },
    {
        category: ItemCategory.ARMOR, label: "Armor",
        kinds: [
            { kind: ArmorKind.LeatherArmor, name: "Leather Armor" },
            { kind: ArmorKind.ScaleMail,    name: "Scale Mail" },
            { kind: ArmorKind.ChainMail,    name: "Chain Mail" },
            { kind: ArmorKind.BandedMail,   name: "Banded Mail" },
            { kind: ArmorKind.SplintMail,   name: "Splint Mail" },
            { kind: ArmorKind.PlateMail,    name: "Plate Mail" },
        ],
    },
    {
        category: ItemCategory.POTION, label: "Potion",
        kinds: [
            { kind: PotionKind.Life,           name: "Life" },
            { kind: PotionKind.Strength,       name: "Strength" },
            { kind: PotionKind.Telepathy,      name: "Telepathy" },
            { kind: PotionKind.Levitation,     name: "Levitation" },
            { kind: PotionKind.DetectMagic,    name: "Detect Magic" },
            { kind: PotionKind.HasteSelf,      name: "Speed" },
            { kind: PotionKind.FireImmunity,   name: "Fire Immunity" },
            { kind: PotionKind.Invisibility,   name: "Invisibility" },
            { kind: PotionKind.Poison,         name: "Poison" },
            { kind: PotionKind.Paralysis,      name: "Paralysis" },
            { kind: PotionKind.Hallucination,  name: "Hallucination" },
            { kind: PotionKind.Confusion,      name: "Confusion" },
            { kind: PotionKind.Incineration,   name: "Incineration" },
            { kind: PotionKind.Darkness,       name: "Darkness" },
            { kind: PotionKind.Descent,        name: "Descent" },
            { kind: PotionKind.Lichen,         name: "Lichen" },
        ],
    },
    {
        category: ItemCategory.SCROLL, label: "Scroll",
        kinds: [
            { kind: ScrollKind.Enchanting,       name: "Enchanting" },
            { kind: ScrollKind.Identify,         name: "Identify" },
            { kind: ScrollKind.Teleport,         name: "Teleport" },
            { kind: ScrollKind.RemoveCurse,      name: "Remove Curse" },
            { kind: ScrollKind.Recharging,       name: "Recharging" },
            { kind: ScrollKind.ProtectArmor,     name: "Protect Armor" },
            { kind: ScrollKind.ProtectWeapon,    name: "Protect Weapon" },
            { kind: ScrollKind.Sanctuary,        name: "Sanctuary" },
            { kind: ScrollKind.MagicMapping,     name: "Magic Mapping" },
            { kind: ScrollKind.Negation,         name: "Negation" },
            { kind: ScrollKind.Shattering,       name: "Shattering" },
            { kind: ScrollKind.Discord,          name: "Discord" },
            { kind: ScrollKind.AggravateMonster, name: "Aggravate Monster" },
            { kind: ScrollKind.SummonMonster,    name: "Summon Monster" },
        ],
    },
    {
        category: ItemCategory.STAFF, label: "Staff",
        kinds: [
            { kind: StaffKind.Lightning,    name: "Lightning" },
            { kind: StaffKind.Fire,         name: "Fire" },
            { kind: StaffKind.Poison,       name: "Poison" },
            { kind: StaffKind.Tunneling,    name: "Tunneling" },
            { kind: StaffKind.Blinking,     name: "Blinking" },
            { kind: StaffKind.Entrancement, name: "Entrancement" },
            { kind: StaffKind.Obstruction,  name: "Obstruction" },
            { kind: StaffKind.Discord,      name: "Discord" },
            { kind: StaffKind.Conjuration,  name: "Conjuration" },
            { kind: StaffKind.Healing,      name: "Healing" },
            { kind: StaffKind.Haste,        name: "Haste" },
            { kind: StaffKind.Protection,   name: "Protection" },
        ],
    },
    {
        category: ItemCategory.WAND, label: "Wand",
        kinds: [
            { kind: WandKind.Teleport,      name: "Teleport" },
            { kind: WandKind.Slow,          name: "Slow" },
            { kind: WandKind.Polymorph,     name: "Polymorph" },
            { kind: WandKind.Negation,      name: "Negation" },
            { kind: WandKind.Domination,    name: "Domination" },
            { kind: WandKind.Beckoning,     name: "Beckoning" },
            { kind: WandKind.Plenty,        name: "Plenty" },
            { kind: WandKind.Invisibility,  name: "Invisibility" },
            { kind: WandKind.Empowerment,   name: "Empowerment" },
        ],
    },
    {
        category: ItemCategory.RING, label: "Ring",
        kinds: [
            { kind: RingKind.Clairvoyance, name: "Clairvoyance" },
            { kind: RingKind.Stealth,      name: "Stealth" },
            { kind: RingKind.Regeneration, name: "Regeneration" },
            { kind: RingKind.Transference, name: "Transference" },
            { kind: RingKind.Light,        name: "Light" },
            { kind: RingKind.Awareness,    name: "Awareness" },
            { kind: RingKind.Wisdom,       name: "Wisdom" },
            { kind: RingKind.Reaping,      name: "Reaping" },
        ],
    },
    {
        category: ItemCategory.CHARM, label: "Charm",
        kinds: [
            { kind: CharmKind.Health,        name: "Health" },
            { kind: CharmKind.Protection,    name: "Protection" },
            { kind: CharmKind.Haste,         name: "Haste" },
            { kind: CharmKind.FireImmunity,  name: "Fire Immunity" },
            { kind: CharmKind.Invisibility,  name: "Invisibility" },
            { kind: CharmKind.Telepathy,     name: "Telepathy" },
            { kind: CharmKind.Levitation,    name: "Levitation" },
            { kind: CharmKind.Shattering,    name: "Shattering" },
            { kind: CharmKind.Guardian,      name: "Guardian" },
            { kind: CharmKind.Teleportation, name: "Teleportation" },
            { kind: CharmKind.Recharging,    name: "Recharging" },
            { kind: CharmKind.Negation,      name: "Negation" },
        ],
    },
];

// =============================================================================
// Panel state
// =============================================================================

let panelEl: HTMLElement | null = null;
let immortalCheckbox: HTMLInputElement | null = null;
let statusMsg: HTMLElement | null = null;

// =============================================================================
// Public API
// =============================================================================

/** Toggle the cheat panel open/closed. Called from the F2 key handler. */
export function toggleCheatPanel(parentEl: HTMLElement): void {
    if (panelEl) {
        const visible = panelEl.style.display !== "none";
        panelEl.style.display = visible ? "none" : "block";
        if (!visible && immortalCheckbox) {
            // Sync checkbox to current state when reopening
            immortalCheckbox.checked = debugFlags.immortal;
        }
        return;
    }
    buildPanel(parentEl);
}

// =============================================================================
// Panel construction
// =============================================================================

function section(title: string): HTMLElement {
    const el = document.createElement("div");
    el.style.cssText = "margin-top:10px;padding-top:8px;border-top:1px solid #2a2a3a;";
    const heading = document.createElement("div");
    heading.textContent = title;
    heading.style.cssText = "font-size:10px;text-transform:uppercase;letter-spacing:0.08em;" +
        "color:#888;margin-bottom:6px;";
    el.appendChild(heading);
    return el;
}

function row(...children: HTMLElement[]): HTMLElement {
    const el = document.createElement("div");
    el.style.cssText = "display:flex;align-items:center;gap:6px;margin-bottom:4px;";
    children.forEach(c => el.appendChild(c));
    return el;
}

function selectEl(options: Array<{ value: string; label: string }>): HTMLSelectElement {
    const sel = document.createElement("select");
    sel.style.cssText =
        "background:#1a1a28;color:#ccc;border:1px solid #444;border-radius:3px;" +
        "padding:2px 4px;font-size:11px;cursor:pointer;flex:1;";
    options.forEach(({ value, label }) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = label;
        sel.appendChild(opt);
    });
    return sel;
}

function btn(label: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement("button");
    b.textContent = label;
    b.style.cssText =
        "background:#2a4a7a;color:#cff;border:1px solid #4a6a9a;border-radius:3px;" +
        "padding:3px 8px;font-size:11px;cursor:pointer;white-space:nowrap;";
    b.addEventListener("click", onClick);
    return b;
}

function buildPanel(parentEl: HTMLElement): void {
    panelEl = document.createElement("div");
    panelEl.style.cssText =
        "position:absolute;top:8px;right:8px;z-index:9999;" +
        "background:rgba(12,12,20,0.95);border:1px solid #3a3a5a;border-radius:6px;" +
        "padding:10px 12px;color:#ddd;font-family:system-ui,sans-serif;" +
        "font-size:12px;pointer-events:auto;user-select:none;min-width:220px;" +
        "box-shadow:0 4px 20px rgba(0,0,0,0.7);";

    // --- Header ---------------------------------------------------------------
    const header = document.createElement("div");
    header.style.cssText =
        "display:flex;justify-content:space-between;align-items:center;" +
        "margin-bottom:8px;border-bottom:1px solid #2a2a3a;padding-bottom:6px;";
    const title = document.createElement("span");
    title.textContent = "Debug Panel";
    title.style.cssText = "font-weight:600;font-size:13px;color:#6cf;";
    header.appendChild(title);
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.style.cssText =
        "background:none;border:none;color:#888;font-size:16px;cursor:pointer;padding:0 4px;";
    closeBtn.addEventListener("click", () => {
        if (panelEl) panelEl.style.display = "none";
    });
    header.appendChild(closeBtn);
    panelEl.appendChild(header);

    // --- Section 1: Invincibility --------------------------------------------
    const invSection = section("Player");
    const invRow = row();
    immortalCheckbox = document.createElement("input");
    immortalCheckbox.type = "checkbox";
    immortalCheckbox.checked = debugFlags.immortal;
    immortalCheckbox.style.cssText = "cursor:pointer;accent-color:#4cf;";
    immortalCheckbox.addEventListener("change", () => {
        debugFlags.immortal = immortalCheckbox!.checked;
    });
    const invLabel = document.createElement("label");
    invLabel.textContent = "Invincible";
    invLabel.style.cssText = "cursor:pointer;";
    invLabel.addEventListener("click", () => {
        immortalCheckbox!.checked = !immortalCheckbox!.checked;
        debugFlags.immortal = immortalCheckbox!.checked;
    });
    invRow.appendChild(immortalCheckbox);
    invRow.appendChild(invLabel);
    invSection.appendChild(invRow);
    panelEl.appendChild(invSection);

    // --- Section 2: Depth Jump -----------------------------------------------
    const depthSection = section("Depth");
    const depthRow = row();
    const depthInput = document.createElement("input");
    depthInput.type = "number";
    depthInput.min = "1";
    depthInput.max = "40";
    depthInput.value = "1";
    depthInput.style.cssText =
        "width:48px;background:#1a1a28;color:#ccc;border:1px solid #444;" +
        "border-radius:3px;padding:2px 4px;font-size:11px;text-align:center;";
    const jumpBtn = btn("Jump", () => {
        const target = Math.max(1, Math.min(40, parseInt(depthInput.value, 10) || 1));
        depthInput.value = String(target);
        const state = getGameState();
        const oldDepth = state.rogue.depthLevel;
        if (oldDepth === target) return;
        state.rogue.depthLevel = target;
        startLevel(oldDepth, target > oldDepth ? 1 : -1);
        forceFullRedraw();
    });
    depthRow.appendChild(depthInput);
    depthRow.appendChild(jumpBtn);
    const depthHint = document.createElement("div");
    depthHint.textContent = "Use between turns";
    depthHint.style.cssText = "font-size:9px;color:#666;margin-top:2px;font-style:italic;";
    depthSection.appendChild(depthRow);
    depthSection.appendChild(depthHint);
    panelEl.appendChild(depthSection);

    // --- Section 3: Give Item ------------------------------------------------
    const itemSection = section("Give Item");

    // Category dropdown
    const catSel = selectEl(ITEM_CATEGORIES.map(c => ({ value: String(c.category), label: c.label })));

    // Kind dropdown — repopulates when category changes
    const kindSel = selectEl([]);
    function populateKinds(): void {
        const catVal = parseInt(catSel.value, 10);
        const entry = ITEM_CATEGORIES.find(c => c.category === catVal);
        kindSel.innerHTML = "";
        (entry?.kinds ?? []).forEach(({ kind, name }) => {
            const opt = document.createElement("option");
            opt.value = String(kind);
            opt.textContent = name;
            kindSel.appendChild(opt);
        });
    }
    populateKinds();
    catSel.addEventListener("change", populateKinds);

    // Status message
    statusMsg = document.createElement("div");
    statusMsg.style.cssText =
        "font-size:10px;color:#8f8;margin-top:4px;min-height:14px;";

    const giveBtn = btn("Give", () => {
        const category = parseInt(catSel.value, 10);
        const kind = parseInt(kindSel.value, 10);
        try {
            const state = getGameState();
            const ctx = buildDebugItemContext();
            const item = generateItem(category, kind, ctx);
            addItemToPack(item, state.packItems);
            forceFullRedraw();
            const catLabel = ITEM_CATEGORIES.find(c => c.category === category)?.label ?? "Item";
            const kindLabel = ITEM_CATEGORIES.find(c => c.category === category)
                ?.kinds.find(k => k.kind === kind)?.name ?? String(kind);
            if (statusMsg) statusMsg.textContent = `Gave: ${catLabel} of ${kindLabel}`;
        } catch (e) {
            if (statusMsg) statusMsg.textContent = `Error: ${String(e)}`;
        }
    });

    itemSection.appendChild(row(catSel));
    itemSection.appendChild(row(kindSel));
    itemSection.appendChild(row(giveBtn));
    itemSection.appendChild(statusMsg);
    panelEl.appendChild(itemSection);

    parentEl.appendChild(panelEl);
}
