export interface SheetDef {
  key: string;
  path: string;
  category: string;
}

export interface TilesetDef {
  id: string;
  name: string;
  sheets: SheetDef[];
}

export interface TilesetManifest {
  tileSize: number;
  basePath: string;
  tilesets: TilesetDef[];
}

export async function loadTilesetManifest(): Promise<TilesetManifest> {
  const resp = await fetch("/api/tileset-manifest");
  if (!resp.ok) throw new Error(`Failed to load tileset manifest: ${resp.status}`);
  return resp.json() as Promise<TilesetManifest>;
}

export async function saveTilesetManifest(manifest: TilesetManifest): Promise<void> {
  const resp = await fetch("/api/tileset-manifest", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(manifest),
  });
  if (!resp.ok) throw new Error(`Failed to save tileset manifest: ${resp.status}`);
}

export async function uploadSheet(
  file: File,
  meta: { groupId: string; key: string; category: string; subpath: string },
): Promise<void> {
  const form = new FormData();
  form.append("file", file);
  form.append("meta", JSON.stringify(meta));
  const resp = await fetch("/api/upload-sheet", { method: "POST", body: form });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Upload failed" }));
    throw new Error((err as { error: string }).error);
  }
}

/**
 * The manifest's basePath is relative to the old tool directory.
 * We proxy all tileset images through /tilesets/ in the Vite config,
 * so we rewrite the basePath-relative URL to use the proxy prefix.
 */
export function sheetImageUrl(_manifest: TilesetManifest, sheetDef: SheetDef): string {
  return "/tilesets/" + sheetDef.path;
}

export function findSheetDef(manifest: TilesetManifest, key: string): SheetDef | null {
  for (const ts of manifest.tilesets) {
    const s = ts.sheets.find((sh) => sh.key === key);
    if (s) return s;
  }
  return null;
}

export function findTilesetForSheet(manifest: TilesetManifest, key: string): TilesetDef | null {
  return manifest.tilesets.find((ts) => ts.sheets.some((s) => s.key === key)) ?? null;
}
