export type PluginPermission = "core.read" | "core.backup" | "events" | "ui" | "music" | "bilibili";

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  api_version: number;
  entry: string;
  permissions: PluginPermission[];
  /** Optional display icon: an asset path (`assets/xxx`) or an app Icon name. */
  icon?: string | null;
  /** Optional one-line display description. */
  description?: string | null;
}

export interface PluginRecord {
  id: string;
  name: string;
  version: string;
  api_version: number;
  entry: string;
  permissions: PluginPermission[];
  enabled: boolean;
  installed_at: string;
  last_error: string | null;
  error_count: number;
  icon?: string | null;
  description?: string | null;
}

export interface PluginRegistry {
  plugins: PluginRecord[];
}

export interface PluginRegistryDto {
  plugins_dir: string;
  plugins: PluginRecord[];
}
