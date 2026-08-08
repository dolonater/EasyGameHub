import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { showToast } from "../Notification";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import { patchSteamHubCache, useSteamHubCache } from "../../lib/steamHubCache";
import type { IconName } from "../../lib/icons";
import {
  formatPlaytimeMinutes,
  ownedGameIconUrl,
} from "../../lib/steamCommunity";
import type {
  LocalGameDto,
  OwnedGameDto,
  OverviewStats,
  SessionDto,
  SteamProfileDto,
} from "../../lib/steamCommunity";

interface ProfilePanelProps {
  session: SessionDto | null;
  profile: SteamProfileDto | null;
  onLogout: () => void;
  onSwitchAccount: () => void;
}

/** Minimal auth-entry shape returned by `get_auth_entries`. */
interface AuthEntryDto {
  id: string;
  issuer: string;
  accountName: string;
  code: string;
  period: number;
  remainingSeconds: number;
  steamId?: string | null;
}

/**
 * 概览 tab: a fuller profile summary card plus account-level library stats
 * (owned games, total playtime, recently played) and quick actions.
 */
export default function ProfilePanel({
  session,
  profile,
  onLogout,
  onSwitchAccount,
}: ProfilePanelProps) {
  const { t } = useTranslation();
  const { overviewStats } = useSteamHubCache();
  const [loading, setLoading] = useState(false);
  const [authEntries, setAuthEntries] = useState<AuthEntryDto[]>([]);

  // Poll authenticator entries while logged in so the overview can surface the
  // active account's Steam Guard code with a live countdown.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const list = await invoke<AuthEntryDto[]>("get_auth_entries");
        if (!cancelled) setAuthEntries(list);
      } catch {
        // Store unreadable — ignore; the code block simply stays hidden.
      }
    };
    void tick();
    const timer = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [session]);

  // Load account-level stats once per session (cached across tab switches).
  // Games count + total playtime come from the local library (offline, no API
  // key); recently played comes from the Web API and falls back to the most
  // played local games when no API key is configured.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [localGames, recent] = await Promise.all([
          invoke<LocalGameDto[]>("get_local_steam_games"),
          invoke<OwnedGameDto[]>("get_recently_played").catch(
            () => null as OwnedGameDto[] | null,
          ),
        ]);
        if (cancelled) return;

        let recentList = recent ?? [];
        let recentSource: OverviewStats["recentSource"] = "web";
        if (recentList.length === 0) {
          // Fall back to the most played local games.
          recentSource = "local";
          recentList = [...localGames]
            .sort((a, b) => b.playtimeMinutes - a.playtimeMinutes)
            .slice(0, 5)
            .map((g) => ({
              appid: g.appId,
              name: g.name,
              playtimeForever: g.playtimeMinutes,
              playtime2weeks: null,
              imgIconUrl: null,
              imgLogoUrl: null,
            }));
        }

        patchSteamHubCache({
          overviewStats: {
            gamesCount: localGames.length,
            totalMinutes: localGames.reduce(
              (sum, g) => sum + g.playtimeMinutes,
              0,
            ),
            recent: recentList.slice(0, 5),
            recentSource,
          },
        });
      } catch {
        // Local library unavailable (no Steam install) — leave stats empty.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (!session) {
    return (
      <div className="app-surface app-glass-card rounded-[var(--radius)] border border-border/40 py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <Icon name="steamLogin" size={32} />
        <div className="text-sm">{t("steam.overviewNoSession", { defaultValue: "登录后查看个人资料概览" })}</div>
      </div>
    );
  }

  const personaName = profile?.personaName || session.accountName;
  const avatarUrl = profile?.avatarUrl;

  const copySteamId = async () => {
    try {
      await navigator.clipboard.writeText(String(session.steamId));
      showToast("success", t("steam.copied"));
    } catch {
      // Ignore clipboard failures in the webview.
    }
  };

  const openProfile = () => {
    void invoke("open_url", { url: `https://steamcommunity.com/profiles/${session.steamId}` });
  };

  const matchingEntry = authEntries.find(
    (e) => e.steamId && session && e.steamId === session.steamId,
  );

  const copyGuardCode = async () => {
    if (!matchingEntry) return;
    try {
      await navigator.clipboard.writeText(matchingEntry.code);
      showToast("success", t("steam.copied"));
    } catch {
      // Ignore clipboard failures in the webview.
    }
  };

  const statCell = (icon: IconName, label: string, value: string) => (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Icon name={icon} size={18} />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="text-lg font-bold leading-tight">{value}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Profile summary */}
      <div className="app-surface app-glass-card rounded-[var(--radius)] border border-border/40 p-5">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={personaName}
              className="h-16 w-16 flex-none rounded-full border border-border/50 object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-primary/15 text-primary text-2xl font-bold">
              {personaName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-lg font-bold truncate">{personaName}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {profile?.level != null && (
                <span className="rounded-full border border-border/60 bg-secondary/40 px-2 py-0.5 text-[11px] font-medium">
                  {t("steam.levelBadge", { defaultValue: "Lv. {{level}}", level: profile.level })}
                </span>
              )}
              {/* Account name and SteamID as separate badges (SteamID copies). */}
              <span className="rounded-full border border-border/60 bg-secondary/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                {session.accountName}
              </span>
              <button
                type="button"
                onClick={() => void copySteamId()}
                className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-secondary/40 px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:border-primary/30 hover:text-primary"
                title={t("steam.copySteamId")}
              >
                {session.steamId}
                <Icon name="copy" size={10} />
              </button>
              {profile?.inGameName && (
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  <Icon name="launcher" size={12} />
                  {t("steam.inGame", { defaultValue: "游玩中" })} {profile.inGameName}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Steam Guard code for the active account, when an authenticator
            entry is bound to this session. */}
        {matchingEntry && (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-border/40 bg-secondary/30 p-2.5">
            <div className="inline-flex flex-none items-center gap-1 rounded bg-[#333] px-3 py-1.5 font-mono text-lg font-bold text-white tracking-wider">
              {(matchingEntry.code.match(/.{1,3}/g) || [matchingEntry.code]).map((part: string, i: number) => (
                <span key={i}>{part}</span>
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-muted-foreground">{t("steam.guardCode", { defaultValue: "Steam Guard" })}</div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-1000"
                    style={{ width: `${((matchingEntry.period - matchingEntry.remainingSeconds) / matchingEntry.period) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">{matchingEntry.remainingSeconds}s</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void copyGuardCode()}
              className="inline-flex flex-none items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              title={t("steam.copyGuardCode", { defaultValue: "复制验证码" })}
            >
              <Icon name="copy" size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Account-level library stats */}
      <div className="app-surface app-glass-card rounded-[var(--radius)] border border-border/40 p-4">
        <div className="grid grid-cols-2 gap-4">
          {statCell(
            "games",
            t("steam.overviewOwnedGames", { defaultValue: "拥有游戏" }),
            loading ? "–" : String(overviewStats?.gamesCount ?? "–"),
          )}
          {statCell(
            "clock",
            t("steam.overviewTotalPlaytime", { defaultValue: "总时长" }),
            loading || !overviewStats ? "–" : formatPlaytimeMinutes(overviewStats.totalMinutes),
          )}
        </div>

        <div className="mt-3 border-t border-border/40 pt-3">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm font-semibold">{t("steam.overviewRecentlyPlayed", { defaultValue: "最近游玩" })}</span>
            {overviewStats?.recentSource === "local" && (
              <span className="rounded-full border border-border/60 bg-secondary/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                {t("steam.overviewLocalFallback", { defaultValue: "本机游玩最多" })}
              </span>
            )}
          </div>
          {!overviewStats && loading && (
            <div className="py-3 text-xs text-muted-foreground">{t("common.loading")}</div>
          )}
          {overviewStats && overviewStats.recent.length === 0 && (
            <div className="py-3 text-xs text-muted-foreground">
              {t("steam.overviewRecentEmpty", { defaultValue: "暂无游玩记录" })}
            </div>
          )}
          {overviewStats && overviewStats.recent.map((game) => {
            const iconUrl = ownedGameIconUrl(game);
            return (
              <div key={game.appid} className="flex items-center gap-3 py-1.5">
                {iconUrl ? (
                  <img src={iconUrl} alt="" className="h-7 w-7 flex-none rounded object-cover" />
                ) : (
                  <div className="flex h-7 w-7 flex-none items-center justify-center rounded bg-secondary/40 text-muted-foreground">
                    <Icon name="steamInventory" size={14} />
                  </div>
                )}
                <span className="min-w-0 flex-1 truncate text-sm">{game.name || `App ${game.appid}`}</span>
                <span className="flex-none text-xs text-muted-foreground">
                  {formatPlaytimeMinutes(game.playtimeForever)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={openProfile} ripple={false}>
          <Icon name="externalLink" size={14} />
          {t("steam.openProfile", { defaultValue: "资料页" })}
        </Button>
        <Button variant="outline" size="sm" onClick={onSwitchAccount} ripple={false}>
          <Icon name="reset" size={14} />
          {t("steam.switch")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => void onLogout()} ripple={false}>
          {t("steamLogin.logout")}
        </Button>
      </div>
    </div>
  );
}
