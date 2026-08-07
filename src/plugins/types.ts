export type PluginPermission = "core.read" | "core.backup" | "events" | "ui" | "music";

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  api_version: number;
  entry: string;
  permissions: PluginPermission[];
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
}

export interface PluginRegistry {
  plugins: PluginRecord[];
}

export interface PluginRegistryDto {
  plugins_dir: string;
  plugins: PluginRecord[];
}
