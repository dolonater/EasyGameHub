import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { patchSteamHubCache, useSteamHubCache } from "../lib/steamHubCache";
import type { SessionDto, WishlistItemDto } from "../lib/steamCommunity";

/**
 * Public Steam wishlist for the logged-in user.
 *
 * Requires a session. Fetches only while `enabled` is true, so the page can
 * defer loading until the wishlist tab is actually opened instead of firing a
 * cross-region request on every Steam page mount. Items are kept in the shared
 * Steam Hub cache, so re-opening the tab renders the last snapshot instantly
 * and refreshes silently. On any error (not logged in / wishlist private /
 * network) the list is cleared and `error` is set so consumers can fall back
 * to the local watchlist with an appropriate notice.
 */
export function useSteamWishlist(session: SessionDto | null, enabled = true) {
  const { wishItems, wishError, wishLoadedOnce } = useSteamHubCache();
  const [fetching, setFetching] = useState(false);

  const refresh = useCallback(async () => {
    if (!session) {
      patchSteamHubCache({ wishItems: [], wishError: false, wishLoadedOnce: true });
      return;
    }
    setFetching(true);
    try {
      const list = await invoke<WishlistItemDto[]>("get_steam_wishlist");
      patchSteamHubCache({ wishItems: list, wishError: false });
    } catch {
      patchSteamHubCache({ wishItems: [], wishError: true });
    } finally {
      setFetching(false);
      patchSteamHubCache({ wishLoadedOnce: true });
    }
  }, [session]);

  useEffect(() => {
    if (enabled) void refresh();
  }, [refresh, enabled]);

  // Memoized so consumers get a stable reference and do not re-fetch on every
  // unrelated re-render.
  const appIds = useMemo(() => wishItems.map((item) => item.appId), [wishItems]);
  return {
    items: wishItems,
    appIds,
    error: wishError,
    // Show a spinner only on the first fetch of the session; once loaded
    // (even to an empty list), re-fetching happens silently in the background.
    loading: !wishLoadedOnce && fetching,
    refresh,
  };
}
