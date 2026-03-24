import { useState, useRef } from "react";
import type { TilesetManifest, TilesetDef } from "../data/sheet-manifest.ts";
import { uploadSheet } from "../data/sheet-manifest.ts";

// ---------------------------------------------------------------------------
// AddSheetDialog — modal for adding a new sprite sheet to a group
// ---------------------------------------------------------------------------

const CATEGORIES = ["terrain", "creature", "item", "feature", "effect", "ui", "all"] as const;

interface AddSheetDialogProps {
  group: TilesetDef;
  manifest: TilesetManifest;
  onClose: () => void;
  onAdded: () => void;
}

export function AddSheetDialog({ group, manifest, onClose, onAdded }: AddSheetDialogProps) {
  const [key, setKey] = useState("");
  const [category, setCategory] = useState<string>("terrain");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f) {
      if (!key) setKey(f.name.replace(/\.png$/i, ""));
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
  }

  function inferSubpath(): string {
    const groupFolder = group.id.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
    const existing = manifest.tilesets.find(g => g.id === group.id);
    if (existing && existing.sheets.length > 0) {
      const first = existing.sheets[0]!.path;
      const dir = first.substring(0, first.lastIndexOf("/") + 1);
      if (dir) return dir + (file?.name ?? `${key}.png`);
    }
    return `${groupFolder}/${file?.name ?? `${key}.png`}`;
  }

  const existingKeys = new Set(manifest.tilesets.flatMap(g => g.sheets.map(s => s.key)));
  const keyConflict = key !== "" && existingKeys.has(key);
  const canSubmit = key !== "" && file !== null && !keyConflict && !saving;

  async function handleSubmit() {
    if (!canSubmit || !file) return;
    setSaving(true);
    setError(null);
    try {
      await uploadSheet(file, {
        groupId: group.id,
        key,
        category,
        subpath: inferSubpath(),
      });
      onAdded();
    } catch (err: unknown) {
      setError(String(err));
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal sheet-mgr-modal" onClick={e => e.stopPropagation()}>
        <header>
          <span className="modal-title">Add Sheet to {group.name}</span>
          <div className="spacer" />
          <button onClick={onClose}>Close</button>
        </header>
        <div className="modal-body">
          <div className="mgr-field">
            <label>PNG File</label>
            <div className="mgr-file-row">
              <button onClick={() => fileRef.current?.click()}>
                {file ? file.name : "Choose file…"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".png"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
            </div>
            {preview && (
              <img src={preview} className="mgr-preview" alt="Sheet preview" />
            )}
          </div>
          <div className="mgr-field">
            <label>Key <span className="dim-note">(unique identifier)</span></label>
            <input
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="e.g. MyTerrain"
              className={keyConflict ? "mgr-error-input" : ""}
            />
            {keyConflict && <span className="mgr-error">Key already exists</span>}
          </div>
          <div className="mgr-field">
            <label>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="mgr-field">
            <label>Path <span className="dim-note">(in tilesets dir)</span></label>
            <input value={inferSubpath()} disabled className="mgr-path-preview" />
          </div>
          {error && <div className="mgr-error">{error}</div>}
          <div className="mgr-actions">
            <button onClick={onClose}>Cancel</button>
            <button className="primary" disabled={!canSubmit} onClick={handleSubmit}>
              {saving ? "Uploading…" : "Add Sheet"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddGroupDialog — modal for creating a new tileset group
// ---------------------------------------------------------------------------

interface AddGroupDialogProps {
  manifest: TilesetManifest;
  onClose: () => void;
  onCreated: (manifest: TilesetManifest) => void;
}

export function AddGroupDialog({ manifest, onClose, onCreated }: AddGroupDialogProps) {
  const [name, setName] = useState("");
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const existingIds = new Set(manifest.tilesets.map(g => g.id));
  const idConflict = id !== "" && existingIds.has(id);
  const canSubmit = name.trim() !== "" && id !== "" && !idConflict;

  function handleSubmit() {
    if (!canSubmit) return;
    const updated: TilesetManifest = {
      ...manifest,
      tilesets: [...manifest.tilesets, { id, name: name.trim(), sheets: [] }],
    };
    onCreated(updated);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal sheet-mgr-modal mgr-small" onClick={e => e.stopPropagation()}>
        <header>
          <span className="modal-title">New Tileset Group</span>
          <div className="spacer" />
          <button onClick={onClose}>Close</button>
        </header>
        <div className="modal-body">
          <div className="mgr-field">
            <label>Group Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. My Custom Tiles"
              autoFocus
              onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
            />
          </div>
          {id && (
            <div className="mgr-field">
              <label>ID <span className="dim-note">(auto-generated)</span></label>
              <input
                value={id}
                disabled
                className={idConflict ? "mgr-error-input" : "mgr-path-preview"}
              />
              {idConflict && <span className="mgr-error">Group ID already exists</span>}
            </div>
          )}
          <div className="mgr-actions">
            <button onClick={onClose}>Cancel</button>
            <button className="primary" disabled={!canSubmit} onClick={handleSubmit}>
              Create Group
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
