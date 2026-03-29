import { useCallback } from "react";
import {
  CONNECTION_GROUPS,
  type ConnectionGroup,
} from "../data/autotile-groups.ts";
import {
  useAssignments,
  useAssignmentHelpers,
  type AutotileGroupConfig,
} from "../state/assignments.ts";
import { useApp } from "../state/app-state.ts";
import type { TilesetManifest } from "../data/sheet-manifest.ts";

interface SheetOption {
  label: string;
  path: string;
}

function collectSheetOptions(manifest: TilesetManifest | null): SheetOption[] {
  if (!manifest) return [];
  const opts: SheetOption[] = [];
  for (const ts of manifest.tilesets) {
    for (const s of ts.sheets) {
      opts.push({ label: `${s.key} (${ts.name})`, path: s.path });
    }
  }
  opts.sort((a, b) => a.label.localeCompare(b.label));
  return opts;
}

export function AutotilePanel() {
  const { state, showToast } = useApp();
  const assignments = useAssignments();
  const { setAutotileGroup, removeAutotileGroup } = useAssignmentHelpers();
  const sheetOptions = collectSheetOptions(state.manifest);

  const handleSheetChange = useCallback(
    (group: ConnectionGroup, path: string) => {
      if (!path) {
        removeAutotileGroup(group);
        showToast(`Cleared ${group} autotile sheet`);
        return;
      }
      const existing = assignments.autotile[group];
      setAutotileGroup(group, { sheet: path, format: existing?.format ?? "grid" });
      showToast(`${group} → ${path}`);
    },
    [assignments.autotile, setAutotileGroup, removeAutotileGroup, showToast],
  );

  const handleFormatChange = useCallback(
    (group: ConnectionGroup, format: string) => {
      const existing = assignments.autotile[group];
      if (!existing) return;
      setAutotileGroup(group, { ...existing, format });
      showToast(`${group} format → ${format}`);
    },
    [assignments.autotile, setAutotileGroup, showToast],
  );

  return (
    <div className="autotile-panel">
      <div className="autotile-header">
        <span style={{ fontWeight: 600 }}>Autotile Groups</span>
        <span className="autotile-stats">
          {Object.keys(assignments.autotile).length}/{CONNECTION_GROUPS.length}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 12px" }}>
        {CONNECTION_GROUPS.map((group) => (
          <AutotileGroupRow
            key={group}
            group={group}
            config={assignments.autotile[group]}
            sheetOptions={sheetOptions}
            onSheetChange={(path) => handleSheetChange(group, path)}
            onFormatChange={(fmt) => handleFormatChange(group, fmt)}
            onClear={() => { removeAutotileGroup(group); showToast(`Cleared ${group}`); }}
          />
        ))}
      </div>
    </div>
  );
}

function AutotileGroupRow({
  group,
  config,
  sheetOptions,
  onSheetChange,
  onFormatChange,
  onClear,
}: {
  group: ConnectionGroup;
  config?: AutotileGroupConfig;
  sheetOptions: SheetOption[];
  onSheetChange: (path: string) => void;
  onFormatChange: (format: string) => void;
  onClear: () => void;
}) {
  const currentPath = config?.sheet ?? "";

  return (
    <div className={`autotile-group-row${config ? " assigned" : ""}`}>
      <span className="autotile-group-name">{group}</span>
      <select
        className="autotile-sheet-select"
        value={currentPath}
        onChange={(e) => onSheetChange(e.target.value)}
      >
        <option value="">— none —</option>
        {sheetOptions.map((opt) => (
          <option key={opt.path} value={opt.path}>{opt.label}</option>
        ))}
        {currentPath && !sheetOptions.some((o) => o.path === currentPath) && (
          <option value={currentPath}>{currentPath}</option>
        )}
      </select>
      <select
        className="autotile-format-select"
        value={config?.format ?? "grid"}
        onChange={(e) => onFormatChange(e.target.value)}
        disabled={!config}
      >
        <option value="grid">grid (8×6)</option>
        <option value="wang">wang (7×7)</option>
      </select>
      {config && (
        <button
          className="autotile-clear-btn"
          onClick={onClear}
          title={`Clear ${group} assignment`}
        >
          ×
        </button>
      )}
    </div>
  );
}
