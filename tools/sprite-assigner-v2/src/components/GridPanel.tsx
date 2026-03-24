import { useApp } from "../state/app-state.ts";
import { TILE_SIZE } from "../data/tile-types.ts";
import { GridCanvas } from "./GridCanvas.tsx";
import { SelectionBar } from "./SelectionBar.tsx";

export function GridPanel() {
  const { state, setZoom } = useApp();
  const { currentSheetKey, zoom, imageCache } = state;

  const img = currentSheetKey ? imageCache.get(currentSheetKey) : null;
  const cols = img ? Math.floor(img.width / TILE_SIZE) : 0;
  const rows = img ? Math.floor(img.height / TILE_SIZE) : 0;

  return (
    <section className="grid-panel">
      <div className="grid-toolbar">
        <span className="label">
          {currentSheetKey ?? "No sheet selected"}
        </span>
        {img && (
          <span className="dim">
            {cols}&times;{rows} tiles ({img.width}&times;{img.height}px)
          </span>
        )}
        <div className="zoom-controls">
          <button onClick={() => setZoom(zoom - 1)}>&minus;</button>
          <span>{zoom}x</span>
          <button onClick={() => setZoom(zoom + 1)}>+</button>
        </div>
      </div>
      <div className="grid-container">
        {currentSheetKey && <GridCanvas />}
      </div>
      <SelectionBar />
    </section>
  );
}
