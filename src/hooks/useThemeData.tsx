import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Theme, ThemesData, ThemeVariant, CssVarMap } from "../lib/types";
import { THEME_VAR_MAP } from "../lib/types";

/** Convert a ThemeVariant (camelCase keys) → CssVarMap (--kebab-case keys → raw HSL) */
export function variantToCssVars(variant: ThemeVariant): CssVarMap {
  const map: CssVarMap = {};
  for (const [key, cssVar] of Object.entries(THEME_VAR_MAP) as [keyof ThemeVariant, string][]) {
    map[cssVar] = variant[key];
  }
  return map;
}

// ── ThemeDataContext (theme library, rarely changes) ──────────────

interface ThemeDataCtx {
  data: ThemesData;
  loading: boolean;
  refresh: () => Promise<void>;
  saveTheme: (theme: Theme) => Promise<void>;
  deleteTheme: (id: string) => Promise<void>;
  createTheme: (name: string, baseThemeId: string) => Promise<void>;
  copyTheme: (id: string) => Promise<void>;
  setGlobalDefault: (id: string) => Promise<void>;
  resetPresets: () => Promise<void>;
}

const DEFAULT_DATA: ThemesData = {
  themes: [],
  globalDefault: "system-default",
};

const ThemeDataContext = createContext<ThemeDataCtx>({
  data: DEFAULT_DATA,
  loading: true,
  refresh: async () => {},
  saveTheme: async () => {},
  deleteTheme: async () => {},
  createTheme: async () => {},
  copyTheme: async () => {},
  setGlobalDefault: async () => {},
  resetPresets: async () => {},
});

export function useThemeData() {
  return useContext(ThemeDataContext);
}

export function ThemeDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ThemesData>(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const d = await invoke<ThemesData>("get_themes_data");
      setData(d);
    } catch {
      // leave stale data on error
    }
  }, []);

  useEffect(() => { refresh().finally(() => setLoading(false)); }, [refresh]);

  const persist = useCallback(async (newData: ThemesData) => {
    await invoke("save_themes_data", { data: newData });
    setData(newData);
  }, []);

  const saveTheme = useCallback(async (theme: Theme) => {
    const next = { ...data };
    const idx = next.themes.findIndex((t) => t.id === theme.id);
    if (idx >= 0) {
      next.themes = [...next.themes];
      next.themes[idx] = theme;
    } else {
      next.themes = [...next.themes, theme];
    }
    await persist(next);
  }, [data, persist]);

  const deleteTheme = useCallback(async (id: string) => {
    const next = { ...data };
    next.themes = next.themes.filter((t) => t.id !== id);
    if (next.globalDefault === id) next.globalDefault = "system-default";
    await persist(next);
  }, [data, persist]);

  const createTheme = useCallback(async (name: string, baseThemeId: string) => {
    const base = data.themes.find((t) => t.id === baseThemeId) || data.themes[0];
    const id = name.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, "-").replace(/^-|-$/g, "") || `custom-${Date.now()}`;
    // Ensure unique ID
    let uniqueId = id;
    let n = 1;
    while (data.themes.some((t) => t.id === uniqueId)) {
      uniqueId = `${id}-${++n}`;
    }
    const theme: Theme = {
      id: uniqueId,
      name,
      isPreset: false,
      light: { ...base.light },
      dark: { ...base.dark },
    };
    await persist({ ...data, themes: [...data.themes, theme] });
  }, [data, persist]);

  const copyTheme = useCallback(async (id: string) => {
    const src = data.themes.find((t) => t.id === id);
    if (!src) return;
    const baseName = `${src.name}（副本）`;
    let name = baseName;
    let n = 1;
    while (data.themes.some((t) => t.name === name)) {
      name = `${baseName}${++n}`;
    }
    await createTheme(name, id);
  }, [data, createTheme]);

  const setGlobalDefault = useCallback(async (id: string) => {
    await persist({ ...data, globalDefault: id });
  }, [data, persist]);

  const resetPresets = useCallback(async () => {
    const result = await invoke<ThemesData>("reset_preset_themes");
    setData(result);
  }, []);

  return (
    <ThemeDataContext.Provider value={{
      data, loading, refresh, saveTheme, deleteTheme, createTheme, copyTheme,
      setGlobalDefault, resetPresets,
    }}>
      {children}
    </ThemeDataContext.Provider>
  );
}

// ── ThemeModeContext (light/dark, persisted to config.json) ────────

interface ThemeModeCtx {
  mode: "light" | "dark";
  setMode: (m: "light" | "dark") => Promise<void>;
  toggleMode: () => Promise<void>;
  setForcedMode: (m: "light" | "dark" | null) => void;
}

const ThemeModeContext = createContext<ThemeModeCtx>({
  mode: "dark",
  setMode: async () => {},
  toggleMode: async () => {},
  setForcedMode: () => {},
});

export function useThemeMode() {
  return useContext(ThemeModeContext);
}

function getInitialMode(): "light" | "dark" {
  try {
    const stored = localStorage.getItem("theme-mode");
    if (stored === "dark" || stored === "light") return stored;
  } catch {}
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [savedMode, setSavedMode] = useState<"light" | "dark">(getInitialMode);
  const [forcedMode, setForcedMode] = useState<"light" | "dark" | null>(null);
  const mode = forcedMode || savedMode;

  // Load initial mode from config.json (source of truth, may override localStorage)
  useEffect(() => {
    invoke<{ theme_mode?: string }>("get_config")
      .then((cfg) => {
        if (cfg.theme_mode === "light" || cfg.theme_mode === "dark") {
          setSavedMode(cfg.theme_mode);
          // Sync to localStorage so inline script is correct on next page load
          try { localStorage.setItem("theme-mode", cfg.theme_mode); } catch {}
        }
        // else: keep the initial mode (already set from localStorage / system)
      })
      .catch(() => { /* keep initial mode */ });
  }, []);

  // Keep <html> class in sync
  useEffect(() => {
    const root = document.documentElement;
    if (mode === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [mode]);

  const setMode = useCallback(async (m: "light" | "dark") => {
    setSavedMode(m);
    // Persist to localStorage immediately (sync, prevents flash on next load)
    try { localStorage.setItem("theme-mode", m); } catch {}
    // Persist to config.json
    try {
      const cfg = await invoke<Record<string, unknown>>("get_config");
      await invoke("update_config", { dto: { ...cfg, theme_mode: m } });
    } catch { /* ignore */ }
  }, []);

  const toggleMode = useCallback(async () => {
    await setMode(mode === "dark" ? "light" : "dark");
  }, [mode, setMode]);

  return (
    <ThemeModeContext.Provider value={{ mode, setMode, toggleMode, setForcedMode }}>
      {children}
    </ThemeModeContext.Provider>
  );
}

// ── ActiveThemeContext (resolved CSS vars for current page) ────────

interface ActiveThemeCtx {
  cssVars: CssVarMap;
  themeId: string;
  themeName: string;
}

const ActiveThemeContext = createContext<ActiveThemeCtx>({
  cssVars: {},
  themeId: "system-default",
  themeName: "System",
});

export function useActiveTheme() {
  return useContext(ActiveThemeContext);
}

export function ActiveThemeProvider({ children }: { children: ReactNode }) {
  const { data } = useThemeData();
  const { mode } = useThemeMode();

  const { themeId, themeName, cssVars } = useMemo(() => {
    const theme = data.themes.find((t) => t.id === data.globalDefault) || data.themes[0];
    const variant: ThemeVariant = theme
      ? (mode === "dark" ? theme.dark : theme.light)
      : (data.themes[0]?.dark || data.themes[0]?.light || {} as ThemeVariant);
    return {
      themeId: theme?.id || "system-default",
      themeName: theme?.name || "System",
      cssVars: variantToCssVars(variant),
    };
  }, [data.globalDefault, data.themes, mode]);

  return (
    <ActiveThemeContext.Provider value={{ cssVars, themeId, themeName }}>
      {children}
    </ActiveThemeContext.Provider>
  );
}

// ── Inline-style helper for per-page injection ───────────────────

/**
 * Returns a React.CSSProperties object mapping each --css-var to
 * its raw HSL triplet (e.g. "--background": "240 10% 3.9%").
 * Use on a page root <div style={themeStyle}> to inject CSS custom
 * properties. Tailwind's hsl(var(--x)) will read them correctly.
 */
export function useThemeStyle(): React.CSSProperties {
  const { cssVars } = useActiveTheme();
  return useMemo(() => {
    // cssVars values are already raw HSL triplets — no hsl() wrapper needed
    // because Tailwind classes compile to hsl(var(--background)) etc.
    return cssVars as React.CSSProperties;
  }, [cssVars]);
}

// ── Global default theme injection on <html> ─────────────────────

/**
 * Injects the global theme's CSS variables onto <html>.
 * The whole application inherits this one theme.
 */
export function GlobalThemeStyle() {
  const { data } = useThemeData();
  const { mode } = useThemeMode();

  const globalCssVars = useMemo(() => {
    const theme = data.themes.find((t) => t.id === data.globalDefault) || data.themes[0];
    if (!theme) return {} as CssVarMap;
    const variant = mode === "dark" ? theme.dark : theme.light;
    return variantToCssVars(variant);
  }, [data.themes, data.globalDefault, mode]);

  useEffect(() => {
    const root = document.documentElement;
    for (const [cssName, hslVal] of Object.entries(globalCssVars)) {
      root.style.setProperty(cssName, hslVal);
    }
    return () => {
      for (const cssName of Object.keys(globalCssVars)) {
        root.style.removeProperty(cssName);
      }
    };
  }, [globalCssVars]);

  return null;
}

/**
 * Hook that returns CSSProperties for the global theme.
 */
export function useGlobalThemeStyle(): React.CSSProperties {
  const { data } = useThemeData();
  const { mode } = useThemeMode();

  return useMemo(() => {
    const theme = data.themes.find((t) => t.id === data.globalDefault) || data.themes[0];
    if (!theme) return {} as React.CSSProperties;
    const variant: ThemeVariant = mode === "dark" ? theme.dark : theme.light;
    return variantToCssVars(variant) as React.CSSProperties;
  }, [data.themes, data.globalDefault, mode]);
}
