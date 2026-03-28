import {
  CONNECTION_GROUPS,
  type ConnectionGroup,
} from "../data/autotile-groups.ts";
import { useAssignments } from "../state/assignments.ts";

/**
 * Bridge UI for autotile — shows read-only per-group config.
 * Phase 4 replaces this with a full per-group sheet+format assignment UI.
 */
export function AutotilePanel() {
  const assignments = useAssignments();

  return (
    <div className="autotile-panel">
      <div className="autotile-header">
        <span style={{ fontWeight: 600 }}>Autotile Groups</span>
      </div>
      <div style={{ padding: "8px 12px", fontSize: 13, color: "#aaa" }}>
        Per-group sheet assignment UI coming in Phase 4.
        Current config is read-only here; edit assignments.json directly if needed.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 12px" }}>
        {CONNECTION_GROUPS.map((group) => {
          const config = assignments.autotile[group];
          return (
            <AutotileGroupRow key={group} group={group} sheet={config?.sheet} format={config?.format} />
          );
        })}
      </div>
    </div>
  );
}

function AutotileGroupRow({
  group,
  sheet,
  format,
}: {
  group: ConnectionGroup;
  sheet?: string;
  format?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        background: sheet ? "#1a1a2e" : "#111",
        borderRadius: 4,
        border: sheet ? "1px solid #333" : "1px solid #222",
      }}
    >
      <span style={{ fontWeight: 600, minWidth: 60, color: sheet ? "#e0e0e0" : "#666" }}>
        {group}
      </span>
      {sheet ? (
        <>
          <span style={{ color: "#8ab4f8", fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {sheet}
          </span>
          <span style={{
            fontSize: 11,
            padding: "1px 6px",
            borderRadius: 3,
            background: format === "wang" ? "#2d1b4e" : "#1b3a2e",
            color: format === "wang" ? "#c084fc" : "#6ee7b7",
          }}>
            {format ?? "?"}
          </span>
        </>
      ) : (
        <span style={{ color: "#555", fontSize: 12, fontStyle: "italic" }}>not assigned</span>
      )}
    </div>
  );
}
