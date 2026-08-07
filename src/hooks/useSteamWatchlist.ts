import { useCallback, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { patchSteamHubCache, useSteamHubCache } from "../lib/steamHubCache";
import type { WatchItemDto } from "../lib/steamCommunity";

/**
 * Manual watchlist (`steam_watchlist.json`) that drives the news feed before
 * the wishlist lands (Phase 4). Exposes appIds + name lookup for consumers.
 *
 * Kept in the shared Steam Hub cache so it survives route switches.
 */
export function useSteamWatchlist() {
  const { watchItems, hasLoaded } = useSteamHubCache();

  const refresh = useCallback(async () => {
    try {
      const list = await invoke<WatchItemDto[]>("get_manual_watchlist");
      patchSteamHubCache({ watchItems: list });
    } catch {
      // Ignore — keep current list.
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback(
    async (appId: number, name?: string) => {
      await invoke("add_manual_watch", { appId, name: name || null });
      await refresh();
    },
    [refresh]
  );

  const remove = useCallback(
    async (appId: number) => {
      await invoke("remove_manual_watch", { appId });
      await refresh();
    },
    [refresh]
  );

  // Memoized so consumers (NewsFeed effects etc.) get a stable reference and
  // do not re-fetch on every unrelated re-render.
  const appIds = useMemo(() => watchItems.map((item) => item.appId), [watchItems]);
  const appNames = useMemo(
    () =>
      Object.fromEntries(
        watchItems.map((item) => [item.appId, item.name || `App ${item.appId}`])
      ) as Record<number, string>,
    [watchItems]
  );

  return {
    items: watchItems,
    appIds,
    appNames,
    loading: !hasLoaded,
    refresh,
    add,
    remove,
  };
}
