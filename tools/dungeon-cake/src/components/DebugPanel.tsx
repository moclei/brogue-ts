/*
 *  DebugPanel.tsx — Resizable bottom panel with per-layer debug controls
 *  dungeon-cake
 */

import { type ReactNode, useState, useRef, useCallback, useEffect } from "react";
import type { LayerState, BlendMode } from "../state/debug-state.js";
import { LAYER_NAMES } from "../state/debug-state.js";
import { LayerColumn } from "./LayerColumn.js";

const STORAGE_KEY = "dungeon-cake:panel-height";
const DEFAULT_HEIGHT = 180;
const MIN_HEIGHT = 48;
const MAX_HEIGHT = 600;

function loadHeight(): number {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        if (v) return Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, parseInt(v, 10)));
    } catch { /* ignore */ }
    return DEFAULT_HEIGHT;
}

interface DebugPanelProps {
    enabled: boolean;
    layers: LayerState[];
    onToggleLayer: (index: number) => void;
    onToggleEnabled: (enabled: boolean) => void;
    onTintEnabled: (index: number, enabled: boolean) => void;
    onTintColor: (index: number, color: string) => void;
    onTintAlpha: (index: number, alpha: number) => void;
    onAlpha: (index: number, alpha: number | null) => void;
    onBlendMode: (index: number, mode: BlendMode | null) => void;
    onReset: () => void;
    children?: ReactNode;
}

export function DebugPanel({
    enabled,
    layers,
    onToggleLayer,
    onToggleEnabled,
    onTintEnabled,
    onTintColor,
    onTintAlpha,
    onAlpha,
    onBlendMode,
    onReset,
    children,
}: DebugPanelProps) {
    const [panelHeight, setPanelHeight] = useState(loadHeight);
    const dragging = useRef(false);
    const startY = useRef(0);
    const startH = useRef(0);

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        dragging.current = true;
        startY.current = e.clientY;
        startH.current = panelHeight;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, [panelHeight]);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (!dragging.current) return;
        const delta = startY.current - e.clientY;
        const newH = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startH.current + delta));
        setPanelHeight(newH);
    }, []);

    const onPointerUp = useCallback(() => {
        dragging.current = false;
    }, []);

    useEffect(() => {
        try { localStorage.setItem(STORAGE_KEY, String(panelHeight)); } catch { /* ignore */ }
    }, [panelHeight]);

    const heightStyle = enabled ? { height: panelHeight } : undefined;

    return (
        <div className="debug-panel" style={heightStyle}>
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
                    <span>Layer Debug</span>
                </label>
                <button className="debug-reset" onClick={onReset}>
                    Reset
                </button>
            </div>
            {enabled && (
                <div className="debug-body">
                    <div className="layer-grid">
                        {LAYER_NAMES.map((name, i) => (
                            <LayerColumn
                                key={name}
                                name={name}
                                index={i}
                                visible={layers[i].visible}
                                tint={layers[i].tint}
                                alpha={layers[i].alpha}
                                blendMode={layers[i].blendMode}
                                onToggle={onToggleLayer}
                                onTintEnabled={onTintEnabled}
                                onTintColor={onTintColor}
                                onTintAlpha={onTintAlpha}
                                onAlpha={onAlpha}
                                onBlendMode={onBlendMode}
                            />
                        ))}
                    </div>
                    {children}
                </div>
            )}
        </div>
    );
}
