import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SessionDto, SteamProfileDto } from "../lib/steamCommunity";

/**
 * Session + profile state for the Steam hub.
 *
 * `refresh()` reloads the active session and, when present, the public
 * profile (mini-profile API). Backend-side token auto-refresh happens inside
 * `get_active_session`, so a near-expiry token is renewed transparently here.
 */
export function useSteamSession() {
  const [session, setSession] = useState<SessionDto | null>(null);
  const [profile, setProfile] = useState<SteamProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const active = await invoke<SessionDto | null>("get_active_session");
      setSession(active);
      if (active) {
        const info = await invoke<SteamProfileDto>("get_steam_user_info", {
          steamId64: active.steamId,
        });
        setProfile(info);
      } else {
        setProfile(null);
      }
    } catch {
      // Session lookup may fail (no session store); keep current state.
    } finally {
      setLoading(false);
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
    setSession(null);
    setProfile(null);
  }, []);

  return {
    session,
    profile,
    loading,
    loginOpen,
    setLoginOpen,
    refresh,
    logout,
  };
}
