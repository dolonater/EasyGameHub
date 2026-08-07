import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SessionDto, WishlistItemDto } from "../lib/steamCommunity";

/**
 * Public Steam wishlist for the logged-in user.
 *
 * Requires a session. Fetches only while `enabled` is true, so the page can
 * defer loading until the wishlist tab is actually opened instead of firing a
 * cross-region request on every Steam page mount. On any error (not logged in
 * / wishlist private / network) the list is cleared and `error` is set so
 * consumers can fall back to the local watchlist with an appropriate notice.
 */
export function useSteamWishlist(session: SessionDto | null, enabled = true) {
  const [items, setItems] = useState<WishlistItemDto[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!session) {
      setItems([]);
      setError(false);
      return;
    }
    setLoading(true);
    try {
      const list = await invoke<WishlistItemDto[]>("get_steam_wishlist");
      setItems(list);
      setError(false);
    } catch {
      setItems([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (enabled) void refresh();
  }, [refresh, enabled]);

  const appIds = items.map((item) => item.appId);
  return { items, appIds, error, loading, refresh };
}
