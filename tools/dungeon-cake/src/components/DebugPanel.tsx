/*
 *  DebugPanel.tsx — Collapsible right-side panel with per-layer debug controls
 *  dungeon-cake
 */

import { type ReactNode, useState, useRef, useCallback, useEffect } from "react";
import type { LayerState, BlendMode } from "../state/debug-state.js";
import { LAYER_NAMES, LAYER_DEFAULT_BLEND_MODES, LAYER_DEFAULT_TINT_ALPHAS } from "../state/debug-state.js";
import { LayerColumn } from "./LayerColumn.js";

const STORAGE_KEY = "dungeon-cake:panel-width";
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 160;
const MAX_WIDTH = 500;

function loadWidth(): number {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        if (v) return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, parseInt(v, 10)));
    } catch { /* ignore */ }
    return DEFAULT_WIDTH;
}

interface DebugPanelProps {
    enabled: boolean;
    layers: LayerState[];
    onToggleLayer: (index: number) => void;
    onToggleEnabled: (enabled: boolean) => void;
    onAlpha: (index: number, alpha: number | null) => void;
    onBlendMode: (index: number, mode: BlendMode | null) => void;
    onTintAlpha: (index: number, alpha: number | null) => void;
    onFilter: (index: number, filter: string | null) => void;
    onShadowColor: (index: number, color: string | null) => void;
    onReset: () => void;
    children?: ReactNode;
}

export function DebugPanel({
    enabled,
    layers,
    onToggleLayer,
    onToggleEnabled,
    onAlpha,
    onBlendMode,
    onTintAlpha,
    onFilter,
    onShadowColor,
    onReset,
    children,
}: DebugPanelProps) {
    const [panelWidth, setPanelWidth] = useState(loadWidth);
    const dragging = useRef(false);
    const startX = useRef(0);
    const startW = useRef(0);

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        dragging.current = true;
        startX.current = e.clientX;
        startW.current = panelWidth;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, [panelWidth]);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (!dragging.current) return;
        const delta = startX.current - e.clientX;
        const newW = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startW.current + delta));
        setPanelWidth(newW);
    }, []);

    const onPointerUp = useCallback(() => {
        dragging.current = false;
    }, []);

    useEffect(() => {
        try { localStorage.setItem(STORAGE_KEY, String(panelWidth)); } catch { /* ignore */ }
    }, [panelWidth]);

    const widthStyle = enabled ? { width: panelWidth } : undefined;

    return (
        <div className={`debug-panel${enabled ? "" : " collapsed"}`} style={widthStyle}>
            {enabled && (
                <div
                    className="resize-handle"
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                />
            )}
            <div className="debug-header">
                <label className="debug-enable">
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => onToggleEnabled(e.target.checked)}
                    />
                    <span>Layers</span>
                </label>
                {enabled && (
                    <button className="debug-reset" onClick={onReset}>
                        Reset
                    </button>
                )}
            </div>
            {enabled && (
                <div className="debug-body">
                    <div className="layer-grid">
                        {LAYER_NAMES.map((name, i) => {
                            const layer = layers[i]!;
                            return (
                                <LayerColumn
                                    key={name}
                                    name={name}
                                    index={i}
                                    visible={layer.visible}
                                    alpha={layer.alpha}
                                    blendMode={layer.blendMode}
                                    defaultBlendMode={LAYER_DEFAULT_BLEND_MODES[i]!}
                                    tintAlpha={layer.tintAlpha}
                                    defaultTintAlpha={LAYER_DEFAULT_TINT_ALPHAS[i]!}
                                    filter={layer.filter}
                                    shadowColor={layer.shadowColor}
                                    onToggle={onToggleLayer}
                                    onAlpha={onAlpha}
                                    onBlendMode={onBlendMode}
                                    onTintAlpha={onTintAlpha}
                                    onFilter={onFilter}
                                    onShadowColor={onShadowColor}
                                />
                            );
                        })}
                    </div>
                    {children}
                </div>
            )}
        </div>
    );
}
