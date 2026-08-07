import type { GameInfo, ViewMode } from "./types";

export interface SteamLibraryGameSource {
  appId: number;
  name: string | null;
  playtimeMinutes: number;
  isInstalled: boolean;
  installDir: string | null;
  installPath: string | null;
  sizeOnDisk: number | null;
  isHidden: boolean;
}

export type LibrarySourceFilter = "all" | "tracked" | "untracked" | "favorites";
export type LibraryInstallFilter = "all" | "installed" | "uninstalled";
export type LibrarySortKey = "last_backup" | "playtime" | "name" | "snapshot_count";

export type LibraryGameItem = GameInfo & {
  isTracked: boolean;
  isInstalled: boolean;
  isRunning: boolean;
  isFavorite: boolean;
  isHidden: boolean;
  playtimeMinutes: number;
  installDir: string | null;
  installPath: string | null;
  sizeOnDisk: number | null;
  hasLaunchConfig: boolean;
};

export interface BuildLibraryGamesOptions {
  games: GameInfo[];
  steamGames: SteamLibraryGameSource[];
  favorites?: Set<string>;
  runningGames?: Set<string>;
  launchConfigGameIds?: Set<string>;
}

export interface FilterLibraryGamesOptions {
  sourceFilter?: LibrarySourceFilter;
  installFilter?: LibraryInstallFilter;
  search?: string;
  showHidden?: boolean;
}

export interface SelectLibraryGamesOptions extends FilterLibraryGamesOptions {
  sortKey?: LibrarySortKey;
}

const LIBRARY_VIEW_MODE_KEY = "doona-library-view";
const LEGACY_VIEW_MODE_KEYS = ["doona-inventory-view", "doona-launcher-view"] as const;

function isViewMode(value: string | null): value is ViewMode {
  return value === "list" || value === "grid";
}

function compareText(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function compareBoolDesc(a: boolean, b: boolean) {
  return Number(b) - Number(a);
}

function makeInventoryOnlyGame(steamGame: SteamLibraryGameSource): GameInfo {
  return {
    id: `steam-${steamGame.appId}`,
    name: steamGame.name || `App ${steamGame.appId}`,
    save_path: "",
    backup_dir: "",
    steam_app_id: steamGame.appId,
    is_custom: false,
    last_backup: null,
    snapshot_count: 0,
    status: "inactive",
    pinned: false,
    auto_backup: false,
  };
}

export function buildLibraryGames({
  games,
  steamGames,
  favorites = new Set<string>(),
  runningGames = new Set<string>(),
  launchConfigGameIds = new Set<string>(),
}: BuildLibraryGamesOptions): LibraryGameItem[] {
  const steamGameMap = new Map(steamGames.map((game) => [game.appId, game]));
  const trackedSteamIds = new Set(
    games
      .map((game) => game.steam_app_id)
      .filter((appId): appId is number => appId != null),
  );

  const trackedGames: LibraryGameItem[] = games.map((game) => {
    const steamGame = game.steam_app_id != null ? steamGameMap.get(game.steam_app_id) : undefined;

    return {
      ...game,
      isTracked: true,
      isInstalled: steamGame?.isInstalled ?? true,
      isRunning: runningGames.has(game.id),
      isFavorite: favorites.has(game.id),
      isHidden: steamGame?.isHidden ?? false,
      playtimeMinutes: steamGame?.playtimeMinutes ?? 0,
      installDir: steamGame?.installDir ?? null,
      installPath: steamGame?.installPath ?? null,
      sizeOnDisk: steamGame?.sizeOnDisk ?? null,
      hasLaunchConfig: launchConfigGameIds.has(game.id),
    };
  });

  const inventoryOnlyGames: LibraryGameItem[] = steamGames
    .filter((game) => !trackedSteamIds.has(game.appId))
    .map((steamGame) => ({
      ...makeInventoryOnlyGame(steamGame),
      isTracked: false,
      isInstalled: steamGame.isInstalled,
      isRunning: false,
      isFavorite: false,
      isHidden: steamGame.isHidden,
      playtimeMinutes: steamGame.playtimeMinutes,
      installDir: steamGame.installDir,
      installPath: steamGame.installPath,
      sizeOnDisk: steamGame.sizeOnDisk,
      hasLaunchConfig: false,
    }));

  return [...trackedGames, ...inventoryOnlyGames];
}

export function filterLibraryGames(
  games: LibraryGameItem[],
  {
    sourceFilter = "all",
    installFilter = "all",
    search = "",
    showHidden = false,
  }: FilterLibraryGamesOptions = {},
): LibraryGameItem[] {
  const normalizedSearch = search.trim().toLowerCase();

  return games.filter((game) => {
    if (!showHidden && game.isHidden) return false;

    if (sourceFilter === "tracked" && !game.isTracked) return false;
    if (sourceFilter === "untracked" && game.isTracked) return false;
    if (sourceFilter === "favorites" && !game.isFavorite) return false;

    if (installFilter === "installed" && !game.isInstalled) return false;
    if (installFilter === "uninstalled" && game.isInstalled) return false;

    if (normalizedSearch && !game.name.toLowerCase().includes(normalizedSearch)) return false;

    return true;
  });
}

export function sortLibraryGames(games: LibraryGameItem[], sortKey: LibrarySortKey = "last_backup"): LibraryGameItem[] {
  return [...games].sort((a, b) => {
    const trackedCompare = compareBoolDesc(a.isTracked, b.isTracked);
    if (trackedCompare !== 0) return trackedCompare;

    const pinnedCompare = compareBoolDesc(a.pinned, b.pinned);
    if (pinnedCompare !== 0) return pinnedCompare;

    const runningCompare = compareBoolDesc(a.isRunning, b.isRunning);
    if (runningCompare !== 0) return runningCompare;

    switch (sortKey) {
      case "playtime": {
        const diff = b.playtimeMinutes - a.playtimeMinutes;
        if (diff !== 0) return diff;
        break;
      }
      case "snapshot_count": {
        const diff = b.snapshot_count - a.snapshot_count;
        if (diff !== 0) return diff;
        break;
      }
      case "name": {
        const diff = compareText(a.name, b.name);
        if (diff !== 0) return diff;
        break;
      }
      case "last_backup":
      default: {
        const diff = (b.last_backup || "").localeCompare(a.last_backup || "");
        if (diff !== 0) return diff;
        break;
      }
    }

    return compareText(a.name, b.name);
  });
}

export function selectLibraryGames(
  games: LibraryGameItem[],
  {
    sourceFilter = "all",
    installFilter = "all",
    search = "",
    showHidden = false,
    sortKey = "last_backup",
  }: SelectLibraryGamesOptions = {},
): LibraryGameItem[] {
  return sortLibraryGames(
    filterLibraryGames(games, {
      sourceFilter,
      installFilter,
      search,
      showHidden,
    }),
    sortKey,
  );
}

export function loadLibraryViewMode(): ViewMode {
  try {
    const value = localStorage.getItem(LIBRARY_VIEW_MODE_KEY);
    if (isViewMode(value)) return value;

    for (const key of LEGACY_VIEW_MODE_KEYS) {
      const legacyValue = localStorage.getItem(key);
      if (isViewMode(legacyValue)) return legacyValue;
    }
  } catch {}

  return "grid";
}
