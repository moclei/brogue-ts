/*
 *  LayerColumn.tsx — Per-layer visibility toggle
 *  dungeon-cake (Phase 1b — visibility only, tint/alpha/blend in Phase 2)
 */

interface LayerColumnProps {
    name: string;
    index: number;
    visible: boolean;
    onToggle: (index: number) => void;
}

export function LayerColumn({ name, index, visible, onToggle }: LayerColumnProps) {
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
        </div>
    );
}
