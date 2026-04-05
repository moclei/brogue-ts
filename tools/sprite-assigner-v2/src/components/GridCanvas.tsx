import { useRef, useEffect, useCallback } from "react";
import { useAssignments } from "../state/assignments.ts";
import { useApp, type AppState, type SelectedTile } from "../state/app-state.ts";
import { findSheetDef } from "../data/sheet-manifest.ts";

const DEFAULT_STRIDE = 16;

/** Derive the tile stride (px) for the currently active sheet. */
function getSheetStride(state: AppState): number {
  const { manifest, currentSheetKey } = state;
  if (!manifest || !currentSheetKey) return DEFAULT_STRIDE;
  const def = findSheetDef(manifest, currentSheetKey);
  return def?.stride ?? manifest.tileSize ?? DEFAULT_STRIDE;
}

interface DragState {
  startTileX: number;
  startTileY: number;
  curTileX: number;
  curTileY: number;
}

export function GridCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef<SelectedTile | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const { state, setSelectedTile } = useApp();
  const assignments = useAssignments();
  const { currentSheetKey, selectedTile, zoom, imageCache, activeTab } = state;

  const isGlyphMode = activeTab === "glyph";

  const getStride = useCallback(() => getSheetStride(state), [state]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentSheetKey) return;
    const img = imageCache.get(currentSheetKey);
    if (!img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const stride = getStride();
    const w = img.width * zoom;
    const h = img.height * zoom;
    canvas.width = w;
    canvas.height = h;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, w, h);

    const cols = Math.floor(img.width / stride);
    const rows = Math.floor(img.height / stride);
    const ts = stride * zoom;

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

    // Assignment markers — draw at correct tile span (w/h)
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
      const [tx, ty] = k.split(",").map(Number) as [number, number];
      // Look up any assignment at this position to get w/h
      let spanW = 1;
      let spanH = 1;
      for (const ref of Object.values(assignments.glyph)) {
        if (ref.sheet === currentSheetKey && ref.x === tx && ref.y === ty) {
          spanW = ref.w ?? 1;
          spanH = ref.h ?? 1;
          break;
        }
      }
      if (spanW === 1 && spanH === 1) {
        for (const ref of Object.values(assignments.tiletype)) {
          if (ref.sheet === currentSheetKey && ref.x === tx && ref.y === ty) {
            spanW = ref.w ?? 1;
            spanH = ref.h ?? 1;
            break;
          }
        }
      }
      const pw = spanW * ts;
      const ph = spanH * ts;
      ctx.fillStyle = "rgba(74,255,142,0.15)";
      ctx.fillRect(tx * ts, ty * ts, pw, ph);
      ctx.fillStyle = "#4aff8e";
      const dotSize = Math.max(3, zoom);
      ctx.fillRect(tx * ts + 2, ty * ts + 2, dotSize, dotSize);
    }

    // Hover highlight (1×1 — always single tile hover)
    const hover = hoverRef.current;
    if (hover && hover.sheet === currentSheetKey) {
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 2;
      ctx.strokeRect(hover.x * ts + 1, hover.y * ts + 1, ts - 2, ts - 2);
    }

    // Active drag rect (glyph mode only)
    const drag = dragRef.current;
    if (drag && isGlyphMode) {
      const minTX = Math.min(drag.startTileX, drag.curTileX);
      const minTY = Math.min(drag.startTileY, drag.curTileY);
      const maxTX = Math.max(drag.startTileX, drag.curTileX);
      const maxTY = Math.max(drag.startTileY, drag.curTileY);
      const spanW = (maxTX - minTX + 1) * ts;
      const spanH = (maxTY - minTY + 1) * ts;
      ctx.strokeStyle = "#ff9f1a";
      ctx.lineWidth = 2;
      ctx.strokeRect(minTX * ts + 1, minTY * ts + 1, spanW - 2, spanH - 2);
      ctx.fillStyle = "rgba(255,159,26,0.1)";
      ctx.fillRect(minTX * ts, minTY * ts, spanW, spanH);
    }

    // Committed selection highlight
    if (selectedTile && selectedTile.sheet === currentSheetKey) {
      const selW = (selectedTile.w ?? 1) * ts;
      const selH = (selectedTile.h ?? 1) * ts;
      ctx.strokeStyle = "#ffe04a";
      ctx.lineWidth = 2;
      ctx.strokeRect(selectedTile.x * ts + 1, selectedTile.y * ts + 1, selW - 2, selH - 2);
      ctx.fillStyle = "rgba(255,224,74,0.1)";
      ctx.fillRect(selectedTile.x * ts, selectedTile.y * ts, selW, selH);
    }
  }, [currentSheetKey, selectedTile, zoom, imageCache, assignments, getStride, isGlyphMode]);

  useEffect(() => {
    render();
  }, [render]);

  const getTileAt = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas || !currentSheetKey) return null;
      const img = imageCache.get(currentSheetKey);
      if (!img) return null;

      const stride = getStride();
      const rect = canvas.getBoundingClientRect();
      const ts = stride * zoom;
      const x = Math.floor((e.clientX - rect.left) / ts);
      const y = Math.floor((e.clientY - rect.top) / ts);
      const maxC = Math.floor(img.width / stride);
      const maxR = Math.floor(img.height / stride);
      if (x < 0 || x >= maxC || y < 0 || y >= maxR) return null;
      return { x, y };
    },
    [currentSheetKey, zoom, imageCache, getStride],
  );

  // --- Mouse down: start drag (glyph mode) or prepare click (tiletype mode) ---
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isGlyphMode) return;
      const tile = getTileAt(e);
      if (!tile) return;
      dragRef.current = {
        startTileX: tile.x,
        startTileY: tile.y,
        curTileX: tile.x,
        curTileY: tile.y,
      };
      render();
    },
    [isGlyphMode, getTileAt, render],
  );

  // --- Mouse up: commit rect selection (glyph) or single click (tiletype) ---
  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isGlyphMode) {
        // TileType / autotile: simple single-tile click
        const tile = getTileAt(e);
        if (tile && currentSheetKey) {
          setSelectedTile({ sheet: currentSheetKey, x: tile.x, y: tile.y });
        }
        return;
      }

      const drag = dragRef.current;
      dragRef.current = null;

      const tile = getTileAt(e);
      const effectiveTile = tile ?? (drag
        ? { x: drag.curTileX, y: drag.curTileY }
        : null);

      if (!effectiveTile || !currentSheetKey) {
        render();
        return;
      }

      const startX = drag?.startTileX ?? effectiveTile.x;
      const startY = drag?.startTileY ?? effectiveTile.y;
      const minX = Math.min(startX, effectiveTile.x);
      const minY = Math.min(startY, effectiveTile.y);
      const w = Math.abs(effectiveTile.x - startX) + 1;
      const h = Math.abs(effectiveTile.y - startY) + 1;

      setSelectedTile({ sheet: currentSheetKey, x: minX, y: minY, w, h });
      render();
    },
    [isGlyphMode, getTileAt, currentSheetKey, setSelectedTile, render],
  );

  // --- Click: handled by mouseup for tiletype; no-op here ---
  const handleClick = useCallback(
    (_e: React.MouseEvent<HTMLCanvasElement>) => {
      // Handled in handleMouseUp to unify glyph and tiletype paths.
    },
    [],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const tile = getTileAt(e);

      // Update hover (always)
      const prev = hoverRef.current;
      const hoverChanged =
        tile?.x !== prev?.x ||
        tile?.y !== prev?.y ||
        (tile === null) !== (prev === null);

      if (hoverChanged) {
        hoverRef.current = tile && currentSheetKey
          ? { sheet: currentSheetKey, x: tile.x, y: tile.y }
          : null;
      }

      // Update drag rect in glyph mode
      let dragChanged = false;
      if (isGlyphMode && dragRef.current && tile) {
        if (
          dragRef.current.curTileX !== tile.x ||
          dragRef.current.curTileY !== tile.y
        ) {
          dragRef.current = { ...dragRef.current, curTileX: tile.x, curTileY: tile.y };
          dragChanged = true;
        }
      }

      if (hoverChanged || dragChanged) {
        render();
      }
    },
    [getTileAt, currentSheetKey, isGlyphMode, render],
  );

  const handleMouseLeave = useCallback(() => {
    const hadHover = hoverRef.current !== null;
    hoverRef.current = null;
    // Cancel any in-progress drag on leave
    const hadDrag = dragRef.current !== null;
    dragRef.current = null;
    if (hadHover || hadDrag) {
      render();
    }
  }, [render]);

  return (
    <canvas
      ref={canvasRef}
      className="grid-canvas"
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    />
  );
}
