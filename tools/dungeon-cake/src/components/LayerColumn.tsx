/*
 *  LayerColumn.tsx — Per-layer debug controls: visibility, tint, alpha, blend
 *  dungeon-cake
 */

import type { TintState, BlendMode } from "../state/debug-state.js";
import { ALL_BLEND_MODES } from "../state/debug-state.js";

interface LayerColumnProps {
    name: string;
    index: number;
    visible: boolean;
    tint: TintState;
    alpha: number | null;
    blendMode: BlendMode | null;
    onToggle: (index: number) => void;
    onTintEnabled: (index: number, enabled: boolean) => void;
    onTintColor: (index: number, color: string) => void;
    onTintAlpha: (index: number, alpha: number) => void;
    onAlpha: (index: number, alpha: number | null) => void;
    onBlendMode: (index: number, mode: BlendMode | null) => void;
}

export function LayerColumn({
    name,
    index,
    visible,
    tint,
    alpha,
    blendMode,
    onToggle,
    onTintEnabled,
    onTintColor,
    onTintAlpha,
    onAlpha,
    onBlendMode,
}: LayerColumnProps) {
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
                {/* Tint override */}
                <div className="layer-control-row">
                    <label className="control-label" title="Tint override">
                        <input
                            type="checkbox"
                            checked={tint.enabled}
                            onChange={(e) => onTintEnabled(index, e.target.checked)}
                        />
                        <span>T</span>
                    </label>
                    <input
                        type="color"
                        className="tint-picker"
                        value={tint.color}
                        disabled={!tint.enabled}
                        onChange={(e) => onTintColor(index, e.target.value)}
                    />
                    <input
                        type="range"
                        className="tint-alpha-slider"
                        min={0}
                        max={100}
                        value={Math.round(tint.alpha * 100)}
                        disabled={!tint.enabled}
                        title={`Tint opacity: ${(tint.alpha * 100).toFixed(0)}%`}
                        onChange={(e) =>
                            onTintAlpha(index, parseInt(e.target.value, 10) / 100)
                        }
                    />
                </div>

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
                        <option value="">default</option>
                        {ALL_BLEND_MODES.map((m) => (
                            <option key={m} value={m}>
                                {m}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
}
