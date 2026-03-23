import { useState, useMemo } from "react";
import { TILE_TYPES, DISPLAY_GLYPHS, GLYPH_CHARS } from "../data/tile-types.ts";
import { useAssignments, useAssignmentHelpers, type AssignmentTab } from "../state/assignments.ts";
import { useApp } from "../state/app-state.ts";
import { EnumEntry } from "./EnumEntry.tsx";

type FilterStatus = "all" | "assigned" | "unassigned";

export function EnumPanel() {
  const { state, setSelectedTile, setState, showToast } = useApp();
  const { selectedTile, activeTab } = state;
  const assignments = useAssignments();
  const { assign, unassign } = useAssignmentHelpers();
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");

  const setActiveTab = (tab: AssignmentTab) => {
    setState((s) => ({ ...s, activeTab: tab }));
    setFilter("");
  };

  const names = activeTab === "tiletype" ? TILE_TYPES : DISPLAY_GLYPHS;
  const assignMap = activeTab === "tiletype" ? assignments.tiletype : assignments.glyph;
  const isGlyph = activeTab === "glyph";

  const filteredNames = useMemo(() => {
    const lc = filter.toLowerCase();
    return names.filter((name) => {
      if (name === "NOTHING") return false;
      if (lc && !name.toLowerCase().includes(lc)) return false;
      const ref = assignMap[name];
      if (statusFilter === "assigned" && !ref) return false;
      if (statusFilter === "unassigned" && ref) return false;
      return true;
    });
  }, [names, filter, statusFilter, assignMap]);

  const handleAssign = (name: string) => {
    if (!selectedTile) return;
    assign(activeTab, name, {
      sheet: selectedTile.sheet,
      x: selectedTile.x,
      y: selectedTile.y,
    });
    showToast(`Assigned ${name} \u2192 ${selectedTile.sheet} (${selectedTile.x}, ${selectedTile.y})`);
  };

  const handleUnassign = (name: string) => {
    unassign(activeTab, name);
  };

  const handleJumpToSprite = (sheet: string, x: number, y: number) => {
    setSelectedTile({ sheet, x, y });
  };

  return (
    <aside className="enum-panel">
      <div className="enum-tabs">
        <button
          className={activeTab === "tiletype" ? "active" : ""}
          onClick={() => setActiveTab("tiletype")}
        >
          TileType
        </button>
        <button
          className={activeTab === "glyph" ? "active" : ""}
          onClick={() => setActiveTab("glyph")}
        >
          DisplayGlyph
        </button>
      </div>
      <div className="enum-filter">
        <input
          type="text"
          placeholder="Filter by name..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
        >
          <option value="all">All</option>
          <option value="assigned">Assigned</option>
          <option value="unassigned">Unassigned</option>
        </select>
      </div>
      <div className="enum-list">
        {filteredNames.map((name) => (
          <EnumEntry
            key={name}
            name={name}
            ascii={isGlyph ? GLYPH_CHARS[name] ?? "?" : undefined}
            ref_={assignMap[name] ?? null}
            isSameTile={
              selectedTile != null &&
              assignMap[name] != null &&
              assignMap[name]!.sheet === selectedTile.sheet &&
              assignMap[name]!.x === selectedTile.x &&
              assignMap[name]!.y === selectedTile.y
            }
            onAssign={() => handleAssign(name)}
            onUnassign={() => handleUnassign(name)}
            onJumpToSprite={handleJumpToSprite}
          />
        ))}
      </div>
    </aside>
  );
}
