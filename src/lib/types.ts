export interface GameInfo {
  id: string;
  name: string;
  save_path: string;
  backup_dir: string;
  steam_app_id: number | null;
  is_custom: boolean;
  last_backup: string | null;
  snapshot_count: number;
  status: "active" | "inactive" | "unavailable";
  pinned: boolean;
  auto_backup: boolean;
}

export type SortKey = "name" | "last_backup" | "snapshot_count";
export type ViewMode = "list" | "grid";

export interface SnapshotInfo {
  game_name: string;
  path: string;
  timestamp: string;
  note: string;
  size_bytes: number;
}

export interface RecentActivityItem {
  game_name: string;
  action: string;  // "backup" | "restore"
  timestamp: string;
  size_bytes: number;
}

export interface ZipEntryInfo {
  name: string;
  is_dir: boolean;
  size_bytes: number;
}

export interface Stats {
  protected_games: number;
  total_snapshots: number;
  total_size_bytes: number;
  last_backup: string | null;
  is_watching: boolean;
  recent_activity: RecentActivityItem[];
}

export type AppearancePreset = "default" | "soft-glass" | "dark-glass" | "clear-image" | "custom";
export type AppearanceBackgroundChoice = "%none" | "%built-in:horizon" | "%built-in:nocturne" | "%custom";

export interface BackgroundAsset {
  source_path: string;
  thumbnail_path: string | null;
  runtime_path: string | null;
}

export interface AppearanceSettings {
  preset: AppearancePreset;
  background_image: string | null;
  background_choice: AppearanceBackgroundChoice;
  custom_backgrounds: string[];
  custom_background_assets: BackgroundAsset[];
  follow_background_text: boolean;
  use_liquid_glass: boolean;
  auto_darken: boolean;
  overlay_opacity: number;
  background_blur: number;
  surface_opacity: number;
  surface_blur: number;
  radius: number;
  font_family: string;
}

export interface Config {
  backup_root: string;
  language: string;
  auto_backup: boolean;
  debounce_seconds: number;
  min_interval_minutes: number;
  auto_start: boolean;
  periodic_minutes: number;
  max_backup_size_gb: number;
  daily_backup_time: string | null;
  process_check_interval_seconds: number;
  auto_backup_on_game_exit: boolean;
  ui_animations: boolean;
  steam_api_key: string;
  cached_steam_id: string;
  theme_mode: "light" | "dark";
  cover_card_style: "default" | "card1";
  appearance: AppearanceSettings;
}

/** Map ThemeVariant keys → CSS custom property names (--kebab-case) */
export const THEME_VAR_MAP: Record<keyof ThemeVariant, `--${string}`> = {
  background: "--background",
  foreground: "--foreground",
  card: "--card",
  cardForeground: "--card-foreground",
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  secondary: "--secondary",
  secondaryForeground: "--secondary-foreground",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  accent: "--accent",
  accentForeground: "--accent-foreground",
  destructive: "--destructive",
  destructiveForeground: "--destructive-foreground",
  border: "--border",
  input: "--input",
  ring: "--ring",
};

// ── Theme types ──────────────────────────────────────────────────

export interface Theme {
  id: string;
  name: string;
  isPreset: boolean;
  light: ThemeVariant;
  dark: ThemeVariant;
}

export interface ThemeVariant {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
}

export interface ThemesData {
  themes: Theme[];
  globalDefault: string;
}

/** Maps CSS variable name (with hyphens) → raw HSL value (e.g. "240 10% 3.9%") */
export type CssVarMap = Record<string, string>;

export interface LaunchConfig {
  game_id: string;
  exe_path: string;
  args?: string;
  launch_method: string;
}

export interface DbUpdateInfo {
  has_update: boolean;
  current_version: number;
  latest_version: number;
  download_url: string | null;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatTimestamp(ts: string | null): string {
  if (!ts) return "—";
  return ts.replace("_", " ").substring(0, 16);
}

export function formatRelativeTime(ts: string): string {
  const t = ts.replace("_", "T");
  const date = new Date(t);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs} 小时前`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays} 天前`;
  return formatTimestamp(ts);
}

export function getSteamCoverUrl(appId: number | null): string | null {
  if (!appId) return null;
  return `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`;
}

export function getSteamIconUrl(appId: number | null): string | null {
  if (!appId) return null;
  return `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/capsule_231x87.jpg`;
}
