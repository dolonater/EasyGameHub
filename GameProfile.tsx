import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import type { GameInfo } from "../lib/types";
import { useAppData } from "../hooks/useAppData";
import GameIcon from "../components/GameIcon";
import { showToast } from "../components/Notification";
import AchievementsDialog from "../components/AchievementsDialog";
import CloudSavesDialog from "../components/CloudSavesDialog";
import Button from "../components/ui/Button";
import BookmarkToggle from "../components/ui/BookmarkToggle";
import useRunningGames from "../hooks/useRunningGames";
import Icon from "../components/ui/Icon";
import { createRouteSessionCache, routeCacheKey } from "../lib/routeSessionCache";
import { useRouteCachedLoader } from "../hooks/useRouteCachedLoader";

interface GameProfileData {
  game: GameInfo | null;
  playtime: number;
  launchConfig: any;
}

const gameProfileSessionCache = createRouteSessionCache<GameProfileData>();

function isAbsolutePath(path: string | null | undefined) {
  return !!path && (/^[A-Za-z]:[\\/]/.test(path) || path.startsWith("\\\\"));
}

export default function GameProfile() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { favorites, toggleFavorite, steamGames } = useAppData();
  const { runningGames } = useRunningGames();
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [cloudSavesOpen, setCloudSavesOpen] = useState(false);
  const decodedId = id ? decodeURIComponent(id) : "";

  const { data, loading, refresh } = useRouteCachedLoader<GameProfileData>({
    cache: gameProfileSessionCache,
    key: routeCacheKey("game-profile", { id: decodedId }),
    enabled: !!decodedId,
    load: async () => {
      const profile = await invoke<{ game: GameInfo; playtime_seconds: number; is_favorite: boolean; launch_config: any }>(
        "get_game_profile",
        { gameId: decodedId },
      );
      return {
        game: profile.game,
        playtime: profile.playtime_seconds,
        launchConfig: profile.launch_config,
      };
    },
    onError: console.error,
  });

  const game = data?.game ?? null;
  const playtime = data?.playtime ?? 0;
  const steamPlaytimeMinutes = game?.steam_app_id
    ? (steamGames.find((steamGame) => steamGame.appId === game.steam_app_id)?.playtimeMinutes ?? 0)
    : 0;
  const launchConfig = data?.launchConfig ?? null;

  const handleLaunch = async () => {
    if (!game) return;
    try {
      await invoke("launch_game", { gameId: game.id });
      showToast("success", `${t("launcher.launching")} ${game.name}`);
    } catch (e: any) {
      const msg = String(e);
      if (msg.includes("No executable configured")) {
        handleSetExe();
      } else {
        showToast("error", msg);
      }
    }
  };

  const handleSetExe = async () => {
    if (!game) return;
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const file = await open({ multiple: false, filters: [{ name: "Executable", extensions: ["exe"] }] });
      if (file) {
        await invoke("set_launch_config", { gameId: game.id, exePath: file as string, args: null });
        await refresh({ force: true, keepVisible: true });
        showToast("success", t("launcher.exeSet"));
      }
    } catch (e: any) {
      showToast("error", String(e));
    }
  };

  const handleToggleFavorite = async () => {
    if (!game) return;
    try {
      await toggleFavorite(game.id);
    } catch (e: any) {
      showToast("error", String(e));
    }
  };

  const handleOpenInstallDir = async () => {
    let dir = launchConfig?.exe_path
      ? launchConfig.exe_path.replace(/\\[^\\]+\.exe$/i, "")
      : null;

    if (!dir && game?.steam_app_id) {
      try {
        dir = await invoke<string>("find_steam_exe_path", { appId: game.steam_app_id });
      } catch {}
    }

    if (!isAbsolutePath(dir)) {
      showToast("error", t("steam.installDir") || "Install path not available");
      return;
    }

    invoke("open_in_explorer", { path: dir }).catch((e) => {
      showToast("error", String(e));
    });
  };

  const formatPlaytime = (s: number) => {
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    return `${Math.floor(s / 3600)}h`;
  };

  const favorite = game ? favorites.has(game.id) : false;

  if (loading) return <div className="text-muted-foreground">{t("common.loading")}</div>;
  if (!game) return <div className="text-red-500">{t("gameDetail.gameNotFound")}</div>;

  return (
    <div>
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <Icon name="arrowLeft" size={14} /> {t("steam.libraryPageTitle")}
      </button>

      <div className="flex gap-6 mb-6">
        <div className="w-40 h-56 rounded-lg overflow-hidden bg-secondary flex-shrink-0">
          <GameIcon steamAppId={game.steam_app_id} name={game.name} className="w-full h-full text-4xl" />
        </div>

        <div className="flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold">{game.name}</h1>
              <BookmarkToggle
                checked={favorite}
                onChange={() => { void handleToggleFavorite(); }}
                size={20}
              />
            </div>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div>
                <div className="text-xs text-muted-foreground">{t("playtime.total")}</div>
                <div className="text-lg font-bold">{formatPlaytime(steamPlaytimeMinutes * 60 || playtime)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t("launcher.setExe")}</div>
                <div className="text-sm">{launchConfig ? "✓" : "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Steam ID</div>
                <div className="text-sm">{game.steam_app_id || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t("steam.achievements")}</div>
                {game.steam_app_id == null ? (
                  <div className="text-sm">—</div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAchievementsOpen(true)}
                    className="text-sm font-medium text-primary transition-opacity hover:opacity-80"
                  >
                    {t("steam.achievements")}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {runningGames.has(game.id) ? (
              <Button variant="primary" ripple={false} className="cursor-default">
                <Icon name="launcher" size={14} /> {t("launcher.playing")}
              </Button>
            ) : (
              <Button variant="primary" onClick={handleLaunch}>
                <Icon name="launcher" size={14} /> {t("launcher.playNow")}
              </Button>
            )}
            <Button variant="secondary" onClick={handleSetExe}>
              {launchConfig ? launchConfig.exe_path.split("\\").pop() : t("launcher.setExe")}
            </Button>
            <Button variant="secondary" onClick={handleOpenInstallDir}>
              <Icon name="folder" size={16} className="text-foreground dark:text-white/85" />
              {t("launcher.browseFolder")}
            </Button>
            {game.steam_app_id != null && (
              <Button variant="secondary" onClick={() => setCloudSavesOpen(true)}>
                <Icon name="cloud" size={16} className="text-foreground dark:text-white/85" />
                {t("steam.cloudSaves")}
              </Button>
            )}
          </div>
        </div>
      </div>
      <AchievementsDialog
        open={achievementsOpen}
        appId={game?.steam_app_id ?? null}
        gameName={game?.name}
        onClose={() => setAchievementsOpen(false)}
      />
      <CloudSavesDialog
        open={cloudSavesOpen}
        appId={game?.steam_app_id ?? null}
        gameName={game?.name}
        onClose={() => setCloudSavesOpen(false)}
      />
    </div>
  );
}
