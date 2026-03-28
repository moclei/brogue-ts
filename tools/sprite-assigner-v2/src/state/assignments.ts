import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  type Dispatch,
  type ReactNode,
  createElement,
} from "react";
import { TILE_TYPES, DISPLAY_GLYPHS } from "../data/tile-types.ts";
import {
  getInitialTileTypeAssignments,
  getInitialGlyphAssignments,
} from "../data/initial-assignments.ts";
import {
  AUTOTILE_VARIANT_COUNT,
  WANG_BLOB_COLS,
  WANG_BLOB_ROWS,
  wangBlobCellToVariant,
  type ConnectionGroup,
} from "../data/autotile-groups.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpriteRef {
  sheet: string;
  x: number;
  y: number;
}

export type AutotileVariants = (SpriteRef | null)[];

export interface Assignments {
  tiletype: Record<string, SpriteRef>;
  glyph: Record<string, SpriteRef>;
  autotile: Record<string, AutotileVariants>;
}

export type AssignmentTab = "tiletype" | "glyph" | "autotile";

export interface AssignmentStats {
  tileTypeAssigned: number;
  tileTypeTotal: number;
  glyphAssigned: number;
  glyphTotal: number;
  autotileGroups: number;
  autotileVariantsAssigned: number;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type Action =
  | { type: "assign"; tab: AssignmentTab; name: string; ref: SpriteRef }
  | { type: "unassign"; tab: AssignmentTab; name: string }
  | { type: "reset" }
  | { type: "importJSON"; data: Assignments }
  | { type: "loadFromManifest"; data: Assignments }
  | { type: "assignVariant"; group: ConnectionGroup; index: number; ref: SpriteRef }
  | { type: "unassignVariant"; group: ConnectionGroup; index: number }
  | { type: "resetGroup"; group: ConnectionGroup }
  | { type: "importWangBlob"; group: ConnectionGroup; sheetKey: string };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function ensureVariants(state: Assignments, group: string): AutotileVariants {
  return state.autotile[group] ?? new Array(AUTOTILE_VARIANT_COUNT).fill(null);
}

function reducer(state: Assignments, action: Action): Assignments {
  switch (action.type) {
    case "assign": {
      if (action.tab === "autotile") return state;
      const map = { ...state[action.tab], [action.name]: action.ref };
      return { ...state, [action.tab]: map };
    }
    case "unassign": {
      if (action.tab === "autotile") return state;
      const map = { ...state[action.tab] };
      delete map[action.name];
      return { ...state, [action.tab]: map };
    }
    case "reset":
      return {
        tiletype: getInitialTileTypeAssignments(),
        glyph: getInitialGlyphAssignments(),
        autotile: {},
      };
    case "importJSON":
    case "loadFromManifest":
      return {
        tiletype: action.data.tiletype ?? {},
        glyph: action.data.glyph ?? {},
        autotile: action.data.autotile ?? {},
      };
    case "assignVariant": {
      const variants = [...ensureVariants(state, action.group)];
      variants[action.index] = action.ref;
      return { ...state, autotile: { ...state.autotile, [action.group]: variants } };
    }
    case "unassignVariant": {
      const variants = [...ensureVariants(state, action.group)];
      variants[action.index] = null;
      return { ...state, autotile: { ...state.autotile, [action.group]: variants } };
    }
    case "resetGroup": {
      const autotile = { ...state.autotile };
      delete autotile[action.group];
      return { ...state, autotile };
    }
    case "importWangBlob": {
      const variants: AutotileVariants = new Array(AUTOTILE_VARIANT_COUNT).fill(null);
      for (let row = 0; row < WANG_BLOB_ROWS; row++) {
        for (let col = 0; col < WANG_BLOB_COLS; col++) {
          const variantIdx = wangBlobCellToVariant(col, row);
          if (variantIdx < 0) continue;
          variants[variantIdx] = { sheet: action.sheetKey, x: col, y: row };
        }
      }
      return { ...state, autotile: { ...state.autotile, [action.group]: variants } };
    }
  }
}

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = "broguece-sprite-assignments";

function loadFromStorage(): Assignments {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved) as Assignments;
      if (data.tiletype && data.glyph) {
        return { ...data, autotile: data.autotile ?? {} };
      }
    }
  } catch { /* fall through */ }
  return {
    tiletype: getInitialTileTypeAssignments(),
    glyph: getInitialGlyphAssignments(),
    autotile: {},
  };
}

function saveToStorage(state: Assignments): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

const SKIP_TILE_TYPES = new Set(["NOTHING", "NUMBER_TILETYPES"]);

export function computeStats(state: Assignments): AssignmentStats {
  const ttTotal = TILE_TYPES.filter((n) => !SKIP_TILE_TYPES.has(n)).length;
  let autotileGroups = 0;
  let autotileVariantsAssigned = 0;
  for (const variants of Object.values(state.autotile)) {
    const assigned = variants.filter((v) => v !== null).length;
    if (assigned > 0) autotileGroups++;
    autotileVariantsAssigned += assigned;
  }
  return {
    tileTypeAssigned: Object.keys(state.tiletype).length,
    tileTypeTotal: ttTotal,
    glyphAssigned: Object.keys(state.glyph).length,
    glyphTotal: DISPLAY_GLYPHS.length,
    autotileGroups,
    autotileVariantsAssigned,
  };
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AssignmentContext = createContext<Assignments | null>(null);
const DispatchContext = createContext<Dispatch<Action> | null>(null);

export function useAssignments(): Assignments {
  const ctx = useContext(AssignmentContext);
  if (!ctx) throw new Error("useAssignments must be used within AssignmentProvider");
  return ctx;
}

export function useAssignmentDispatch(): Dispatch<Action> {
  const ctx = useContext(DispatchContext);
  if (!ctx) throw new Error("useAssignmentDispatch must be used within AssignmentProvider");
  return ctx;
}

export function useAssignmentHelpers() {
  const dispatch = useAssignmentDispatch();

  const assign = useCallback(
    (tab: AssignmentTab, name: string, ref: SpriteRef) =>
      dispatch({ type: "assign", tab, name, ref }),
    [dispatch],
  );

  const unassign = useCallback(
    (tab: AssignmentTab, name: string) =>
      dispatch({ type: "unassign", tab, name }),
    [dispatch],
  );

  const reset = useCallback(() => dispatch({ type: "reset" }), [dispatch]);

  const importJSON = useCallback(
    (data: Assignments) => dispatch({ type: "importJSON", data }),
    [dispatch],
  );

  const assignVariant = useCallback(
    (group: ConnectionGroup, index: number, ref: SpriteRef) =>
      dispatch({ type: "assignVariant", group, index, ref }),
    [dispatch],
  );

  const unassignVariant = useCallback(
    (group: ConnectionGroup, index: number) =>
      dispatch({ type: "unassignVariant", group, index }),
    [dispatch],
  );

  const resetGroup = useCallback(
    (group: ConnectionGroup) =>
      dispatch({ type: "resetGroup", group }),
    [dispatch],
  );

  const importWangBlob = useCallback(
    (group: ConnectionGroup, sheetKey: string) =>
      dispatch({ type: "importWangBlob", group, sheetKey }),
    [dispatch],
  );

  return { assign, unassign, reset, importJSON, assignVariant, unassignVariant, resetGroup, importWangBlob };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AssignmentProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, null, loadFromStorage);

  // On mount, try to load assignments from the backend (disk).
  // Falls back to the already-loaded localStorage state if unavailable.
  useEffect(() => {
    fetch("/api/assignments")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && (data as Assignments).tiletype) {
          dispatch({ type: "loadFromManifest", data: data as Assignments });
        }
      })
      .catch(() => { /* backend unavailable — keep localStorage state */ });
  }, []);

  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  return createElement(
    AssignmentContext.Provider,
    { value: state },
    createElement(DispatchContext.Provider, { value: dispatch }, children),
  );
}
