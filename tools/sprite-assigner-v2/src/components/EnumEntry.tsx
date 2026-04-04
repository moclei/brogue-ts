import { useRef, useEffect, useState } from "react";
import { useApp } from "../state/app-state.ts";
import { findSheetDef } from "../data/sheet-manifest.ts";
import type { SpriteRef } from "../state/assignments.ts";

const DEFAULT_STRIDE = 16;

interface EnumEntryProps {
  name: string;
  ascii?: string;
  ref_: SpriteRef | null;
  isSameTile: boolean;
  onAssign: () => void;
  onUnassign: () => void;
  onJumpToSprite: (sheet: string, x: number, y: number) => void;
}

export function EnumEntry({
  name,
  ascii,
  ref_,
  isSameTile,
  onAssign,
  onUnassign,
  onJumpToSprite,
}: EnumEntryProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { loadImage, state } = useApp();
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ref_) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Derive stride for this assignment's sheet.
    const { manifest } = state;
    const sheetDef = manifest ? findSheetDef(manifest, ref_.sheet) : null;
    const stride = sheetDef?.stride ?? manifest?.tileSize ?? DEFAULT_STRIDE;

    const srcX = ref_.x * stride;
    const srcY = ref_.y * stride;
    const srcW = (ref_.w ?? 1) * stride;
    const srcH = (ref_.h ?? 1) * stride;

    let cancelled = false;
    loadImage(ref_.sheet).then((img) => {
      if (cancelled || !img) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, 28, 28);
      ctx.drawImage(
        img,
        srcX,
        srcY,
        srcW,
        srcH,
        2, 2, 24, 24,
      );
    });
    return () => { cancelled = true; };
  }, [ref_, loadImage, state]);

  const handleClick = () => {
    onAssign();
    setFlash(true);
    setTimeout(() => setFlash(false), 600);
  };

  const handleSpriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (ref_) onJumpToSprite(ref_.sheet, ref_.x, ref_.y);
  };

  const handleUnassignClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUnassign();
  };

  const classes = [
    "enum-entry",
    isSameTile ? "same-tile" : "",
    flash ? "flash" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} onClick={handleClick} data-name={name}>
      {ascii !== undefined && (
        <span className="enum-ascii" title={`ASCII: ${ascii}`}>
          {ascii}
        </span>
      )}
      <span className="enum-name" title={name}>
        {name}
      </span>
      {ref_ ? (
        <>
          <canvas
            ref={canvasRef}
            className="enum-sprite"
            width={28}
            height={28}
            title={`${ref_.sheet} (${ref_.x}, ${ref_.y})`}
            onClick={handleSpriteClick}
          />
          <button
            className="enum-unassign"
            onClick={handleUnassignClick}
            title="Remove"
          >
            &times;
          </button>
        </>
      ) : (
        <canvas className="enum-sprite empty" width={28} height={28} />
      )}
    </div>
  );
}
