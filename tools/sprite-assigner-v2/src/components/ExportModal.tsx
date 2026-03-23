import { useState, useCallback } from "react";
import {
  TILE_TYPES,
  DISPLAY_GLYPHS,
  TILE_SIZE,
  MASTER_GRID_W,
  MASTER_GRID_H,
  GLYPH_GRID_OFFSET,
} from "../data/tile-types.ts";
import { useAssignments, useAssignmentHelpers, type Assignments } from "../state/assignments.ts";
import { useApp } from "../state/app-state.ts";

type ModalView = "code" | "json" | "import" | "mastersheet" | null;

export function ExportModal() {
  const [view, setView] = useState<ModalView>(null);
  const [content, setContent] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copy");
  const [importText, setImportText] = useState("");
  const [masterSheetHtml, setMasterSheetHtml] = useState("");
  const assignments = useAssignments();
  const { importJSON, reset } = useAssignmentHelpers();
  const { loadImage, showToast } = useApp();

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content);
    setCopyLabel("Copied!");
    setTimeout(() => setCopyLabel("Copy"), 1500);
  }, [content]);

  const openCode = useCallback(() => {
    let code = "// ===== TileType sprite assignments =====\n";
    code += "// Paste into buildTileTypeSpriteMap() in glyph-sprite-map.ts\n\n";

    const tileTypesArr: readonly string[] = TILE_TYPES;
    const ttEntries = Object.entries(assignments.tiletype)
      .sort((a, b) => tileTypesArr.indexOf(a[0]) - tileTypesArr.indexOf(b[0]));
    for (const [name, ref] of ttEntries) {
      const args =
        ref.x === 0 && ref.y === 0
          ? `"${ref.sheet}"`
          : ref.y === 0
            ? `"${ref.sheet}", ${ref.x}`
            : `"${ref.sheet}", ${ref.x}, ${ref.y}`;
      code += `  m.set(TileType.${name}, tile(${args}));\n`;
    }

    code += "\n// ===== DisplayGlyph sprite assignments =====\n";
    code += "// Paste into buildGlyphSpriteMap() in glyph-sprite-map.ts\n\n";

    const glyphsArr: readonly string[] = DISPLAY_GLYPHS;
    const dgEntries = Object.entries(assignments.glyph)
      .sort((a, b) => glyphsArr.indexOf(a[0]) - glyphsArr.indexOf(b[0]));
    for (const [name, ref] of dgEntries) {
      const args =
        ref.x === 0 && ref.y === 0
          ? `"${ref.sheet}"`
          : ref.y === 0
            ? `"${ref.sheet}", ${ref.x}`
            : `"${ref.sheet}", ${ref.x}, ${ref.y}`;
      code += `  m.set(DisplayGlyph.${name}, tile(${args}));\n`;
    }

    setContent(code);
    setCopyLabel("Copy");
    setView("code");
  }, [assignments]);

  const openJSON = useCallback(() => {
    const json = JSON.stringify(assignments, null, 2);
    setContent(json);
    setCopyLabel("Copy");
    setView("json");
  }, [assignments]);

  const openImport = useCallback(() => {
    setImportText("");
    setView("import");
  }, []);

  const executeImport = useCallback(() => {
    try {
      const data = JSON.parse(importText) as Assignments;
      if (data.tiletype || data.glyph) {
        importJSON(data);
        showToast("Imported assignments successfully");
        setView(null);
      } else {
        showToast("JSON must contain 'tiletype' and/or 'glyph' fields");
      }
    } catch (e) {
      showToast("Invalid JSON: " + (e as Error).message);
    }
  }, [importText, importJSON, showToast]);

  const handleReset = useCallback(() => {
    if (!confirm("Reset all assignments to the defaults from glyph-sprite-map.ts?")) return;
    reset();
    showToast("Reset to defaults");
  }, [reset, showToast]);

  const openMasterSheet = useCallback(async () => {
    const sheetW = MASTER_GRID_W * TILE_SIZE;
    const sheetH = MASTER_GRID_H * TILE_SIZE;
    const canvas = document.createElement("canvas");
    canvas.width = sheetW;
    canvas.height = sheetH;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    type GridEntry = { x: number; y: number };
    const manifestObj = {
      tileSize: TILE_SIZE,
      gridWidth: MASTER_GRID_W,
      gridHeight: MASTER_GRID_H,
      tiles: {} as Record<string, GridEntry>,
      glyphs: {} as Record<string, GridEntry>,
    };

    let count = 0;

    for (let i = 0; i < TILE_TYPES.length; i++) {
      const name = TILE_TYPES[i]!;
      if (name === "NOTHING") continue;
      const ref = assignments.tiletype[name];
      if (!ref) continue;
      const pos = { x: i % MASTER_GRID_W, y: Math.floor(i / MASTER_GRID_W) };
      manifestObj.tiles[name] = pos;
      const img = await loadImage(ref.sheet);
      if (!img) continue;
      ctx.drawImage(
        img,
        ref.x * TILE_SIZE, ref.y * TILE_SIZE, TILE_SIZE, TILE_SIZE,
        pos.x * TILE_SIZE, pos.y * TILE_SIZE, TILE_SIZE, TILE_SIZE,
      );
      count++;
    }

    for (let i = 0; i < DISPLAY_GLYPHS.length; i++) {
      const name = DISPLAY_GLYPHS[i]!;
      const ref = assignments.glyph[name];
      if (!ref) continue;
      const slot = GLYPH_GRID_OFFSET + i;
      const pos = { x: slot % MASTER_GRID_W, y: Math.floor(slot / MASTER_GRID_W) };
      manifestObj.glyphs[name] = pos;
      const img = await loadImage(ref.sheet);
      if (!img) continue;
      ctx.drawImage(
        img,
        ref.x * TILE_SIZE, ref.y * TILE_SIZE, TILE_SIZE, TILE_SIZE,
        pos.x * TILE_SIZE, pos.y * TILE_SIZE, TILE_SIZE, TILE_SIZE,
      );
      count++;
    }

    const pngBlob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    const pngUrl = pngBlob ? URL.createObjectURL(pngBlob) : "#";
    const manifestJson = JSON.stringify(manifestObj, null, 2);
    setContent(manifestJson);
    setCopyLabel("Copy");

    setMasterSheetHtml(
      `<p>${count} sprites packed into ${sheetW}\u00D7${sheetH} master sheet ` +
      `(${MASTER_GRID_W}\u00D7${MASTER_GRID_H} grid).</p>` +
      `<p><a href="${pngUrl}" download="master-spritesheet.png" class="download-link">\u2B07 Download master-spritesheet.png</a></p>` +
      `<p class="dim-note">Place both files in <code>rogue-ts/assets/tilesets/</code></p>`,
    );
    setView("mastersheet");
  }, [assignments, loadImage]);

  const downloadManifest = useCallback(() => {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sprite-manifest.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [content]);

  const closeModal = useCallback((e?: React.MouseEvent) => {
    if (e && e.target !== e.currentTarget) return;
    setView(null);
  }, []);

  const title =
    view === "code" ? "Export \u2014 TypeScript Code"
      : view === "json" ? "Export \u2014 JSON"
        : view === "import" ? "Import JSON"
          : "Export \u2014 Master Sheet";

  return (
    <>
      <button onClick={openCode}>Export Code</button>
      <button onClick={openJSON}>Export JSON</button>
      <button className="primary" onClick={openMasterSheet}>
        Export Master Sheet
      </button>
      <button onClick={openImport}>Import JSON</button>
      <button onClick={handleReset}>Reset</button>

      {view && (
        <div className="modal-overlay show" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <span className="modal-title">{title}</span>
              <div className="spacer" />
              <button onClick={() => setView(null)}>Close</button>
              {view !== "import" && (
                <button className="primary" onClick={handleCopy}>
                  {copyLabel}
                </button>
              )}
            </header>
            <div className="modal-body">
              {view === "import" ? (
                <>
                  <textarea
                    placeholder="Paste JSON here..."
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                  />
                  <br />
                  <button className="primary" onClick={executeImport} style={{ marginTop: 8 }}>
                    Import
                  </button>
                </>
              ) : view === "mastersheet" ? (
                <>
                  <div dangerouslySetInnerHTML={{ __html: masterSheetHtml }} />
                  <button className="download-link" onClick={downloadManifest}>
                    &#11015; Download sprite-manifest.json
                  </button>
                </>
              ) : (
                <pre>{content}</pre>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
