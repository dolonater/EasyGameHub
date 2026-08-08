export type SidebarGroup = "games" | "steam" | "system" | "plugins";

export interface SidebarOrderState {
  all: string[];
  games: string[];
  steam: string[];
  system: string[];
  plugins: string[];
}

const ORDER_KEY = "doona-sidebar-order-v1";
const DRAG_REORDER_KEY = "doona-sidebar-drag-reorder";
const VISIBILITY_KEY = "doona-sidebar-visibility-v1";
const VISIBILITY_EVENT = "doona-sidebar-visibility-change";
const ALWAYS_VISIBLE_KEYS = new Set(["settings"]);

export const DEFAULT_SIDEBAR_ORDER: SidebarOrderState = {
  all: ["library", "playtime", "screenshots", "games", "steam", "settings"],
  games: ["library", "playtime", "screenshots", "games"],
  steam: ["steam"],
  system: ["settings"],
  plugins: [],
};

function cloneDefaultOrder(): SidebarOrderState {
  return {
    all: [...DEFAULT_SIDEBAR_ORDER.all],
    games: [...DEFAULT_SIDEBAR_ORDER.games],
    steam: [...DEFAULT_SIDEBAR_ORDER.steam],
    system: [...DEFAULT_SIDEBAR_ORDER.system],
    plugins: [...DEFAULT_SIDEBAR_ORDER.plugins],
  };
}

function readJson(): Partial<SidebarOrderState> | null {
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Partial<SidebarOrderState>;
  } catch {
    return null;
  }
}

function normalizeGroup(values: unknown, fallback: string[]) {
  const base = new Set(fallback);
  const next: string[] = [];

  if (Array.isArray(values)) {
    for (const value of values) {
      if (typeof value === "string" && value && base.has(value) && !next.includes(value)) {
        next.push(value);
      }
    }
  }

  for (const value of fallback) {
    if (!next.includes(value)) {
      next.push(value);
    }
  }

  return next;
}

export function getSidebarOrder(): SidebarOrderState {
  const stored = readJson();
  const games = normalizeGroup(stored?.games, DEFAULT_SIDEBAR_ORDER.games);
  const steam = normalizeGroup(stored?.steam, DEFAULT_SIDEBAR_ORDER.steam);
  const system = normalizeGroup(stored?.system, DEFAULT_SIDEBAR_ORDER.system);
  const plugins = Array.isArray(stored?.plugins)
    ? stored!.plugins.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
  // Default group order: 游戏 → Steam → 插件 → 系统. Plugin keys go above
  // settings so a fresh install renders the system group last.
  const fallbackAll = [...games, ...steam, ...plugins, ...system];

  return {
    all: normalizeGroup(stored?.all, fallbackAll),
    games,
    steam,
    system,
    plugins,
  };
}

export function setSidebarOrder(order: SidebarOrderState) {
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(order));
  } catch {}
}

export function resetSidebarOrder() {
  const next = cloneDefaultOrder();
  setSidebarOrder(next);
  return next;
}

export function getSidebarDragReorderEnabled(): boolean {
  try {
    return localStorage.getItem(DRAG_REORDER_KEY) === "true";
  } catch {
    return false;
  }
}

export function setSidebarDragReorderEnabled(value: boolean) {
  try {
    localStorage.setItem(DRAG_REORDER_KEY, String(value));
  } catch {}
}

export function onSidebarDragReorderChange(cb: () => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === DRAG_REORDER_KEY) cb();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

export function onSidebarOrderChange(cb: () => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === ORDER_KEY) cb();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

function defaultVisibility() {
  const entries = Object.values(DEFAULT_SIDEBAR_ORDER)
    .flat()
    .map((key) => [key, true] as const);
  return Object.fromEntries(entries) as Record<string, boolean>;
}

function readVisibilityJson(): Record<string, boolean> | null {
  try {
    const raw = localStorage.getItem(VISIBILITY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, boolean>;
  } catch {
    return null;
  }
}

export function getSidebarVisibility(): Record<string, boolean> {
  const next = defaultVisibility();
  const stored = readVisibilityJson();

  if (stored) {
    for (const [key, value] of Object.entries(stored)) {
      if (typeof value === "boolean") {
        next[key] = value;
      }
    }
  }

  for (const key of ALWAYS_VISIBLE_KEYS) {
    next[key] = true;
  }

  return next;
}

export function isSidebarItemVisible(key: string) {
  if (ALWAYS_VISIBLE_KEYS.has(key)) return true;
  return getSidebarVisibility()[key] !== false;
}

export function isSidebarItemAlwaysVisible(key: string) {
  return ALWAYS_VISIBLE_KEYS.has(key);
}

export function setSidebarItemVisible(key: string, value: boolean) {
  if (ALWAYS_VISIBLE_KEYS.has(key)) return;
  try {
    const next = { ...getSidebarVisibility(), [key]: value };
    localStorage.setItem(VISIBILITY_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(VISIBILITY_EVENT));
  } catch {}
}

export function onSidebarVisibilityChange(cb: () => void) {
  const storageHandler = (e: StorageEvent) => {
    if (e.key === VISIBILITY_KEY) cb();
  };
  const eventHandler = () => cb();
  window.addEventListener("storage", storageHandler);
  window.addEventListener(VISIBILITY_EVENT, eventHandler);
  return () => {
    window.removeEventListener("storage", storageHandler);
    window.removeEventListener(VISIBILITY_EVENT, eventHandler);
  };
}

export function orderBySavedKeys<T extends { key: string }>(items: T[], keys: string[]) {
  const index = new Map(keys.map((key, idx) => [key, idx] as const));
  return [...items].sort((a, b) => {
    const ai = index.get(a.key);
    const bi = index.get(b.key);
    if (ai == null && bi == null) return 0;
    if (ai == null) return 1;
    if (bi == null) return -1;
    return ai - bi;
  });
}
