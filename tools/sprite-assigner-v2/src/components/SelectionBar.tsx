import { useRef, useEffect } from "react";
import { TILE_SIZE } from "../data/tile-types.ts";
import { useAssignments } from "../state/assignments.ts";
import { useApp } from "../state/app-state.ts";

export function SelectionBar() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { state, setSelectedTile } = useApp();
  const assignments = useAssignments();
  const { selectedTile, imageCache } = state;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 48, 48);

    if (!selectedTile) return;
    const img = imageCache.get(selectedTile.sheet);
    if (!img) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      img,
      selectedTile.x * TILE_SIZE,
      selectedTile.y * TILE_SIZE,
      TILE_SIZE,
      TILE_SIZE,
      0, 0, 48, 48,
    );
  }, [selectedTile, imageCache]);

  const usedBy: string[] = [];
  if (selectedTile) {
    for (const [name, ref] of Object.entries(assignments.tiletype)) {
      if (ref.sheet === selectedTile.sheet && ref.x === selectedTile.x && ref.y === selectedTile.y) {
        usedBy.push("TileType." + name);
      }
    }
    for (const [name, ref] of Object.entries(assignments.glyph)) {
      if (ref.sheet === selectedTile.sheet && ref.x === selectedTile.x && ref.y === selectedTile.y) {
        usedBy.push("DisplayGlyph." + name);
      }
    }
  }

  return (
    <div className="selection-bar">
      <canvas ref={canvasRef} className="sel-preview" width={48} height={48} />
      {selectedTile ? (
        <div className="sel-info">
          <span className="coord">
            {selectedTile.sheet} ({selectedTile.x}, {selectedTile.y})
          </span>
          <br />
          <span className="hint">&rarr; Click an enum on the right to assign this tile</span>
          {usedBy.length > 0 && (
            <>
              <br />
              <span className="used-by">Used by: {usedBy.join(", ")}</span>
            </>
          )}
        </div>
      ) : (
        <div className="sel-info">Click a tile in the grid to select it</div>
      )}
      {selectedTile && (
        <button className="sel-clear" onClick={() => setSelectedTile(null)}>
          Clear (Esc)
        </button>
      )}
    </div>
  );
}
