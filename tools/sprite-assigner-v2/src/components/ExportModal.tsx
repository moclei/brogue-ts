import { useState, useCallback } from "react";
import { TILE_TYPES, DISPLAY_GLYPHS } from "../data/tile-types.ts";
import { useAssignments, useAssignmentHelpers, type Assignments } from "../state/assignments.ts";
import { useApp } from "../state/app-state.ts";

type ModalView = "code" | "json" | "import" | null;

export function ExportModal() {
  const [view, setView] = useState<ModalView>(null);
  const [content, setContent] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copy");
  const [importText, setImportText] = useState("");
  const [saving, setSaving] = useState(false);
  const assignments = useAssignments();
  const { importJSON, reset } = useAssignmentHelpers();
  const { showToast } = useApp();

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

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const resp = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assignments),
      });
      const result = await resp.json() as {
        ok: boolean;
        tileCount?: number;
        glyphCount?: number;
        error?: string;
      };
      if (result.ok) {
        showToast(`Saved: ${result.tileCount} tiles, ${result.glyphCount} glyphs`);
      } else {
        showToast(`Save failed: ${result.error ?? "unknown error"}`);
      }
    } catch (err) {
      showToast(`Save failed: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  }, [assignments, showToast]);

  const closeModal = useCallback((e?: React.MouseEvent) => {
    if (e && e.target !== e.currentTarget) return;
    setView(null);
  }, []);

  const title =
    view === "code" ? "Export \u2014 TypeScript Code"
      : view === "json" ? "Export \u2014 JSON"
        : "Import JSON";

  return (
    <>
      <button className="primary" onClick={handleSave} disabled={saving}>
        {saving ? "Saving\u2026" : "Save to Disk"}
      </button>
      <button onClick={openCode}>Export Code</button>
      <button onClick={openJSON}>Export JSON</button>
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
