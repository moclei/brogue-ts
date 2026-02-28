/*
 *  brogue-ts
 *  TypeScript port of Brogue: Community Edition
 *
 *  Copyright 2025. All rights reserved.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 *  You should have received a copy of the GNU Affero General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

// Top-level barrel exports for brogue-ts.
//
// Due to name collisions across modules (many modules re-export helpers from
// each other), we avoid blanket `export *` and instead re-export the primary
// entry points for each module. Consumers should import from sub-module
// barrels (e.g. `brogue-ts/io`, `brogue-ts/game`) for full access.
//
// ── Foundation ──────────────────────────────────────────────────────────────
export * from "./types/index.js";
export * from "./math/index.js";
export * from "./recordings/index.js";

// ── Re-export key module barrels as namespaces ──────────────────────────────
// These are available for consumers who want grouped access.

export * as globals from "./globals/index.js";
export * as grid from "./grid/index.js";
export * as power from "./power/index.js";
export * as state from "./state/index.js";
export * as dijkstra from "./dijkstra/index.js";
export * as light from "./light/index.js";
export * as architect from "./architect/index.js";
export * as items from "./items/index.js";
export * as monsters from "./monsters/index.js";
export * as combat from "./combat/index.js";
export * as movement from "./movement/index.js";
export * as time from "./time/index.js";
export * as io from "./io/index.js";
export * as menus from "./menus/index.js";
export * as game from "./game/index.js";
export * as platform from "./platform/index.js";
