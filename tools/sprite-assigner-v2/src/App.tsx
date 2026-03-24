import { useState, useEffect, useCallback, useRef } from "react";
import {
  AssignmentProvider,
  useAssignments,
  computeStats,
} from "./state/assignments.ts";
import {
  AppContext,
  initialAppState,
  type AppState,
  type SelectedTile,
  type AppActions,
} from "./state/app-state.ts";
import {
  loadTilesetManifest,
  findSheetDef,
  sheetImageUrl,
} from "./data/sheet-manifest.ts";
import { SheetPanel } from "./components/SheetPanel.tsx";
import { GridPanel } from "./components/GridPanel.tsx";
import { EnumPanel } from "./components/EnumPanel.tsx";
import { ExportModal } from "./components/ExportModal.tsx";
import "./styles.css";

function AppInner() {
  const [state, setState] = useState<AppState>(initialAppState);
  const assignments = useAssignments();
  const stats = computeStats(assignments);
  const toastTimerRef = useRef<number>(0);

  // Load manifest on mount
  useEffect(() => {
    loadTilesetManifest().then((manifest) => {
      setState((s) => ({ ...s, manifest }));
      // Auto-select first sheet
      const first = manifest.tilesets[0]?.sheets[0];
      if (first) {
        const img = new Image();
        img.onload = () => {
          setState((s) => {
            const cache = new Map(s.imageCache);
            cache.set(first.key, img);
            return { ...s, currentSheetKey: first.key, imageCache: cache };
          });
        };
        img.src = sheetImageUrl(manifest, first);
      }
    }).catch((err) => {
      console.error("Failed to load manifest:", err);
    });
  }, []);

  const loadImage = useCallback(
    async (key: string): Promise<HTMLImageElement | null> => {
      const cached = state.imageCache.get(key);
      if (cached) return cached;
      const manifest = state.manifest;
      if (!manifest) return null;
      const def = findSheetDef(manifest, key);
      if (!def) return null;
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          setState((s) => {
            const cache = new Map(s.imageCache);
            cache.set(key, img);
            return { ...s, imageCache: cache };
          });
          resolve(img);
        };
        img.onerror = () => resolve(null);
        img.src = sheetImageUrl(manifest, def);
      });
    },
    [state.imageCache, state.manifest],
  );

  const setCurrentSheet = useCallback(
    (key: string) => {
      setState((s) => ({ ...s, currentSheetKey: key, selectedTile: null }));
      loadImage(key);
    },
    [loadImage],
  );

  const setSelectedTile = useCallback((tile: SelectedTile | null) => {
    setState((s) => ({ ...s, selectedTile: tile }));
    // If selecting a tile on a different sheet, switch to that sheet
    if (tile && tile.sheet !== state.currentSheetKey) {
      setState((s) => ({ ...s, currentSheetKey: tile.sheet, selectedTile: tile }));
      loadImage(tile.sheet);
    }
  }, [state.currentSheetKey, loadImage]);

  const setActiveTab = useCallback((tab: "tiletype" | "glyph" | "autotile") => {
    setState((s) => ({ ...s, activeTab: tab }));
  }, []);

  const setZoom = useCallback((z: number) => {
    setState((s) => ({ ...s, zoom: Math.max(1, Math.min(8, z)) }));
  }, []);

  const showToast = useCallback((msg: string) => {
    setState((s) => ({ ...s, toastMessage: msg }));
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setState((s) => ({ ...s, toastMessage: null }));
    }, 2000);
  }, []);

  // Keyboard handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setState((s) => ({ ...s, selectedTile: null }));
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const actions: AppActions = {
    state,
    setState,
    setCurrentSheet,
    setSelectedTile,
    setActiveTab,
    setZoom,
    showToast,
    loadImage,
  };

  return (
    <AppContext.Provider value={actions}>
      <header className="app-header">
        <h1>BrogueCE Sprite Assigner</h1>
        <div className="spacer" />
        <span className="stats">
          {stats.tileTypeAssigned}/{stats.tileTypeTotal} TileType,{" "}
          {stats.glyphAssigned}/{stats.glyphTotal} Glyph,{" "}
          {stats.autotileVariantsAssigned} autotile variants ({stats.autotileGroups} groups)
        </span>
        <ExportModal />
      </header>
      <main className="app-main">
        <SheetPanel />
        <GridPanel />
        <EnumPanel />
      </main>
      <div className={`toast${state.toastMessage ? " show" : ""}`}>
        {state.toastMessage}
      </div>
    </AppContext.Provider>
  );
}

export function App() {
  return (
    <AssignmentProvider>
      <AppInner />
    </AssignmentProvider>
  );
}
