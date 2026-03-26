/*
 *  debug-state.ts — React state bridge for spriteDebug singleton
 *  dungeon-cake
 *
 *  Manages per-layer visibility toggles in React and syncs them to the
 *  spriteDebug singleton consumed by SpriteRenderer. Exposes a redraw
 *  counter that canvas components can depend on to re-render.
 *
 *  Phase 1b: visibility toggles only. Phase 2 adds tint/alpha/blend.
 */

import { useReducer, useCallback, useEffect } from "react";
import { spriteDebug, LAYER_NAMES } from "@game/platform/sprite-debug.js";
import { RENDER_LAYER_COUNT } from "@game/platform/render-layers.js";

export { LAYER_NAMES };

export interface DebugState {
    enabled: boolean;
    layerVisible: boolean[];
    redrawCounter: number;
}

type DebugAction =
    | { type: "enable" }
    | { type: "disable" }
    | { type: "toggle-layer"; index: number }
    | { type: "set-layer-visible"; index: number; visible: boolean }
    | { type: "reset" };

function initialState(): DebugState {
    return {
        enabled: false,
        layerVisible: new Array(RENDER_LAYER_COUNT).fill(true),
        redrawCounter: 0,
    };
}

function syncToSingleton(state: DebugState): void {
    spriteDebug.enabled = state.enabled;
    for (let i = 0; i < RENDER_LAYER_COUNT; i++) {
        spriteDebug.layers[i].visible = state.layerVisible[i];
    }
    spriteDebug.dirty = true;
}

function reducer(state: DebugState, action: DebugAction): DebugState {
    switch (action.type) {
        case "enable":
            return { ...state, enabled: true, redrawCounter: state.redrawCounter + 1 };
        case "disable":
            return { ...state, enabled: false, redrawCounter: state.redrawCounter + 1 };
        case "toggle-layer": {
            const vis = [...state.layerVisible];
            vis[action.index] = !vis[action.index];
            return { ...state, layerVisible: vis, redrawCounter: state.redrawCounter + 1 };
        }
        case "set-layer-visible": {
            const vis = [...state.layerVisible];
            vis[action.index] = action.visible;
            return { ...state, layerVisible: vis, redrawCounter: state.redrawCounter + 1 };
        }
        case "reset":
            return { ...initialState(), enabled: state.enabled, redrawCounter: state.redrawCounter + 1 };
    }
}

export function useDebugState() {
    const [state, dispatch] = useReducer(reducer, undefined, initialState);

    useEffect(() => {
        syncToSingleton(state);
    }, [state]);

    const toggleLayer = useCallback((index: number) => {
        dispatch({ type: "toggle-layer", index });
    }, []);

    const setEnabled = useCallback((enabled: boolean) => {
        dispatch({ type: enabled ? "enable" : "disable" });
    }, []);

    const reset = useCallback(() => {
        dispatch({ type: "reset" });
    }, []);

    return { state, toggleLayer, setEnabled, reset };
}
