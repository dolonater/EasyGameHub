import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { GameInfo, Stats, Config } from "../lib/types";

export interface SteamGame {
  appId: number;
  name: string | null;
  playtimeMinutes: number;
  isInstalled: boolean;
  installDir: string | null;
  installPath: string | null;
  sizeOnDisk: number | null;
  isHidden: boolean;
}

interface AppDataCtx {
  games: GameInfo[];
  stats: Stats | null;
  config: Config | null;
  steamGames: SteamGame[];
  steamLoading: boolean;
  steamLoaded: boolean;
  favorites: Set<string>;
  loading: boolean;
  refresh: () => void;
  ensureSteamGames: (force?: boolean) => Promise<SteamGame[]>;
  toggleFavorite: (gameId: string) => Promise<boolean>;
  setGames: (games: GameInfo[]) => void;
  updateSteamGames: (updater: (games: SteamGame[]) => SteamGame[]) => void;
}

const AppDataContext = createContext<AppDataCtx>({
  games: [],
  stats: null,
  config: null,
  steamGames: [],
  steamLoading: false,
  steamLoaded: false,
  favorites: new Set(),
  loading: true,
  refresh: () => {},
  ensureSteamGames: async () => [],
  toggleFavorite: async () => false,
  setGames: () => {},
  updateSteamGames: () => {},
});

export function useAppData() {
  return useContext(AppDataContext);
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [games, setGames] = useState<GameInfo[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [steamGames, setSteamGames] = useState<SteamGame[]>([]);
  const [steamLoading, setSteamLoading] = useState(false);
  const [steamLoaded, setSteamLoaded] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const steamLoadRef = useRef<Promise<SteamGame[]> | null>(null);
  const steamGamesRef = useRef<SteamGame[]>([]);
  const steamLoadedRef = useRef(false);

  useEffect(() => {
    steamGamesRef.current = steamGames;
  }, [steamGames]);

  useEffect(() => {
    steamLoadedRef.current = steamLoaded;
  }, [steamLoaded]);

  const ensureSteamGames = useCallback((force = false): Promise<SteamGame[]> => {
    if (!force && steamLoadedRef.current) {
      return Promise.resolve(steamGamesRef.current);
    }
    if (!force && steamLoadRef.current) {
      return steamLoadRef.current;
    }

    setSteamLoading(true);
    const request = invoke<SteamGame[]>("get_local_steam_games")
      .then((sg) => {
        if (steamLoadRef.current !== request) return sg;
        steamGamesRef.current = sg;
        steamLoadedRef.current = true;
        setSteamGames(sg);
        setSteamLoaded(true);
        return sg;
      })
      .catch(() => {
        if (steamLoadRef.current !== request) return [] as SteamGame[];
        if (!steamLoadedRef.current) {
          steamGamesRef.current = [];
          steamLoadedRef.current = true;
          setSteamGames([]);
          setSteamLoaded(true);
        }
        return steamGamesRef.current;
      })
      .finally(() => {
        if (steamLoadRef.current === request) {
          steamLoadRef.current = null;
          setSteamLoading(false);
        }
      });

    steamLoadRef.current = request;
    return request;
  }, []);

  const refresh = useCallback(() => {
    // Fire core requests in parallel — no single failure blocks the rest.
    // Steam library scanning is intentionally lazy because it can parse large local Steam files.
    invoke<GameInfo[]>("get_games")
      .then(setGames)
      .catch(() => {});
    invoke<Stats>("get_stats")
      .then(setStats)
      .catch(() => {});
    invoke<Config>("get_config")
      .then(setConfig)
      .catch(() => {});
    invoke<string[]>("get_favorites")
      .then((favs) => setFavorites(new Set(favs)))
      .catch(() => {});
  }, []);

  // Initial core load. Steam data is loaded on demand by Steam-dependent pages.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      invoke<GameInfo[]>("get_games").catch(() => [] as GameInfo[]),
      invoke<Stats>("get_stats").catch(() => null),
      invoke<Config>("get_config").catch(() => null),
      invoke<string[]>("get_favorites").catch(() => [] as string[]),
    ]).then(([g, s, c, favs]) => {
      if (cancelled) return;
      setGames(g);
      setStats(s);
      setConfig(c);
      setFavorites(new Set(favs));
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  const toggleFavorite = useCallback(async (gameId: string): Promise<boolean> => {
    try {
      const isFav = await invoke<boolean>("toggle_favorite", { gameId });
      setFavorites((prev) => {
        const next = new Set(prev);
        if (isFav) next.add(gameId);
        else next.delete(gameId);
        return next;
      });
      return isFav;
    } catch {
      return false;
    }
  }, []);

  const updateSteamGames = useCallback((updater: (games: SteamGame[]) => SteamGame[]) => {
    setSteamGames((prev) => {
      const next = updater(prev);
      steamGamesRef.current = next;
      return next;
    });
  }, []);

  // Periodic core refresh (every 30s). Do not rescan Steam here.
  useEffect(() => {
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <AppDataContext.Provider value={{
      games,
      stats,
      config,
      steamGames,
      steamLoading,
      steamLoaded,
      favorites,
      loading,
      refresh,
      ensureSteamGames,
      toggleFavorite,
      setGames,
      updateSteamGames,
    }}>
      {children}
    </AppDataContext.Provider>
  );
}
