import { useState } from "react";
import { useApp } from "../state/app-state.ts";
import { saveTilesetManifest } from "../data/sheet-manifest.ts";
import type { TilesetDef, TilesetManifest } from "../data/sheet-manifest.ts";
import { AddSheetDialog, AddGroupDialog } from "./SheetManager.tsx";

export function SheetPanel() {
  const { state, setState, setCurrentSheet, showToast } = useApp();
  const { manifest, currentSheetKey } = state;
  const [addSheetGroup, setAddSheetGroup] = useState<TilesetDef | null>(null);
  const [showAddGroup, setShowAddGroup] = useState(false);

  if (!manifest) {
    return (
      <aside className="sheet-panel">
        <p className="error-msg">Loading tileset manifest...</p>
      </aside>
    );
  }

  function updateManifest(updated: TilesetManifest) {
    setState(s => ({ ...s, manifest: updated }));
    saveTilesetManifest(updated).catch(err => {
      console.error("Failed to save manifest:", err);
      showToast("Failed to save manifest");
    });
  }

  function handleSheetAdded() {
    setAddSheetGroup(null);
    fetch("/api/tileset-manifest")
      .then(r => r.json() as Promise<TilesetManifest>)
      .then(m => {
        setState(s => ({ ...s, manifest: m }));
        showToast("Sheet added");
      })
      .catch(err => console.error("Failed to reload manifest:", err));
  }

  function handleGroupCreated(updated: TilesetManifest) {
    setShowAddGroup(false);
    updateManifest(updated);
    showToast("Group created");
  }

  function removeSheet(groupId: string, key: string) {
    if (!manifest) return;
    updateManifest({
      ...manifest,
      tilesets: manifest.tilesets.map(g =>
        g.id === groupId
          ? { ...g, sheets: g.sheets.filter(s => s.key !== key) }
          : g,
      ),
    });
    showToast(`Removed ${key}`);
  }

  function removeGroup(groupId: string) {
    if (!manifest) return;
    const group = manifest.tilesets.find(g => g.id === groupId);
    if (group && group.sheets.length > 0) {
      if (!confirm(`Delete "${group.name}" and its ${group.sheets.length} sheet(s)?`)) return;
    }
    updateManifest({
      ...manifest,
      tilesets: manifest.tilesets.filter(g => g.id !== groupId),
    });
    showToast(`Removed group ${group?.name ?? groupId}`);
  }

  return (
    <aside className="sheet-panel">
      {manifest.tilesets.map((ts) => (
        <details key={ts.id} className="tileset-group" open>
          <summary>
            <span className="group-name">{ts.name}</span>
            <span className="group-count">{ts.sheets.length}</span>
            <button
              className="mgr-icon-btn mgr-add-sheet"
              title={`Add sheet to ${ts.name}`}
              onClick={(e) => { e.preventDefault(); setAddSheetGroup(ts); }}
            >+</button>
            <button
              className="mgr-icon-btn mgr-remove-group"
              title={`Remove ${ts.name}`}
              onClick={(e) => { e.preventDefault(); removeGroup(ts.id); }}
            >×</button>
          </summary>
          {ts.sheets.map((sh) => (
            <div key={sh.key} className="sheet-row">
              <button
                className={`sheet-btn${sh.key === currentSheetKey ? " active" : ""}`}
                onClick={() => setCurrentSheet(sh.key)}
              >
                {sh.key}
                <span className="cat">{sh.category}</span>
              </button>
              <button
                className="mgr-icon-btn mgr-remove-sheet"
                title={`Remove ${sh.key}`}
                onClick={() => removeSheet(ts.id, sh.key)}
              >×</button>
            </div>
          ))}
        </details>
      ))}
      <button
        className="mgr-add-group-btn"
        onClick={() => setShowAddGroup(true)}
        title="Create new tileset group"
      >
        <span className="mgr-plus">+</span> New Group
      </button>
      {addSheetGroup && (
        <AddSheetDialog
          group={addSheetGroup}
          manifest={manifest}
          onClose={() => setAddSheetGroup(null)}
          onAdded={handleSheetAdded}
        />
      )}
      {showAddGroup && (
        <AddGroupDialog
          manifest={manifest}
          onClose={() => setShowAddGroup(false)}
          onCreated={handleGroupCreated}
        />
      )}
    </aside>
  );
}
