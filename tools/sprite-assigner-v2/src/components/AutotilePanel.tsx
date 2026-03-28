import { useState, useRef, useEffect, useCallback } from "react";
import {
  CONNECTION_GROUPS,
  AUTOTILE_VARIANT_COUNT,
  AUTOTILE_GRID_COLS,
  AUTOTILE_GRID_ROWS,
  getVariantInfo,
  type ConnectionGroup,
} from "../data/autotile-groups.ts";
import { TILE_SIZE } from "../data/tile-types.ts";
import { useAssignments, useAssignmentHelpers } from "../state/assignments.ts";
import { useApp } from "../state/app-state.ts";
import type { TilesetManifest } from "../data/sheet-manifest.ts";

const CELL_SIZE = 40;
const GAP = 2;

function allSheetKeys(manifest: TilesetManifest | null): string[] {
  if (!manifest) return [];
  const keys: string[] = [];
  for (const ts of manifest.tilesets) {
    for (const s of ts.sheets) keys.push(s.key);
  }
  return keys;
}

export function AutotilePanel() {
  const [group, setGroup] = useState<ConnectionGroup>("WALL");
  const [showWangImport, setShowWangImport] = useState(false);
  const { state, showToast } = useApp();
  const { selectedTile, manifest, currentSheetKey } = state;
  const assignments = useAssignments();
  const { assignVariant, unassignVariant, resetGroup, importWangBlob } = useAssignmentHelpers();

  const variants = assignments.autotile[group] ?? [];
  const assignedCount = variants.filter((v) => v !== null).length;

  const handleSlotClick = useCallback(
    (index: number) => {
      if (!selectedTile) return;
      assignVariant(group, index, {
        sheet: selectedTile.sheet,
        x: selectedTile.x,
        y: selectedTile.y,
      });
      showToast(`Variant ${index} → ${selectedTile.sheet} (${selectedTile.x}, ${selectedTile.y})`);
    },
    [group, selectedTile, assignVariant, showToast],
  );

  const handleUnassign = useCallback(
    (index: number) => {
      unassignVariant(group, index);
    },
    [group, unassignVariant],
  );

  const handleReset = useCallback(() => {
    if (!confirm(`Reset all ${group} autotile variants?`)) return;
    resetGroup(group);
    showToast(`Reset ${group} autotile variants`);
  }, [group, resetGroup, showToast]);

  const handleWangBlobImport = useCallback(
    (sheetKey: string) => {
      importWangBlob(group, sheetKey);
      showToast(`Imported Wang Blob sheet "${sheetKey}" → ${group} (47 variants)`);
      setShowWangImport(false);
    },
    [group, importWangBlob, showToast],
  );

  return (
    <div className="autotile-panel">
      <div className="autotile-header">
        <select
          value={group}
          onChange={(e) => setGroup(e.target.value as ConnectionGroup)}
        >
          {CONNECTION_GROUPS.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <span className="autotile-stats">
          {assignedCount}/{AUTOTILE_VARIANT_COUNT}
        </span>
        <button onClick={handleReset} title="Reset group">Reset</button>
        <button
          onClick={() => setShowWangImport(!showWangImport)}
          title="Import a 7×7 Wang Blob spritesheet"
          className={showWangImport ? "active" : ""}
        >
          Wang Blob
        </button>
      </div>
      {showWangImport && (
        <WangBlobImportBar
          sheetKeys={allSheetKeys(manifest)}
          defaultSheet={currentSheetKey}
          onImport={handleWangBlobImport}
          onCancel={() => setShowWangImport(false)}
        />
      )}
      <div className="autotile-grid-scroll">
        <div
          className="autotile-grid"
          style={{
            gridTemplateColumns: `repeat(${AUTOTILE_GRID_COLS}, ${CELL_SIZE}px)`,
            gap: `${GAP}px`,
          }}
        >
          {Array.from({ length: AUTOTILE_GRID_COLS * AUTOTILE_GRID_ROWS }, (_, i) => {
            if (i >= AUTOTILE_VARIANT_COUNT) {
              return <div key={i} className="autotile-slot unused" />;
            }
            const ref = variants[i] ?? null;
            return (
              <AutotileSlot
                key={i}
                index={i}
                ref_={ref}
                isSelected={
                  selectedTile != null &&
                  ref != null &&
                  ref.sheet === selectedTile.sheet &&
                  ref.x === selectedTile.x &&
                  ref.y === selectedTile.y
                }
                onAssign={() => handleSlotClick(i)}
                onUnassign={() => handleUnassign(i)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface AutotileSlotProps {
  index: number;
  ref_: { sheet: string; x: number; y: number } | null;
  isSelected: boolean;
  onAssign: () => void;
  onUnassign: () => void;
}

function AutotileSlot({ index, ref_, isSelected, onAssign, onUnassign }: AutotileSlotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { loadImage } = useApp();
  const info = getVariantInfo(index);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CELL_SIZE, CELL_SIZE);

    if (ref_) {
      let cancelled = false;
      loadImage(ref_.sheet).then((img) => {
        if (cancelled || !img) return;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, CELL_SIZE, CELL_SIZE);
        ctx.drawImage(
          img,
          ref_.x * TILE_SIZE,
          ref_.y * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE,
          4, 4, CELL_SIZE - 8, CELL_SIZE - 8,
        );
      });
      return () => { cancelled = true; };
    } else {
      drawMiniDiagram(ctx, info.neighbors, CELL_SIZE);
    }
  }, [ref_, loadImage, info]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onUnassign();
  };

  return (
    <div
      className={`autotile-slot${isSelected ? " selected" : ""}${ref_ ? " assigned" : ""}`}
      onClick={onAssign}
      onContextMenu={handleContextMenu}
      title={`Variant ${index} — mask ${info.mask} (0b${info.mask.toString(2).padStart(8, "0")})${ref_ ? `\n${ref_.sheet} (${ref_.x}, ${ref_.y})\nRight-click to unassign` : "\nClick to assign selected tile"}`}
    >
      <canvas
        ref={canvasRef}
        width={CELL_SIZE}
        height={CELL_SIZE}
        className="autotile-slot-canvas"
      />
      <span className="autotile-slot-index">{index}</span>
    </div>
  );
}

interface WangBlobImportBarProps {
  sheetKeys: string[];
  defaultSheet: string | null;
  onImport: (sheetKey: string) => void;
  onCancel: () => void;
}

function WangBlobImportBar({ sheetKeys, defaultSheet, onImport, onCancel }: WangBlobImportBarProps) {
  const [selected, setSelected] = useState(defaultSheet ?? sheetKeys[0] ?? "");

  return (
    <div className="wang-blob-import-bar">
      <label>
        Sheet:
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {sheetKeys.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </label>
      <button
        onClick={() => {
          if (!selected) return;
          if (!confirm(`Import Wang Blob sheet "${selected}"?\nThis will overwrite all variant assignments for this group.`)) return;
          onImport(selected);
        }}
        disabled={!selected}
      >
        Import 7×7
      </button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}

function drawMiniDiagram(
  ctx: CanvasRenderingContext2D,
  neighbors: (boolean | null)[][],
  size: number,
) {
  const cellSize = Math.floor(size / 4);
  const offset = Math.floor((size - cellSize * 3) / 2);

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const val = neighbors[r]![c];
      const x = offset + c * cellSize;
      const y = offset + r * cellSize;

      if (val === null) {
        ctx.fillStyle = "#4a9eff";
        ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
      } else if (val) {
        ctx.fillStyle = "#4aff8e";
        ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
      } else {
        ctx.fillStyle = "#333345";
        ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
      }
    }
  }
}
