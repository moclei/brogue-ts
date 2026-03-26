/*
 *  dungeon-canvas.tsx — Canvas component rendering pmap as colored rectangles
 *  dungeon-cake (Phase 1a — replaced by sprite rendering in Phase 1b)
 */

import { useRef, useEffect } from "react";
import type { Pcell } from "@game/types/types.js";
import { DCOLS, DROWS } from "@game/types/constants.js";
import { DungeonLayer } from "@game/types/enums.js";
import { getTileColor } from "./tile-colors.js";

interface DungeonCanvasProps {
    pmap: Pcell[][] | null;
    zoom: number;
}

const CELL_SIZE = 16;

export function DungeonCanvas({ pmap, zoom }: DungeonCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !pmap) return;

        const px = CELL_SIZE * zoom;
        canvas.width = DCOLS * px;
        canvas.height = DROWS * px;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.fillStyle = "#0a0a12";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let x = 0; x < DCOLS; x++) {
            for (let y = 0; y < DROWS; y++) {
                const cell = pmap[x]![y]!;
                const tileType = cell.layers[DungeonLayer.Dungeon]!;
                ctx.fillStyle = getTileColor(tileType);
                ctx.fillRect(x * px, y * px, px, px);
            }
        }
    }, [pmap, zoom]);

    const px = CELL_SIZE * zoom;

    return (
        <div className="canvas-container">
            <canvas
                ref={canvasRef}
                width={DCOLS * px}
                height={DROWS * px}
                style={{ imageRendering: "pixelated" }}
            />
        </div>
    );
}
