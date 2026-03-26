/*
 *  debug-state.ts — React state bridge for spriteDebug singleton
 *  dungeon-cake
 *
 *  Manages per-layer debug overrides in React and syncs them to the
 *  spriteDebug singleton consumed by SpriteRenderer. Exposes a redraw
 *  counter that canvas components can depend on to re-render.
 */

import { useReducer, useCallback, useEffect } from "react";
import { spriteDebug, LAYER_NAMES } from "@game/platform/sprite-debug.js";
import type { BlendMode } from "@game/platform/sprite-debug.js";
import { RENDER_LAYER_COUNT } from "@game/platform/render-layers.js";

export { LAYER_NAMES };
export type { BlendMode };

export const ALL_BLEND_MODES: BlendMode[] = [
    "none", "multiply", "source-over", "screen", "overlay", "color-dodge", "color-burn",
];

export interface TintState {
    enabled: boolean;
    color: string;   // hex "#rrggbb"
    alpha: number;    // 0–1
}

export interface LayerState {
    visible: boolean;
    tint: TintState;
    alpha: number | null;     // null = no override, 0–1 = override
    blendMode: BlendMode | null;
}

export interface DebugState {
    enabled: boolean;
    layers: LayerState[];
    bgColorOverride: string | null;  // hex or null
    redrawCounter: number;
}

type DebugAction =
    | { type: "enable" }
    | { type: "disable" }
    | { type: "toggle-layer"; index: number }
    | { type: "set-layer-visible"; index: number; visible: boolean }
    | { type: "set-tint-enabled"; index: number; enabled: boolean }
    | { type: "set-tint-color"; index: number; color: string }
    | { type: "set-tint-alpha"; index: number; alpha: number }
    | { type: "set-alpha"; index: number; alpha: number | null }
    | { type: "set-blend-mode"; index: number; mode: BlendMode | null }
    | { type: "set-bg-color"; color: string | null }
    | { type: "reset" };

function defaultLayerState(): LayerState {
    return {
        visible: true,
        tint: { enabled: false, color: "#ffffff", alpha: 1.0 },
        alpha: null,
        blendMode: null,
    };
}

function initialState(): DebugState {
    const layers: LayerState[] = [];
    for (let i = 0; i < RENDER_LAYER_COUNT; i++) {
        layers.push(defaultLayerState());
    }
    return { enabled: false, layers, bgColorOverride: null, redrawCounter: 0 };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const n = parseInt(hex.replace("#", ""), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function syncToSingleton(state: DebugState): void {
    spriteDebug.enabled = state.enabled;
    for (let i = 0; i < RENDER_LAYER_COUNT; i++) {
        const ls = state.layers[i];
        const lo = spriteDebug.layers[i];
        lo.visible = ls.visible;

        if (ls.tint.enabled) {
            const rgb = hexToRgb(ls.tint.color);
            lo.tintOverride = { ...rgb, a: ls.tint.alpha };
        } else {
            lo.tintOverride = null;
        }

        lo.alphaOverride = ls.alpha;
        lo.blendMode = ls.blendMode;
    }

    if (state.bgColorOverride) {
        spriteDebug.bgColorOverride = hexToRgb(state.bgColorOverride);
    } else {
        spriteDebug.bgColorOverride = null;
    }

    spriteDebug.dirty = true;
}

function updateLayer(state: DebugState, index: number, patch: Partial<LayerState>): DebugState {
    const layers = [...state.layers];
    layers[index] = { ...layers[index], ...patch };
    return { ...state, layers, redrawCounter: state.redrawCounter + 1 };
}

function reducer(state: DebugState, action: DebugAction): DebugState {
    switch (action.type) {
        case "enable":
            return { ...state, enabled: true, redrawCounter: state.redrawCounter + 1 };
        case "disable":
            return { ...state, enabled: false, redrawCounter: state.redrawCounter + 1 };
        case "toggle-layer": {
            const ls = state.layers[action.index];
            return updateLayer(state, action.index, { visible: !ls.visible });
        }
        case "set-layer-visible":
            return updateLayer(state, action.index, { visible: action.visible });
        case "set-tint-enabled": {
            const ls = state.layers[action.index];
            return updateLayer(state, action.index, {
                tint: { ...ls.tint, enabled: action.enabled },
            });
        }
        case "set-tint-color": {
            const ls = state.layers[action.index];
            return updateLayer(state, action.index, {
                tint: { ...ls.tint, color: action.color },
            });
        }
        case "set-tint-alpha": {
            const ls = state.layers[action.index];
            return updateLayer(state, action.index, {
                tint: { ...ls.tint, alpha: action.alpha },
            });
        }
        case "set-alpha":
            return updateLayer(state, action.index, { alpha: action.alpha });
        case "set-blend-mode":
            return updateLayer(state, action.index, { blendMode: action.mode });
        case "set-bg-color":
            return { ...state, bgColorOverride: action.color, redrawCounter: state.redrawCounter + 1 };
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

    const setTintEnabled = useCallback((index: number, enabled: boolean) => {
        dispatch({ type: "set-tint-enabled", index, enabled });
    }, []);

    const setTintColor = useCallback((index: number, color: string) => {
        dispatch({ type: "set-tint-color", index, color });
    }, []);

    const setTintAlpha = useCallback((index: number, alpha: number) => {
        dispatch({ type: "set-tint-alpha", index, alpha });
    }, []);

    const setAlpha = useCallback((index: number, alpha: number | null) => {
        dispatch({ type: "set-alpha", index, alpha });
    }, []);

    const setBlendMode = useCallback((index: number, mode: BlendMode | null) => {
        dispatch({ type: "set-blend-mode", index, mode });
    }, []);

    const setBgColor = useCallback((color: string | null) => {
        dispatch({ type: "set-bg-color", color });
    }, []);

    const reset = useCallback(() => {
        dispatch({ type: "reset" });
    }, []);

    return {
        state,
        toggleLayer,
        setEnabled,
        setTintEnabled,
        setTintColor,
        setTintAlpha,
        setAlpha,
        setBlendMode,
        setBgColor,
        reset,
    };
}
