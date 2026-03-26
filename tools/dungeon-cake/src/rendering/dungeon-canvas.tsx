/*
 *  dungeon-canvas.tsx — Canvas component rendering dungeon with sprites
 *  dungeon-cake
 */

import { useRef, useEffect, useState, useCallback } from "react";
import type { Pcell } from "@game/types/types.js";
import type { CellQueryContext } from "@game/io/cell-queries.js";
import { DCOLS, DROWS } from "@game/types/constants.js";
import { TILE_SIZE, loadTilesets } from "../shared/tileset-bridge.js";
import type { TilesetBundle } from "../shared/tileset-bridge.js";
import { createQueryContext } from "../generation/query-context.js";
import type { FogMode } from "../generation/query-context.js";
import { renderDungeon } from "./cell-renderer.js";

interface DungeonCanvasProps {
    pmap: Pcell[][] | null;
    zoom: number;
    redrawCounter?: number;
    lightingEnabled?: boolean;
    fogMode?: FogMode;
}

export function DungeonCanvas({ pmap, zoom, redrawCounter, lightingEnabled, fogMode }: DungeonCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const bundleRef = useRef<TilesetBundle | null>(null);
    const queryCtxRef = useRef<CellQueryContext | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const ensureTilesets = useCallback(async (ctx: CanvasRenderingContext2D) => {
        if (bundleRef.current) return bundleRef.current;
        setLoading(true);
        try {
            const bundle = await loadTilesets(ctx);
            bundleRef.current = bundle;
            return bundle;
        } catch (err) {
            setLoadError(err instanceof Error ? err.message : String(err));
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !pmap) return;

        const cellSize = TILE_SIZE * zoom;
        canvas.width = DCOLS * cellSize;
        canvas.height = DROWS * cellSize;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;

        let cancelled = false;

        (async () => {
            const bundle = await ensureTilesets(ctx);
            if (cancelled || !bundle) return;

            queryCtxRef.current = createQueryContext(pmap, {
                fogMode: fogMode ?? "visible",
                lightingEnabled: lightingEnabled ?? false,
            });
            renderDungeon(ctx, bundle.spriteRenderer, queryCtxRef.current, zoom);
        })();

        return () => { cancelled = true; };
    }, [pmap, zoom, redrawCounter, lightingEnabled, fogMode, ensureTilesets]);

    const cellSize = TILE_SIZE * zoom;

    return (
        <div className="canvas-container">
            {loading && <div className="loading-overlay">Loading tilesets...</div>}
            {loadError && <div className="error-overlay">Tileset error: {loadError}</div>}
            <canvas
                ref={canvasRef}
                width={DCOLS * cellSize}
                height={DROWS * cellSize}
                style={{ imageRendering: "pixelated" }}
            />
        </div>
    );
}
