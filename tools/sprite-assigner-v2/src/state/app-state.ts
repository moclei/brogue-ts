import { createContext, useContext, type Dispatch, type SetStateAction } from "react";
import type { TilesetManifest } from "../data/sheet-manifest.ts";

// ---------------------------------------------------------------------------
// Selected tile (shared between GridPanel and EnumPanel)
// ---------------------------------------------------------------------------

export interface SelectedTile {
  sheet: string;
  x: number;
  y: number;
  /** Tile span width for multi-tile glyph selections (defaults to 1). */
  w?: number;
  /** Tile span height for multi-tile glyph selections (defaults to 1). */
  h?: number;
}

// ---------------------------------------------------------------------------
// Image cache — shared across components for loaded sheet images
// ---------------------------------------------------------------------------

export type ImageCache = Map<string, HTMLImageElement>;

// ---------------------------------------------------------------------------
// App-level context (non-assignment UI state)
// ---------------------------------------------------------------------------

export interface AppState {
  manifest: TilesetManifest | null;
  imageCache: ImageCache;
  currentSheetKey: string | null;
  selectedTile: SelectedTile | null;
  activeTab: "tiletype" | "glyph" | "autotile";
  zoom: number;
  toastMessage: string | null;
}

export const initialAppState: AppState = {
  manifest: null,
  imageCache: new Map(),
  currentSheetKey: null,
  selectedTile: null,
  activeTab: "tiletype",
  zoom: 3,
  toastMessage: null,
};

// We use a simple setState-based approach since this state has many independent
// fields that update at different rates. A full reducer would add ceremony
// without benefit here.

export interface AppActions {
  state: AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  setCurrentSheet: (key: string) => void;
  setSelectedTile: (tile: SelectedTile | null) => void;
  setActiveTab: (tab: "tiletype" | "glyph" | "autotile") => void;
  setZoom: (zoom: number) => void;
  showToast: (msg: string) => void;
  loadImage: (key: string) => Promise<HTMLImageElement | null>;
}

export const AppContext = createContext<AppActions | null>(null);

export function useApp(): AppActions {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppContext.Provider");
  return ctx;
}
