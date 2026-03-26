/*
 *  dungeon-state.ts — React context for generated dungeon state
 *  dungeon-cake
 */

import { createContext, useContext } from "react";
import type { Pcell } from "@game/types/types.js";

export interface DungeonState {
    pmap: Pcell[][] | null;
    depth: number;
    seed: number;
}

export interface DungeonActions {
    generate: (depth: number, seed: number) => void;
    reroll: () => void;
}

export const DungeonStateContext = createContext<DungeonState>({
    pmap: null,
    depth: 5,
    seed: 42,
});

export const DungeonActionsContext = createContext<DungeonActions>({
    generate: () => {},
    reroll: () => {},
});

export function useDungeonState() {
    return useContext(DungeonStateContext);
}

export function useDungeonActions() {
    return useContext(DungeonActionsContext);
}
