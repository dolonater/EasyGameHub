import type { AppearanceBackgroundChoice, AppearancePreset, AppearanceSettings } from "./types";

export const BUILT_IN_BACKGROUNDS: Array<{
  value: Exclude<AppearanceBackgroundChoice, "%custom">;
  key: "none" | "horizon" | "nocturne";
  thumbnail: string | null;
}> = [
  {
    value: "%none",
    key: "none",
    thumbnail: null,
  },
  {
    value: "%built-in:horizon",
    key: "horizon",
    thumbnail: "/images/backgrounds/horizon-thumbnail.jpg",
  },
  {
    value: "%built-in:nocturne",
    key: "nocturne",
    thumbnail: "/images/backgrounds/nocturne-thumbnail.jpg",
  },
];

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  preset: "default",
  background_image: null,
  background_choice: "%none",
  custom_backgrounds: [],
  custom_background_assets: [],
  follow_background_text: false,
  use_liquid_glass: false,
  auto_darken: true,
  overlay_opacity: 0.35,
  background_blur: 0,
  surface_opacity: 1,
  surface_blur: 0,
  radius: 8,
  font_family: "%built-in",
};

export const APPEARANCE_PRESETS: Record<Exclude<AppearancePreset, "custom">, AppearanceSettings> = {
  default: { ...DEFAULT_APPEARANCE },
  "soft-glass": {
    preset: "soft-glass",
    background_image: null,
    background_choice: "%built-in:horizon",
    custom_backgrounds: [],
    custom_background_assets: [],
    follow_background_text: false,
    use_liquid_glass: false,
    auto_darken: true,
    overlay_opacity: 0.3,
    background_blur: 0,
    surface_opacity: 0.9,
    surface_blur: 8,
    radius: 12,
    font_family: DEFAULT_APPEARANCE.font_family,
  },
  "dark-glass": {
    preset: "dark-glass",
    background_image: null,
    background_choice: "%built-in:nocturne",
    custom_backgrounds: [],
    custom_background_assets: [],
    follow_background_text: false,
    use_liquid_glass: false,
    auto_darken: true,
    overlay_opacity: 0.42,
    background_blur: 0,
    surface_opacity: 0.8,
    surface_blur: 12,
    radius: 14,
    font_family: DEFAULT_APPEARANCE.font_family,
  },
  "clear-image": {
    preset: "clear-image",
    background_image: null,
    background_choice: "%built-in:horizon",
    custom_backgrounds: [],
    custom_background_assets: [],
    follow_background_text: false,
    use_liquid_glass: false,
    auto_darken: false,
    overlay_opacity: 0.18,
    background_blur: 0,
    surface_opacity: 0.88,
    surface_blur: 4,
    radius: 10,
    font_family: DEFAULT_APPEARANCE.font_family,
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeFontFamily(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.split("&").map((part) => part.trim()).find(Boolean) ?? fallback;
}

export function normalizeAppearance(value?: Partial<AppearanceSettings> | null): AppearanceSettings {
  const preset = value?.preset;
  const base = preset && preset in APPEARANCE_PRESETS
    ? APPEARANCE_PRESETS[preset as Exclude<AppearancePreset, "custom">]
    : DEFAULT_APPEARANCE;

  const rawAssets = Array.isArray(value?.custom_background_assets)
    ? value.custom_background_assets.filter((asset): asset is NonNullable<typeof value.custom_background_assets[number]> => Boolean(asset && typeof asset === "object"))
    : [];

  const pathToSource = new Map<string, string>();
  for (const asset of rawAssets) {
    const sourcePath = typeof asset.source_path === "string" ? asset.source_path.trim() : "";
    const thumbnailPath = typeof asset.thumbnail_path === "string" ? asset.thumbnail_path.trim() : "";
    const runtimePath = typeof asset.runtime_path === "string" ? asset.runtime_path.trim() : "";
    if (!sourcePath) continue;
    if (thumbnailPath) pathToSource.set(thumbnailPath, sourcePath);
    if (runtimePath) pathToSource.set(runtimePath, sourcePath);
  }

  const canonicalizeBackgroundPath = (path: string) => {
    const trimmed = path.trim();
    if (!trimmed) return "";
    return pathToSource.get(trimmed) ?? trimmed;
  };

  const currentBackgroundRaw = typeof value?.background_image === "string"
    ? value.background_image.trim()
    : "";
  const currentBackground = currentBackgroundRaw
    ? canonicalizeBackgroundPath(currentBackgroundRaw)
    : null;

  const customBackgroundsRaw = Array.isArray(value?.custom_backgrounds)
    ? value.custom_backgrounds.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [...base.custom_backgrounds];
  const customBackgrounds: string[] = [];
  for (const item of customBackgroundsRaw) {
    const canonical = canonicalizeBackgroundPath(item);
    if (!canonical || customBackgrounds.includes(canonical)) continue;
    customBackgrounds.push(canonical);
  }
  if (currentBackground && !customBackgrounds.includes(currentBackground)) {
    customBackgrounds.push(currentBackground);
  }

  const assetMap = new Map<string, { thumbnail_path: string | null; runtime_path: string | null }>();
  for (const asset of rawAssets) {
    const sourcePath = typeof asset.source_path === "string"
      ? canonicalizeBackgroundPath(asset.source_path)
      : "";
    if (!sourcePath) continue;
    const thumbnailPath = typeof asset.thumbnail_path === "string" && asset.thumbnail_path.trim().length > 0
      ? asset.thumbnail_path
      : null;
    const runtimePath = typeof asset.runtime_path === "string" && asset.runtime_path.trim().length > 0
      ? asset.runtime_path
      : null;
    assetMap.set(sourcePath, { thumbnail_path: thumbnailPath, runtime_path: runtimePath });
  }
  const customBackgroundAssets = customBackgrounds.map((sourcePath) => ({
    source_path: sourcePath,
    thumbnail_path: assetMap.get(sourcePath)?.thumbnail_path ?? null,
    runtime_path: assetMap.get(sourcePath)?.runtime_path ?? null,
  }));

  return {
    preset: preset === "default" || preset === "soft-glass" || preset === "dark-glass" || preset === "clear-image" || preset === "custom"
      ? preset
      : base.preset,
    background_image: currentBackground ?? base.background_image,
    background_choice: value?.background_choice === "%none" || value?.background_choice === "%built-in:horizon" || value?.background_choice === "%built-in:nocturne" || value?.background_choice === "%custom"
      ? value.background_choice
      : base.background_choice,
    custom_backgrounds: customBackgrounds,
    custom_background_assets: customBackgroundAssets,
    follow_background_text: value?.follow_background_text ?? base.follow_background_text,
    use_liquid_glass: value?.use_liquid_glass ?? base.use_liquid_glass,
    auto_darken: value?.auto_darken ?? base.auto_darken,
    overlay_opacity: clamp(value?.overlay_opacity ?? base.overlay_opacity, 0, 1),
    background_blur: clamp(value?.background_blur ?? base.background_blur, 0, 48),
    surface_opacity: clamp(value?.surface_opacity ?? base.surface_opacity, 0, 1),
    surface_blur: clamp(value?.surface_blur ?? base.surface_blur, 0, 48),
    radius: clamp(value?.radius ?? base.radius, 0, 32),
    font_family: normalizeFontFamily(value?.font_family, base.font_family),
  };
}

export function presetAppearance(
  preset: Exclude<AppearancePreset, "custom">,
  options?: {
    backgroundImage?: string | null;
    customBackgrounds?: string[];
    customBackgroundAssets?: AppearanceSettings["custom_background_assets"];
    fontFamily?: string;
  },
): AppearanceSettings {
  const backgroundImage = options?.backgroundImage ?? null;
  const customBackgrounds = options?.customBackgrounds ?? (backgroundImage ? [backgroundImage] : []);
  const customBackgroundAssets = options?.customBackgroundAssets
    ?? (backgroundImage ? [{ source_path: backgroundImage, thumbnail_path: null, runtime_path: null }] : []);

  return {
    ...APPEARANCE_PRESETS[preset],
    preset,
    background_image: backgroundImage,
    background_choice: backgroundImage ? "%custom" : APPEARANCE_PRESETS[preset].background_choice,
    custom_backgrounds: customBackgrounds,
    custom_background_assets: customBackgroundAssets,
    follow_background_text: false,
    font_family: options?.fontFamily ?? DEFAULT_APPEARANCE.font_family,
  };
}
