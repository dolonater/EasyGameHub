const PRESET_I18N: Record<string, string> = {
  "system-default": "theme.presetSystemDefault",
  "ocean-blue": "theme.presetOceanBlue",
  "warm-amber": "theme.presetWarmAmber",
  "forest-green": "theme.presetForestGreen",
  "cherry-pink": "theme.presetCherryPink",
};

/** Translate a theme name: use i18n for known presets, otherwise return the original name. */
export function translateThemeName(themeId: string, fallbackName: string, t: (key: string) => string): string {
  const i18nKey = PRESET_I18N[themeId];
  return i18nKey ? t(i18nKey) : fallbackName;
}
