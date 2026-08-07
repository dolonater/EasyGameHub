import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { WatchItemDto } from "../lib/steamCommunity";

/**
 * Manual watchlist (`steam_watchlist.json`) that drives the news feed before
 * the wishlist lands (Phase 4). Exposes appIds + name lookup for consumers.
 */
export function useSteamWatchlist() {
  const [items, setItems] = useState<WatchItemDto[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const list = await invoke<WatchItemDto[]>("get_manual_watchlist");
      setItems(list);
    } catch {
      // Ignore — keep current list.
    } finally {
      setLoading(false);
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

  const appIds = items.map((item) => item.appId);
  const appNames = Object.fromEntries(
    items.map((item) => [item.appId, item.name || `App ${item.appId}`])
  ) as Record<number, string>;

  return { items, appIds, appNames, loading, refresh, add, remove };
}
