import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_APPEARANCE, normalizeAppearance } from "../lib/appearance";
import { extractAppearancePaletteFromImage } from "../lib/colorExtract";
import type { AppearanceSettings, Config } from "../lib/types";
import { useThemeMode } from "./useThemeData";

const APPEARANCE_UPDATED_EVENT = "doona:appearance-updated";
const fileSrcCache = new Map<string, string>();
const paletteVarCache = new Map<string, React.CSSProperties>();
const paletteRequestCache = new Map<string, Promise<React.CSSProperties>>();

interface AppearanceCtx {
  appearance: AppearanceSettings;
  backgroundUrl: string | null;
  textVars: React.CSSProperties;
  refresh: () => Promise<void>;
}

function builtInBackgroundUrl(choice: AppearanceSettings["background_choice"], dark: boolean) {
  const key = choice.replace("%built-in:", "");
  return `/images/backgrounds/${key}-${dark ? "dark" : "light"}.jpg`;
}

function resolveFileSrc(path: string, usage: "background" | "thumbnail" = "background") {
  const cacheKey = `${usage}:${path}`;
  const cached = fileSrcCache.get(cacheKey);
  if (cached) return cached;
  const suffix = usage === "background" ? "?usage=background" : "?usage=thumb";
  const next = `${convertFileSrc(path)}${suffix}`;
  fileSrcCache.set(cacheKey, next);
  return next;
}

function loadPaletteVars(backgroundUrl: string) {
  const cached = paletteVarCache.get(backgroundUrl);
  if (cached) {
    return Promise.resolve(cached);
  }

  const inFlight = paletteRequestCache.get(backgroundUrl);
  if (inFlight) {
    return inFlight;
  }

  const request = new Promise<React.CSSProperties>((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const palette = extractAppearancePaletteFromImage(image);
      const vars: React.CSSProperties = {
        ["--foreground" as string]: palette.foreground,
        ["--card-foreground" as string]: palette.cardForeground,
        ["--secondary-foreground" as string]: palette.secondaryForeground,
        ["--muted-foreground" as string]: palette.mutedForeground,
      };
      paletteVarCache.set(backgroundUrl, vars);
      paletteRequestCache.delete(backgroundUrl);
      resolve(vars);
    };
    image.onerror = () => {
      paletteRequestCache.delete(backgroundUrl);
      resolve({});
    };
    image.src = backgroundUrl;
  });

  paletteRequestCache.set(backgroundUrl, request);
  return request;
}

const AppearanceContext = createContext<AppearanceCtx>({
  appearance: DEFAULT_APPEARANCE,
  backgroundUrl: null,
  textVars: {},
  refresh: async () => {},
});

export function useAppearance() {
  return useContext(AppearanceContext);
}

export function dispatchAppearanceUpdated(appearance: AppearanceSettings) {
  window.dispatchEvent(new CustomEvent<AppearanceSettings>(APPEARANCE_UPDATED_EVENT, {
    detail: appearance,
  }));
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { mode } = useThemeMode();
  const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);
  const [activeCustomBackground, setActiveCustomBackground] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const cfg = await invoke<Config>("get_config");
      const nextAppearance = normalizeAppearance(cfg.appearance);
      setAppearance(nextAppearance);
    } catch {
      setAppearance(DEFAULT_APPEARANCE);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<AppearanceSettings>).detail;
      const nextAppearance = normalizeAppearance(detail);
      setAppearance(nextAppearance);
    };
    window.addEventListener(APPEARANCE_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(APPEARANCE_UPDATED_EVENT, handleUpdate);
  }, []);

  useEffect(() => {
    if (appearance.background_choice !== "%custom") {
      setActiveCustomBackground(null);
      return;
    }

    const candidates = appearance.custom_backgrounds.filter(Boolean);
    if (candidates.length === 0) {
      setActiveCustomBackground(null);
      return;
    }

    const selected = appearance.background_image || candidates[0] || null;
    setActiveCustomBackground(selected);
  }, [appearance.background_choice, appearance.background_image, appearance.custom_backgrounds, activeCustomBackground]);

  const backgroundUrl = useMemo(() => {
    if (appearance.background_choice === "%custom") {
      const selected = activeCustomBackground;
      if (!selected) return null;
      const asset = appearance.custom_background_assets.find((item) => item.source_path === selected) ?? null;
      const runtimePath = asset?.runtime_path || selected;
      try {
        return resolveFileSrc(runtimePath, "background");
      } catch {
        return null;
      }
    }

    if (appearance.background_choice === "%none") {
      return null;
    }

    if (appearance.background_choice.startsWith("%built-in:")) {
      return builtInBackgroundUrl(appearance.background_choice, mode === "dark");
    }

    return null;
  }, [appearance.background_choice, activeCustomBackground, mode]);

  const [textVars, setTextVars] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!appearance.follow_background_text || !backgroundUrl) {
      setTextVars({});
      return;
    }

    let cancelled = false;
    void loadPaletteVars(backgroundUrl).then((vars) => {
      if (cancelled) return;
      setTextVars(vars);
    });

    return () => {
      cancelled = true;
    };
  }, [appearance.follow_background_text, backgroundUrl]);

  return (
    <AppearanceContext.Provider value={{ appearance, backgroundUrl, textVars, refresh }}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function GlobalAppearanceStyle() {
  const { appearance, textVars } = useAppearance();

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--app-overlay-opacity", String(appearance.overlay_opacity));
    root.style.setProperty("--app-bg-blur", `${appearance.background_blur}px`);
    root.style.setProperty("--app-surface-opacity", String(appearance.surface_opacity));
    root.style.setProperty("--app-surface-blur", `${appearance.surface_blur}px`);
    root.style.setProperty("--radius", `${appearance.radius}px`);
    root.classList.toggle("app-liquid-glass", appearance.use_liquid_glass);

    const fontFamily = appearance.font_family;
    if (fontFamily && fontFamily !== "%built-in") {
      root.style.setProperty("--app-font-family", `"${fontFamily.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}", -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif`);
      document.body.setAttribute("use-custom-font", "true");
    } else {
      root.style.removeProperty("--app-font-family");
      document.body.removeAttribute("use-custom-font");
    }

    return () => {
      root.style.removeProperty("--app-overlay-opacity");
      root.style.removeProperty("--app-bg-blur");
      root.style.removeProperty("--app-surface-opacity");
      root.style.removeProperty("--app-surface-blur");
      root.style.removeProperty("--radius");
      root.style.removeProperty("--app-font-family");
      document.body.removeAttribute("use-custom-font");
      root.classList.remove("app-liquid-glass");
    };
  }, [appearance]);

  useEffect(() => {
    const root = document.documentElement;
    const clearDynamicVars = () => {
      root.style.removeProperty("--foreground");
      root.style.removeProperty("--card-foreground");
      root.style.removeProperty("--secondary-foreground");
      root.style.removeProperty("--muted-foreground");
      root.removeAttribute("data-dyn-accent");
    };

    if (!appearance.follow_background_text || Object.keys(textVars).length === 0) {
      clearDynamicVars();
      return;
    }

    for (const [cssName, value] of Object.entries(textVars)) {
      root.style.setProperty(cssName, String(value));
    }
    root.setAttribute("data-dyn-accent", "true");

    return clearDynamicVars;
  }, [appearance.follow_background_text, textVars]);

  return null;
}
