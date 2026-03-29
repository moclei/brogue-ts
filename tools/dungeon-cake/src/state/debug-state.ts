/*
 *  debug-state.ts — React state bridge for spriteDebug singleton
 *  dungeon-cake
 *
 *  Manages per-layer debug overrides in React and syncs them to the
 *  spriteDebug singleton consumed by SpriteRenderer. Exposes a redraw
 *  counter that canvas components can depend on to re-render.
 */

import { useReducer, useCallback, useEffect } from "react";
import { spriteDebug, LAYER_NAMES, ALL_BLEND_MODES } from "@game/platform/sprite-debug.js";
import type { BlendMode } from "@game/platform/sprite-debug.js";
import { RENDER_LAYER_COUNT } from "@game/platform/render-layers.js";
import {
    LAYER_DEFAULT_BLEND_MODES,
    LAYER_DEFAULT_TINT_ALPHAS,
} from "@game/platform/sprite-renderer.js";

export { LAYER_NAMES, LAYER_DEFAULT_BLEND_MODES, LAYER_DEFAULT_TINT_ALPHAS, ALL_BLEND_MODES };
export type { BlendMode };

export interface LayerState {
    visible: boolean;
    alpha: number | null;
    blendMode: BlendMode | null;
    tintAlpha: number | null;       // null = use LAYER_DEFAULT_TINT_ALPHAS[i]
    filter: string | null;
    shadowColor: string | null;
}

export interface DebugState {
    enabled: boolean;
    layers: LayerState[];
    bgColorOverride: string | null;
    showVariantIndices: boolean;
    redrawCounter: number;
}

type DebugAction =
    | { type: "enable" }
    | { type: "disable" }
    | { type: "toggle-layer"; index: number }
    | { type: "set-layer-visible"; index: number; visible: boolean }
    | { type: "set-alpha"; index: number; alpha: number | null }
    | { type: "set-blend-mode"; index: number; mode: BlendMode | null }
    | { type: "set-tint-alpha"; index: number; alpha: number | null }
    | { type: "set-filter"; index: number; filter: string | null }
    | { type: "set-shadow-color"; index: number; color: string | null }
    | { type: "set-bg-color"; color: string | null }
    | { type: "set-show-variant-indices"; enabled: boolean }
    | { type: "reset" };

function defaultLayerState(): LayerState {
    return {
        visible: true,
        alpha: null,
        blendMode: null,
        tintAlpha: null,
        filter: null,
        shadowColor: null,
    };
}

function initialState(): DebugState {
    const layers: LayerState[] = [];
    for (let i = 0; i < RENDER_LAYER_COUNT; i++) {
        layers.push(defaultLayerState());
    }
    return {
        enabled: true, layers, bgColorOverride: null,
        showVariantIndices: false, redrawCounter: 0,
    };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const n = parseInt(hex.replace("#", ""), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function syncToSingleton(state: DebugState): void {
    spriteDebug.enabled = state.enabled;
    for (let i = 0; i < RENDER_LAYER_COUNT; i++) {
        const ls = state.layers[i]!;
        const lo = spriteDebug.layers[i]!;
        lo.visible = ls.visible;
        lo.alphaOverride = ls.alpha;
        lo.blendMode = ls.blendMode;
        lo.tintAlphaOverride = ls.tintAlpha;
        lo.filterOverride = ls.filter;
        lo.shadowColor = ls.shadowColor;
    }

    if (state.bgColorOverride) {
        spriteDebug.bgColorOverride = hexToRgb(state.bgColorOverride);
    } else {
        spriteDebug.bgColorOverride = null;
    }

    spriteDebug.showVariantIndices = state.showVariantIndices;
    spriteDebug.dirty = true;
}

function updateLayer(state: DebugState, index: number, patch: Partial<LayerState>): DebugState {
    const layers = [...state.layers];
    layers[index] = { ...layers[index]!, ...patch };
    return { ...state, layers, redrawCounter: state.redrawCounter + 1 };
}

function reducer(state: DebugState, action: DebugAction): DebugState {
    switch (action.type) {
        case "enable":
            return { ...state, enabled: true, redrawCounter: state.redrawCounter + 1 };
        case "disable":
            return { ...state, enabled: false, redrawCounter: state.redrawCounter + 1 };
        case "toggle-layer": {
            const ls = state.layers[action.index]!;
            return updateLayer(state, action.index, { visible: !ls.visible });
        }
        case "set-layer-visible":
            return updateLayer(state, action.index, { visible: action.visible });
        case "set-alpha":
            return updateLayer(state, action.index, { alpha: action.alpha });
        case "set-blend-mode":
            return updateLayer(state, action.index, { blendMode: action.mode });
        case "set-tint-alpha":
            return updateLayer(state, action.index, { tintAlpha: action.alpha });
        case "set-filter":
            return updateLayer(state, action.index, { filter: action.filter });
        case "set-shadow-color":
            return updateLayer(state, action.index, { shadowColor: action.color });
        case "set-bg-color":
            return { ...state, bgColorOverride: action.color, redrawCounter: state.redrawCounter + 1 };
        case "set-show-variant-indices":
            return { ...state, showVariantIndices: action.enabled, redrawCounter: state.redrawCounter + 1 };
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

    const setAlpha = useCallback((index: number, alpha: number | null) => {
        dispatch({ type: "set-alpha", index, alpha });
    }, []);

    const setBlendMode = useCallback((index: number, mode: BlendMode | null) => {
        dispatch({ type: "set-blend-mode", index, mode });
    }, []);

    const setTintAlpha = useCallback((index: number, alpha: number | null) => {
        dispatch({ type: "set-tint-alpha", index, alpha });
    }, []);

    const setFilter = useCallback((index: number, filter: string | null) => {
        dispatch({ type: "set-filter", index, filter });
    }, []);

    const setShadowColor = useCallback((index: number, color: string | null) => {
        dispatch({ type: "set-shadow-color", index, color });
    }, []);

    const setBgColor = useCallback((color: string | null) => {
        dispatch({ type: "set-bg-color", color });
    }, []);

    const setShowVariantIndices = useCallback((enabled: boolean) => {
        dispatch({ type: "set-show-variant-indices", enabled });
    }, []);

    const reset = useCallback(() => {
        dispatch({ type: "reset" });
    }, []);

    return {
        state,
        toggleLayer,
        setEnabled,
        setAlpha,
        setBlendMode,
        setTintAlpha,
        setFilter,
        setShadowColor,
        setBgColor,
        setShowVariantIndices,
        reset,
    };
}
