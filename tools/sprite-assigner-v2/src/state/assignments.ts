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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpriteRef {
  sheet: string;
  x: number;
  y: number;
}

export interface Assignments {
  tiletype: Record<string, SpriteRef>;
  glyph: Record<string, SpriteRef>;
}

export type AssignmentTab = "tiletype" | "glyph";

export interface AssignmentStats {
  tileTypeAssigned: number;
  tileTypeTotal: number;
  glyphAssigned: number;
  glyphTotal: number;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type Action =
  | { type: "assign"; tab: AssignmentTab; name: string; ref: SpriteRef }
  | { type: "unassign"; tab: AssignmentTab; name: string }
  | { type: "reset" }
  | { type: "importJSON"; data: Assignments }
  | { type: "loadFromManifest"; data: Assignments };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function reducer(state: Assignments, action: Action): Assignments {
  switch (action.type) {
    case "assign": {
      const map = { ...state[action.tab], [action.name]: action.ref };
      return { ...state, [action.tab]: map };
    }
    case "unassign": {
      const map = { ...state[action.tab] };
      delete map[action.name];
      return { ...state, [action.tab]: map };
    }
    case "reset":
      return {
        tiletype: getInitialTileTypeAssignments(),
        glyph: getInitialGlyphAssignments(),
      };
    case "importJSON":
    case "loadFromManifest":
      return {
        tiletype: action.data.tiletype ?? {},
        glyph: action.data.glyph ?? {},
      };
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
      if (data.tiletype && data.glyph) return data;
    }
  } catch { /* fall through */ }
  return {
    tiletype: getInitialTileTypeAssignments(),
    glyph: getInitialGlyphAssignments(),
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
  return {
    tileTypeAssigned: Object.keys(state.tiletype).length,
    tileTypeTotal: ttTotal,
    glyphAssigned: Object.keys(state.glyph).length,
    glyphTotal: DISPLAY_GLYPHS.length,
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

  return { assign, unassign, reset, importJSON };
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
