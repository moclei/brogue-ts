/*
 *  LayerColumn.tsx — Per-layer debug controls
 *  dungeon-cake
 */

import { useState } from "react";
import type { BlendMode } from "../state/debug-state.js";
import { ALL_BLEND_MODES } from "../state/debug-state.js";

interface LayerColumnProps {
    name: string;
    index: number;
    visible: boolean;
    alpha: number | null;
    blendMode: BlendMode | null;
    defaultBlendMode: BlendMode;
    tintAlpha: number | null;
    defaultTintAlpha: number;
    filter: string | null;
    shadowColor: string | null;
    onToggle: (index: number) => void;
    onAlpha: (index: number, alpha: number | null) => void;
    onBlendMode: (index: number, mode: BlendMode | null) => void;
    onTintAlpha: (index: number, alpha: number | null) => void;
    onFilter: (index: number, filter: string | null) => void;
    onShadowColor: (index: number, color: string | null) => void;
}

export function LayerColumn({
    name,
    index,
    visible,
    alpha,
    blendMode,
    defaultBlendMode,
    tintAlpha,
    defaultTintAlpha,
    filter,
    shadowColor,
    onToggle,
    onAlpha,
    onBlendMode,
    onTintAlpha,
    onFilter,
    onShadowColor,
}: LayerColumnProps) {
    const [shadowEnabled, setShadowEnabled] = useState(shadowColor !== null);

    const effectiveTintAlpha = tintAlpha ?? defaultTintAlpha;
    const tintRelevant = (blendMode ?? defaultBlendMode) !== "none";

    return (
        <div className="layer-column">
            <label className="layer-toggle">
                <input
                    type="checkbox"
                    checked={visible}
                    onChange={() => onToggle(index)}
                />
                <span className="layer-name">{name}</span>
            </label>

            <div className="layer-controls">
                {/* Alpha override */}
                <div className="layer-control-row">
                    <span className="control-label alpha-label" title="Layer alpha">
                        α
                    </span>
                    <input
                        type="range"
                        className="alpha-slider"
                        min={0}
                        max={100}
                        value={alpha !== null ? Math.round(alpha * 100) : 100}
                        onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            onAlpha(index, v === 100 ? null : v / 100);
                        }}
                    />
                    <span className="alpha-value">
                        {alpha !== null ? alpha.toFixed(2) : "—"}
                    </span>
                </div>

                {/* Tint alpha (only shown for layers where tint is applied) */}
                {tintRelevant && (
                    <div className="layer-control-row">
                        <span
                            className="control-label alpha-label tint-alpha-label"
                            title={`Tint fill opacity (default: ${defaultTintAlpha})`}
                        >
                            tα
                        </span>
                        <input
                            type="range"
                            className="alpha-slider tint-alpha-range"
                            min={0}
                            max={100}
                            value={Math.round(effectiveTintAlpha * 100)}
                            onChange={(e) => {
                                const v = parseInt(e.target.value, 10) / 100;
                                onTintAlpha(index, v === defaultTintAlpha ? null : v);
                            }}
                        />
                        <span className="alpha-value">
                            {effectiveTintAlpha.toFixed(2)}
                        </span>
                    </div>
                )}

                {/* Blend mode */}
                <div className="layer-control-row">
                    <select
                        className="blend-select"
                        value={blendMode ?? ""}
                        onChange={(e) =>
                            onBlendMode(
                                index,
                                e.target.value ? (e.target.value as BlendMode) : null,
                            )
                        }
                    >
                        <option value="">{defaultBlendMode} (default)</option>
                        {ALL_BLEND_MODES.map((m) => (
                            <option key={m} value={m}>
                                {m}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Filter override */}
                <div className="layer-control-row">
                    <input
                        type="text"
                        className="filter-input"
                        placeholder="filter"
                        value={filter ?? ""}
                        onChange={(e) =>
                            onFilter(index, e.target.value || null)
                        }
                        title="CSS filter (e.g. brightness(1.5), hue-rotate(90deg))"
                    />
                </div>

                {/* Shadow color */}
                <div className="layer-control-row">
                    <label className="control-label" title="Shadow color">
                        <input
                            type="checkbox"
                            checked={shadowEnabled}
                            onChange={(e) => {
                                setShadowEnabled(e.target.checked);
                                onShadowColor(
                                    index,
                                    e.target.checked ? (shadowColor ?? "#000000") : null,
                                );
                            }}
                        />
                        <span>shadow</span>
                    </label>
                    <input
                        type="color"
                        className="shadow-picker"
                        value={shadowColor ?? "#000000"}
                        disabled={!shadowEnabled}
                        onChange={(e) => onShadowColor(index, e.target.value)}
                    />
                </div>
            </div>
        </div>
    );
}
