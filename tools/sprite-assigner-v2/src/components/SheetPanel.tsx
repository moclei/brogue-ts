import { useApp } from "../state/app-state.ts";

export function SheetPanel() {
  const { state, setCurrentSheet } = useApp();
  const { manifest, currentSheetKey } = state;

  if (!manifest) {
    return (
      <aside className="sheet-panel">
        <p className="error-msg">Loading tileset manifest...</p>
      </aside>
    );
  }

  return (
    <aside className="sheet-panel">
      {manifest.tilesets.map((ts) => (
        <details key={ts.id} className="tileset-group" open>
          <summary>
            {ts.name} ({ts.sheets.length})
          </summary>
          {ts.sheets.map((sh) => (
            <button
              key={sh.key}
              className={`sheet-btn${sh.key === currentSheetKey ? " active" : ""}`}
              onClick={() => setCurrentSheet(sh.key)}
            >
              {sh.key}
              <span className="cat">{sh.category}</span>
            </button>
          ))}
        </details>
      ))}
    </aside>
  );
}
