import { useRef, useEffect, useCallback } from "react";
import { TILE_SIZE } from "../data/tile-types.ts";
import { useAssignments } from "../state/assignments.ts";
import { useApp, type SelectedTile } from "../state/app-state.ts";

export function GridCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef<SelectedTile | null>(null);
  const { state, setSelectedTile } = useApp();
  const assignments = useAssignments();
  const { currentSheetKey, selectedTile, zoom, imageCache } = state;

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentSheetKey) return;
    const img = imageCache.get(currentSheetKey);
    if (!img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = img.width * zoom;
    const h = img.height * zoom;
    canvas.width = w;
    canvas.height = h;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, w, h);

    const cols = Math.floor(img.width / TILE_SIZE);
    const rows = Math.floor(img.height / TILE_SIZE);
    const ts = TILE_SIZE * zoom;

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * ts + 0.5, 0);
      ctx.lineTo(c * ts + 0.5, h);
      ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * ts + 0.5);
      ctx.lineTo(w, r * ts + 0.5);
      ctx.stroke();
    }

    // Assignment markers
    const assigned = new Map<string, string[]>();
    for (const [name, ref] of Object.entries(assignments.tiletype)) {
      if (ref.sheet === currentSheetKey) {
        const k = `${ref.x},${ref.y}`;
        if (!assigned.has(k)) assigned.set(k, []);
        assigned.get(k)!.push("T:" + name);
      }
    }
    for (const [name, ref] of Object.entries(assignments.glyph)) {
      if (ref.sheet === currentSheetKey) {
        const k = `${ref.x},${ref.y}`;
        if (!assigned.has(k)) assigned.set(k, []);
        assigned.get(k)!.push("G:" + name);
      }
    }
    for (const [k] of assigned) {
      const [x, y] = k.split(",").map(Number) as [number, number];
      ctx.fillStyle = "rgba(74,255,142,0.15)";
      ctx.fillRect(x * ts, y * ts, ts, ts);
      ctx.fillStyle = "#4aff8e";
      const dotSize = Math.max(3, zoom);
      ctx.fillRect(x * ts + 2, y * ts + 2, dotSize, dotSize);
    }

    // Hover highlight
    const hover = hoverRef.current;
    if (hover && hover.sheet === currentSheetKey) {
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 2;
      ctx.strokeRect(hover.x * ts + 1, hover.y * ts + 1, ts - 2, ts - 2);
    }

    // Selection highlight
    if (selectedTile && selectedTile.sheet === currentSheetKey) {
      ctx.strokeStyle = "#ffe04a";
      ctx.lineWidth = 2;
      ctx.strokeRect(selectedTile.x * ts + 1, selectedTile.y * ts + 1, ts - 2, ts - 2);
      ctx.fillStyle = "rgba(255,224,74,0.1)";
      ctx.fillRect(selectedTile.x * ts, selectedTile.y * ts, ts, ts);
    }
  }, [currentSheetKey, selectedTile, zoom, imageCache, assignments]);

  useEffect(() => {
    render();
  }, [render]);

  const getTileAt = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): SelectedTile | null => {
      const canvas = canvasRef.current;
      if (!canvas || !currentSheetKey) return null;
      const img = imageCache.get(currentSheetKey);
      if (!img) return null;

      const rect = canvas.getBoundingClientRect();
      const ts = TILE_SIZE * zoom;
      const x = Math.floor((e.clientX - rect.left) / ts);
      const y = Math.floor((e.clientY - rect.top) / ts);
      const maxC = Math.floor(img.width / TILE_SIZE);
      const maxR = Math.floor(img.height / TILE_SIZE);
      if (x < 0 || x >= maxC || y < 0 || y >= maxR) return null;
      return { sheet: currentSheetKey, x, y };
    },
    [currentSheetKey, zoom, imageCache],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const tile = getTileAt(e);
      if (tile) setSelectedTile(tile);
    },
    [getTileAt, setSelectedTile],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const tile = getTileAt(e);
      const prev = hoverRef.current;
      if (
        tile?.x !== prev?.x ||
        tile?.y !== prev?.y ||
        tile?.sheet !== prev?.sheet
      ) {
        hoverRef.current = tile;
        render();
      }
    },
    [getTileAt, render],
  );

  const handleMouseLeave = useCallback(() => {
    if (hoverRef.current) {
      hoverRef.current = null;
      render();
    }
  }, [render]);

  return (
    <canvas
      ref={canvasRef}
      className="grid-canvas"
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    />
  );
}
