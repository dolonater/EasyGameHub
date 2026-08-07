import type { Theme, ThemeVariant } from "./types";

// ── 10 preset color swatches from the animotion color card ──

interface ColorPreset {
  hex: string;
  /** i18n key under `theme.*` */
  i18nKey: string;
  /** English fallback name */
  name: string;
}

export const COLOR_PRESETS: ColorPreset[] = [
  { hex: "#e11d48", i18nKey: "colorRoseRed", name: "Rose Red" },
  { hex: "#f472b6", i18nKey: "colorPink", name: "Pink" },
  { hex: "#fb923c", i18nKey: "colorOrange", name: "Orange" },
  { hex: "#facc15", i18nKey: "colorYellow", name: "Yellow" },
  { hex: "#84cc16", i18nKey: "colorLime", name: "Lime" },
  { hex: "#10b981", i18nKey: "colorEmerald", name: "Emerald" },
  { hex: "#0ea5e9", i18nKey: "colorSkyBlue", name: "Sky Blue" },
  { hex: "#3b82f6", i18nKey: "colorBlue", name: "Blue" },
  { hex: "#8b5cf6", i18nKey: "colorViolet", name: "Violet" },
  { hex: "#a78bfa", i18nKey: "colorLavender", name: "Lavender" },
];

// ── Hex → HSL ──────────────────────────────────────────────────

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let r = 0, g = 0, b = 0;
  const hx = hex.replace("#", "");
  if (hx.length === 3) {
    r = parseInt(hx[0] + hx[0], 16) / 255;
    g = parseInt(hx[1] + hx[1], 16) / 255;
    b = parseInt(hx[2] + hx[2], 16) / 255;
  } else {
    r = parseInt(hx.substring(0, 2), 16) / 255;
    g = parseInt(hx.substring(2, 4), 16) / 255;
    b = parseInt(hx.substring(4, 6), 16) / 255;
  }
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslStr(h: number, s: number, l: number): string {
  return `${h} ${s}% ${l}%`;
}

// ── Theme generation from a single hue ─────────────────────────

/**
 * Generate light + dark ThemeVariants following the same pattern as
 * ocean-blue and other built-in presets.  All slots share the same hue
 * to create a coherent monochromatic palette.
 *
 * Reference: ocean_blue_light / ocean_blue_dark in src-tauri/src/core/themes.rs
 */
function generateVariants(baseHex: string): { light: ThemeVariant; dark: ThemeVariant } {
  const base = hexToHsl(baseHex);
  const h = base.h;

  // --- Light variant ---------------------------------------------------
  // Pattern: background ≈ 98%, card = white, secondary/muted/border are
  // light tints of the hue.  Primary is saturated at medium lightness.

  const light: ThemeVariant = {
    background:         hslStr(h, 20, 98),
    foreground:         hslStr(h, 25, 15),
    card:               "0 0% 100%",
    cardForeground:     hslStr(h, 25, 15),
    primary:            hslStr(h, 70, 45),
    primaryForeground:  "0 0% 100%",
    secondary:          hslStr(h, 20, 94),
    secondaryForeground: hslStr(h, 25, 20),
    muted:              hslStr(h, 15, 92),
    mutedForeground:    hslStr(h, 15, 48),
    accent:             hslStr(h, 60, 50),
    accentForeground:   "0 0% 100%",
    destructive:        "0 72% 55%",
    destructiveForeground: "0 0% 98%",
    border:             hslStr(h, 15, 88),
    input:              hslStr(h, 15, 88),
    ring:               hslStr(h, 70, 45),
  };

  // --- Dark variant ----------------------------------------------------
  // Pattern: background → card → muted → secondary → border form a
  // dark gradient.  Primary is bright and saturated.

  const dark: ThemeVariant = {
    background:         hslStr(h, 25, 10),
    foreground:         hslStr(h, 15, 85),
    card:               hslStr(h, 22, 13),
    cardForeground:     hslStr(h, 15, 85),
    primary:            hslStr(h, 80, 60),
    primaryForeground:  hslStr(h, 25, 8),
    secondary:          hslStr(h, 20, 17),
    secondaryForeground: hslStr(h, 15, 85),
    muted:              hslStr(h, 18, 15),
    mutedForeground:    hslStr(h, 12, 55),
    accent:             hslStr(h, 70, 58),
    accentForeground:   "0 0% 100%",
    destructive:        "0 62% 45%",
    destructiveForeground: "0 0% 98%",
    border:             hslStr(h, 18, 20),
    input:              hslStr(h, 18, 20),
    ring:               hslStr(h, 80, 60),
  };

  return { light, dark };
}

/**
 * Build a full Theme object from one of the COLOR_PRESETS.
 * The returned theme is ready to be saved via `saveTheme()`.
 */
export function buildColorTheme(preset: ColorPreset, displayName?: string): Theme {
  const id = `color-${preset.hex.replace("#", "").toLowerCase()}`;
  const { light, dark } = generateVariants(preset.hex);
  return {
    id,
    name: displayName || preset.name,
    isPreset: false,
    light,
    dark,
  };
}
