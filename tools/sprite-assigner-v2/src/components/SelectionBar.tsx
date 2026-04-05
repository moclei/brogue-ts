import { useRef, useEffect } from "react";
import { useAssignments } from "../state/assignments.ts";
import { useApp } from "../state/app-state.ts";
import { findSheetDef } from "../data/sheet-manifest.ts";

const DEFAULT_STRIDE = 16;

export function SelectionBar() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { state, setSelectedTile } = useApp();
  const assignments = useAssignments();
  const { selectedTile, imageCache, manifest } = state;

  // Derive stride for the selected tile's sheet.
  const stride = (() => {
    if (!selectedTile || !manifest) return DEFAULT_STRIDE;
    const def = findSheetDef(manifest, selectedTile.sheet);
    return def?.stride ?? manifest.tileSize ?? DEFAULT_STRIDE;
  })();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 48, 48);

    if (!selectedTile) return;
    const img = imageCache.get(selectedTile.sheet);
    if (!img) return;

    const tileStride = (() => {
      if (!manifest) return DEFAULT_STRIDE;
      const def = findSheetDef(manifest, selectedTile.sheet);
      return def?.stride ?? manifest.tileSize ?? DEFAULT_STRIDE;
    })();

    const srcW = (selectedTile.w ?? 1) * tileStride;
    const srcH = (selectedTile.h ?? 1) * tileStride;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      img,
      selectedTile.x * tileStride,
      selectedTile.y * tileStride,
      srcW,
      srcH,
      0, 0, 48, 48,
    );
  }, [selectedTile, imageCache, manifest]);

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

  const dimLabel = (() => {
    if (!selectedTile) return null;
    const w = selectedTile.w ?? 1;
    const h = selectedTile.h ?? 1;
    const px = w * stride;
    const tilePlural = (w === 1 && h === 1) ? "tile" : "tiles";
    return `${w}×${h} ${tilePlural} (${px} px)`;
  })();

  return (
    <div className="selection-bar">
      <canvas ref={canvasRef} className="sel-preview" width={48} height={48} />
      {selectedTile ? (
        <div className="sel-info">
          <span className="coord">
            {selectedTile.sheet} ({selectedTile.x}, {selectedTile.y})
          </span>
          {dimLabel && (
            <>
              {" "}
              <span className="sel-dims">{dimLabel}</span>
            </>
          )}
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
