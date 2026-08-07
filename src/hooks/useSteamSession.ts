import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { patchSteamHubCache, useSteamHubCache } from "../lib/steamHubCache";
import type { SessionDto, SteamProfileDto } from "../lib/steamCommunity";

/**
 * Session + profile state for the Steam hub.
 *
 * Data lives in a module-level cache that survives route switches, so coming
 * back to the Steam page renders instantly from the last-loaded session and
 * refreshes silently in the background. Backend-side token auto-refresh
 * happens inside `get_active_session`, so a near-expiry token is renewed
 * transparently here.
 */
export function useSteamSession() {
  const { session, profile, hasLoaded } = useSteamHubCache();
  const [loginOpen, setLoginOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const active = await invoke<SessionDto | null>("get_active_session");
      patchSteamHubCache({ session: active });
      if (active) {
        const info = await invoke<SteamProfileDto>("get_steam_user_info", {
          steamId64: active.steamId,
        });
        patchSteamHubCache({ profile: info });
      } else {
        patchSteamHubCache({ profile: null });
      }
    } catch {
      // Session lookup may fail (no session store); keep current state.
    } finally {
      patchSteamHubCache({ hasLoaded: true });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await invoke("logout");
    } catch {
      // Ignore — still clear the local state.
    }
    patchSteamHubCache({ session: null, profile: null });
  }, []);

  return {
    session,
    profile,
    // Only the very first load in the whole app session shows a spinner;
    // afterwards the cached snapshot renders immediately.
    loading: !hasLoaded,
    loginOpen,
    setLoginOpen,
    refresh,
    logout,
  };
}
