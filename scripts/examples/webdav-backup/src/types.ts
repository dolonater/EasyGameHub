/// The permission-gated SDK instance handed to setup(ctx) by the loader.
/// Mirrors src/plugins/sdk.ts PluginSdk in the main app.
export interface PluginSdk {
  apiVersion: number;
  log: (...args: unknown[]) => void;
  ui: {
    registerPage(page: { path: string; title: string; icon?: string; render: () => unknown }): void;
    registerSettingsSection(section: { id: string; title: string; render: () => unknown }): void;
    notify(message: string): void;
  };
  core: {
    listGames(): Promise<unknown[]>;
    listSnapshots(gameId: string): Promise<unknown[]>;
    getGame(gameId: string): Promise<unknown>;
    triggerBackup(gameId: string): Promise<unknown>;
  };
  events: {
    on(event: string, handler: (payload: unknown) => void): void;
    off(event: string, handler: (payload: unknown) => void): void;
  };
  storage: {
    get(): Promise<unknown | null>;
    set(data: unknown): Promise<void>;
  };
}

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

export interface SnapshotInfo {
  game_name: string;
  path: string;
  timestamp: string;
  note: string;
  size_bytes: number;
}
