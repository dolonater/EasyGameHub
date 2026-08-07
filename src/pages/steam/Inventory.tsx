import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { useAppData } from "../../hooks/useAppData";
import useRunningGames from "../../hooks/useRunningGames";
import GameCard from "../../components/ui/GameCard";
import GlassCard from "../../components/ui/GlassCard";
import GlassListCard from "../../components/ui/GlassListCard";
import EditGameDialog from "../../components/EditGameDialog";
import AchievementsDialog from "../../components/AchievementsDialog";
import CloudSavesDialog from "../../components/CloudSavesDialog";
import { showToast } from "../../components/Notification";
import { useAnimation } from "../../hooks/useAnimation";
import { useCoverCardStyle } from "../../lib/coverCardStyle";
import BookmarkToggle from "../../components/ui/BookmarkToggle";
import Icon from "../../components/ui/Icon";
import { useAnimatedHeight } from "../../hooks/useAnimatedHeight";
import { staggerStyle } from "../../lib/animation";
import TabButtons from "../../components/ui/TabButtons";
import Select from "../../components/ui/Select";
import SearchInput from "../../components/ui/SearchInput";
import ContextMenu, { type MenuItem } from "../../components/ui/ContextMenu";
import { startSteamInstall } from "../../lib/steamInstall";
import { formatTimestamp } from "../../lib/types";
import {
  buildLibraryGames,
  loadLibraryViewMode,
  selectLibraryGames,
  type LibraryGameItem,
  type LibraryInstallFilter,
  type LibrarySortKey,
  type LibrarySourceFilter,
} from "../../lib/gameLibrary";

function formatPlaytime(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `${hours}h ${remaining > 0 ? `${remaining}m` : ""}`;
}

function isAbsolutePath(path: string | null | undefined) {
  return !!path && (/^[A-Za-z]:[\\/]/.test(path) || path.startsWith("\\\\"));
}

export default function Inventory() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const anim = useAnimation();
  const { runningGames, refresh: refreshRunning } = useRunningGames();
  const { games: trackedGames, steamGames, steamLoading, steamLoaded, ensureSteamGames, updateSteamGames, favorites, loading, refresh, toggleFavorite } = useAppData();
  const coverCardStyle = useCoverCardStyle();

  const [sourceFilter, setSourceFilter] = useState<LibrarySourceFilter>("all");
  const [installFilter, setInstallFilter] = useState<LibraryInstallFilter>("all");
  const [showHidden, setShowHidden] = useState(false);
  const [sortKey, setSortKey] = useState<LibrarySortKey>("last_backup");
  const [view, setView] = useState(loadLibraryViewMode);
  const [search, setSearch] = useState("");
  const [launchConfigGameIds, setLaunchConfigGameIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; game: LibraryGameItem } | null>(null);
  const [editDialog, setEditDialog] = useState<{ appId: number; name: string; installDir: string | null; installPath: string | null; sizeOnDisk: number | null } | null>(null);
  const [achievementsTarget, setAchievementsTarget] = useState<{ appId: number; gameName: string } | null>(null);
  const [cloudDialogTarget, setCloudDialogTarget] = useState<{ appId: number; gameName: string | null } | null>(null);
  const viewAnim = useAnimatedHeight(view, anim);

  useEffect(() => {
    const handler = () => setContextMenu(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  useEffect(() => {
    void ensureSteamGames();
  }, [ensureSteamGames]);

  useEffect(() => {
    let cancelled = false;

    if (trackedGames.length === 0) {
      setLaunchConfigGameIds(new Set());
      return;
    }

    void Promise.all(
      trackedGames.map(async (game) => ({
        gameId: game.id,
        launchConfig: await invoke("get_launch_config", { gameId: game.id }).catch(() => null),
      })),
    ).then((results) => {
      if (cancelled) return;
      setLaunchConfigGameIds(new Set(results.filter((item) => item.launchConfig).map((item) => item.gameId)));
    });

    return () => {
      cancelled = true;
    };
  }, [trackedGames]);

  const libraryGames = useMemo(() => buildLibraryGames({
    games: trackedGames,
    steamGames,
    favorites,
    runningGames,
    launchConfigGameIds,
  }), [trackedGames, steamGames, favorites, runningGames, launchConfigGameIds]);

  const libraryStats = useMemo(() => ({
    total: libraryGames.length,
    installed: libraryGames.filter((game) => game.isInstalled).length,
    tracked: libraryGames.filter((game) => game.isTracked).length,
    hidden: libraryGames.filter((game) => game.isHidden).length,
  }), [libraryGames]);

  const visibleGames = useMemo(() => selectLibraryGames(libraryGames, {
    sourceFilter,
    installFilter,
    search,
    showHidden,
    sortKey,
  }), [libraryGames, sourceFilter, installFilter, search, showHidden, sortKey]);

  const hiddenCount = libraryStats.hidden;

  const handleViewChange = (v: string) => {
    setView(v as "list" | "grid");
    try { localStorage.setItem("doona-library-view", v); } catch {}
  };

  const handleContextMenu = (e: React.MouseEvent, game: LibraryGameItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, game });
  };

  const handleLaunch = async (game: LibraryGameItem) => {
    try {
      if (!game.isTracked && game.steam_app_id) {
        if (game.isInstalled) {
          await invoke("open_url", { url: `steam://rungameid/${game.steam_app_id}` });
          showSteamToast(game.name, t("launcher.launching"));
          setTimeout(refreshRunning, 2000);
        } else {
          await startSteamInstall(game.steam_app_id, game.name, t);
        }
        return;
      }

      await invoke("launch_game", { gameId: game.id });
      showSteamToast(game.name, t("launcher.launching"));
      setTimeout(refreshRunning, 2000);
    } catch (e: any) {
      const msg = String(e);
      if (msg.includes("No executable configured")) {
        void handleSetExe(game);
      } else {
        showSteamToast(game.name, msg, true);
      }
    }
  };

  const handleSetExe = async (game: LibraryGameItem) => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const file = await open({ multiple: false, filters: [{ name: "Executable", extensions: ["exe"] }] });
      if (file) {
        await invoke("set_launch_config", { gameId: game.id, exePath: file as string, args: null });
        await ensureSteamGames(true);
        refresh();
        showSteamToast(game.name, t("launcher.exeSet"));
      }
    } catch (e: any) {
      showSteamToast(game.name, String(e), true);
    }
  };

  const handleToggleFavorite = async (game: LibraryGameItem) => {
    if (!game.isTracked) return;
    try {
      await toggleFavorite(game.id);
    } catch (e: any) {
      showSteamToast(game.name, String(e), true);
    }
  };

  const handleTogglePin = async (game: LibraryGameItem) => {
    if (!game.isTracked) return;
    try {
      await invoke(game.pinned ? "unpin_game" : "pin_game", { gameId: game.id });
      refresh();
    } catch (e: any) {
      showSteamToast(game.name, String(e), true);
    }
  };

  const handleViewDetails = (game: LibraryGameItem) => {
    if (!game.isTracked) return;
    navigate(`/profile/${encodeURIComponent(game.id)}`);
  };

  const handleSteamView = (appId: number) => {
    setContextMenu(null);
    void invoke("open_url", { url: `steam://nav/games/details/${appId}` });
  };

  const handleScreenshots = (appId: number) => {
    setContextMenu(null);
    void invoke("open_url", { url: `steam://open/screenshots/${appId}` });
  };

  const handleStorePage = (appId: number) => {
    setContextMenu(null);
    void invoke("open_url", { url: `https://store.steampowered.com/app/${appId}` });
  };

  const handleOpenFolder = async (game: LibraryGameItem) => {
    setContextMenu(null);

    let path: string | null = null;

    if (game.steam_app_id) {
      try {
        const resolvedPath = await invoke<string>("find_steam_exe_path", { appId: game.steam_app_id });
        if (isAbsolutePath(resolvedPath)) {
          path = resolvedPath;
        }
      } catch {}
    }

    if (!path && isAbsolutePath(game.installPath)) {
      path = game.installPath;
    }

    if (!path && isAbsolutePath(game.installDir)) {
      path = game.installDir;
    }

    if (path) {
      void invoke("open_in_explorer", { path }).catch((e) => showSteamToast(game.name, String(e), true));
    } else {
      showSteamToast(game.name, t("steam.installDir") || "Install path not available", true);
    }
  };

  const handleCloudArchive = (appId: number, gameName: string | null) => {
    setContextMenu(null);
    setCloudDialogTarget({ appId, gameName });
  };

  const handleAchievements = (appId: number, gameName: string | null) => {
    setContextMenu(null);
    setAchievementsTarget({ appId, gameName: gameName || `App ${appId}` });
  };

  const handleToggleHide = async (appId: number) => {
    setContextMenu(null);
    try {
      const hidden = await invoke<boolean>("toggle_hide_game", { appId });
      updateSteamGames((prev) => prev.map((game) => (
        game.appId === appId ? { ...game, isHidden: hidden } : game
      )));
    } catch (e: any) {
      showSteamToast(`App ${appId}`, String(e), true);
    }
  };

  const handleEditInfo = (game: LibraryGameItem) => {
    if (!game.steam_app_id) return;
    setContextMenu(null);
    setEditDialog({
      appId: game.steam_app_id,
      name: game.name || `App ${game.steam_app_id}`,
      installDir: game.installDir,
      installPath: game.installPath,
      sizeOnDisk: game.sizeOnDisk,
    });
  };

  const handleAddToMonitor = async (game: LibraryGameItem) => {
    setContextMenu(null);
    try {
      if (!game.steam_app_id) return;
      await invoke("add_game", {
        name: game.name || `App ${game.steam_app_id}`,
        savePath: game.installPath || game.installDir || "",
        gameId: `steam-${game.steam_app_id}`,
      });
      showSteamToast(game.name, t("steam.addedToMonitor") || "Added to monitor");
    } catch (e: any) {
      showSteamToast(game.name, String(e), true);
    }
  };

  const handleCardClick = (game: LibraryGameItem) => {
    if (!game.isTracked) return;
    navigate(`/profile/${encodeURIComponent(game.id)}`);
  };

  const formatRevealText = (game: LibraryGameItem) => {
    if (game.playtimeMinutes > 0) return formatPlaytime(game.playtimeMinutes);
    return "";
  };

  const buildTags = (game: LibraryGameItem) => {
    const tags: string[] = [];

    if (game.pinned) {
      tags.push(t("contextMenu.pin") || "Pinned");
    }

    return tags;
  };

  if (loading || steamLoading || !steamLoaded) {
    return <div className="text-muted-foreground py-16 text-center">{t("common.loading")}</div>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("steam.libraryPageTitle", { defaultValue: "游戏库" })}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {t("steam.librarySummary", {
              total: libraryStats.total,
              installed: libraryStats.installed,
              defaultValue: `${libraryStats.total} games · ${libraryStats.installed} installed`,
            })}
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("games.search")}
            className="w-[min(154px,29.4vw)] max-w-[154px] shrink !h-[28px]"
          />
          <Select
            name="inv-filter-sort"
            value={sourceFilter === "favorites" ? "favorites" : installFilter === "installed" ? "installed" : installFilter === "uninstalled" ? "uninstalled" : sortKey}
            onChange={(v) => {
              if (v === "favorites") {
                setSourceFilter("favorites");
                setInstallFilter("all");
                return;
              }
              if (v === "installed" || v === "uninstalled") {
                setSourceFilter("all");
                setInstallFilter(v as LibraryInstallFilter);
                return;
              }
              setSourceFilter("all");
              setInstallFilter("all");
              setSortKey(v as LibrarySortKey);
            }}
            options={[
              { value: "playtime", label: t("steam.sortPlaytime") },
              { value: "name", label: t("games.sortAZ") },
              { value: "favorites", label: t("launcher.favorite") },
              { value: "installed", label: t("steam.installedGames") },
              { value: "uninstalled", label: t("steam.uninstalledGames") },
              { value: "last_backup", label: t("steam.sortLastBackup") || t("games.sortNewest") },
              { value: "snapshot_count", label: t("steam.sortSnapshotCount") || t("games.snap") },
            ]}
            className="shrink-0"
          />
          <TabButtons
            name="inv-view"
            value={view}
            onChange={(v) => handleViewChange(v)}
            size="sm"
            className="shrink-0 [&_label]:py-[5px]"
            options={[
              { value: "list", label: <Icon name="list" size={16} /> },
              { value: "grid", label: <Icon name="grid" size={16} /> },
            ]}
          />
        </div>
      </div>

      {hiddenCount > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <TabButtons
            name="inv-hidden"
            value={showHidden ? "show" : "hide"}
            size="sm"
            onChange={(v) => setShowHidden(v === "show")}
            options={[
              { value: "hide", label: <span className="inline-flex items-center gap-1"><Icon name="eyeSlash" size={14} /> {hiddenCount} {t("steam.hidden") || "hidden"}</span> },
              { value: "show", label: t("steam.showHidden") || t("steam.hideHidden") || "Show Hidden" },
            ]}
          />
        </div>
      )}

      {visibleGames.length === 0 ? (
        <GlassCard className="text-center py-12 rounded-xl">
          <Icon name="launcher" size={40} className="mx-auto mb-3 text-muted-foreground" />
          <div className="text-muted-foreground">{t("steam.noGames")}</div>
        </GlassCard>
      ) : (
        <div ref={viewAnim.outerRef} style={viewAnim.outerStyle} onTransitionEnd={viewAnim.onTransitionEnd} className={viewAnim.outerClassName}>
          <div ref={viewAnim.innerRef}>
            {view === "list" ? (
              <div key={view} className={`space-y-2 ${anim ? "animate-fade-in" : ""}`}>
                {visibleGames.map((game, index) => {
                  const sid = game.steam_app_id;
                  const hasSteamIdentity = sid != null;
                  return (
                    <GlassListCard
                      key={game.id}
                      onContextMenu={(e) => handleContextMenu(e, game)}
                      onClick={game.isTracked ? () => handleCardClick(game) : undefined}
                      style={staggerStyle(index, anim)}
                      className={`${anim ? "animate-rise-in" : ""} ${game.isTracked ? "cursor-pointer" : "cursor-default"}`}
                    >
                      <div className="flex gap-4">
                        <div className="w-[138px] flex-shrink-0 aspect-[460/215] bg-secondary/20 rounded-md overflow-hidden m-2 mr-0 relative">
                          {hasSteamIdentity ? (
                            <img
                              src={`https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${sid}/header.jpg`}
                              alt=""
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${sid}/capsule_616x353.jpg`;
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-lg text-muted-foreground/30 font-bold">
                              {(game.name || "?").charAt(0).toUpperCase()}
                            </div>
                          )}
                          {game.pinned && (
                            <Icon name="pin" size={14} className="absolute top-1 left-1 z-10 drop-shadow-sm text-foreground dark:text-white/85" />
                          )}
                          <span className={`absolute top-1 right-1 z-10 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-black ${game.isInstalled ? "bg-green-500" : "bg-muted-foreground/40"}`}>
                            {game.isRunning && <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-30" />}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 py-2 pr-3">
                          <div className="flex items-start gap-3 mb-0.5">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="font-semibold text-sm truncate">{game.name}</h3>
                                {game.isRunning && (
                                  <span className="text-[9px] bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                                    {t("games.status.active")}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                                <span>App {sid || "—"}</span>
                                {game.installDir && (
                                  <span className="truncate max-w-[150px]">
                                    <Icon name="folder" size={14} className="inline mr-1 align-text-bottom text-foreground dark:text-white/85" />
                                    {game.installDir}
                                  </span>
                                )}
                                {game.sizeOnDisk != null && game.sizeOnDisk > 0 && (
                                  <span>
                                    {game.sizeOnDisk > 1073741824
                                      ? `${(game.sizeOnDisk / 1073741824).toFixed(1)} GB`
                                      : `${Math.round(game.sizeOnDisk / 1048576)} MB`}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                                {game.playtimeMinutes > 0 ? (
                                  <span>{formatPlaytime(game.playtimeMinutes)}</span>
                                ) : game.isTracked ? (
                                  <>
                                    <span>{game.snapshot_count} {t("games.snap")}</span>
                                    <span>·</span>
                                    <span>{game.hasLaunchConfig ? (t("steam.launchConfigReady") || "启动已配置") : (t("steam.launchConfigMissing") || "启动未配置")}</span>
                                  </>
                                ) : (
                                  <span>{t("games.noLastBackup")}</span>
                                )}
                              </div>
                            </div>
                            {game.isTracked && game.isFavorite && (
                              <div className="flex w-8 flex-shrink-0 justify-end" onClick={(e) => e.stopPropagation()}>
                                <BookmarkToggle
                                  checked={game.isFavorite}
                                  onChange={() => { void handleToggleFavorite(game); }}
                                  size={18}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </GlassListCard>
                  );
                })}
              </div>
            ) : (
              <div key={view} className={`grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 ${anim ? "animate-fade-in" : ""}`}>
                {visibleGames.map((game, index) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    isRunning={game.isRunning}
                    statusDotState={game.isInstalled ? "installed" : "muted"}
                    isFavorite={game.isFavorite}
                    onToggleFavorite={(g) => { void handleToggleFavorite(g as LibraryGameItem); }}
                    onClick={game.isTracked ? () => handleCardClick(game) : undefined}
                    onContextMenu={(e, g) => handleContextMenu(e, g as LibraryGameItem)}
                    lastBackup={game.last_backup}
                    snapshotCount={game.snapshot_count}
                    cardStyle={coverCardStyle}
                    revealText={formatRevealText(game)}
                    tags={buildTags(game)}
                    className={`${anim ? "animate-rise-in" : ""} ${game.isTracked ? "" : "cursor-default"}`}
                    style={staggerStyle(index, anim)}
                    t={t}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {contextMenu && (() => {
        const g = contextMenu.game;
        const sid = g.steam_app_id;
        const items: MenuItem[] = [];

        if (sid) {
          items.push({
            label: g.isInstalled ? (t("steam.launch") || "Launch") : (t("steam.install") || "Install"),
            onClick: () => { void handleLaunch(g); },
          });
        } else if (g.isTracked) {
          items.push({ label: t("launcher.playNow") || "Play Now", onClick: () => { void handleLaunch(g); } });
        }

        if (g.isTracked) {
          items.push({ label: g.isFavorite ? t("launcher.unfavorite") : t("launcher.favorite"), onClick: () => { void handleToggleFavorite(g); } });
          items.push({ label: g.pinned ? t("contextMenu.unpin") : t("contextMenu.pin"), onClick: () => { void handleTogglePin(g); } });
          items.push({ label: t("steam.viewDetails") || "View Details", onClick: () => handleViewDetails(g) });
          items.push({ label: t("launcher.setExe"), onClick: () => { void handleSetExe(g); } });
          items.push({ label: t("launcher.browseFolder"), onClick: () => { void handleOpenFolder(g); } });
        }

        if (sid) {
          items.push({ label: t("steam.steamClientView") || "View in Steam Client", onClick: () => handleSteamView(sid), sepBefore: true });
          items.push({ label: t("steam.storePage") || "Steam Store Page", onClick: () => handleStorePage(sid) });
          items.push({ label: t("steam.screenshots") || "Screenshots", onClick: () => handleScreenshots(sid) });
          items.push({ label: t("steam.achievements") || "Achievements", onClick: () => handleAchievements(sid, g.name) });
          items.push({ label: t("steam.cloudSaves") || "Cloud Saves", onClick: () => handleCloudArchive(sid, g.name) });
        }

        if (!g.isTracked && sid && (g.installPath || g.installDir)) {
          items.push({ label: t("steam.addToBackup") || "Add to Backup", onClick: () => { void handleAddToMonitor(g); }, sepBefore: true });
        }

        if (sid) {
          items.push({ label: t("steam.editGameInfo") || "Edit Game Info", onClick: () => handleEditInfo(g) });
          items.push({
            label: g.isHidden ? (t("steam.unhideGame") || "Unhide Game") : (t("steam.hideGame") || "Hide Game"),
            onClick: () => { void handleToggleHide(sid); },
            sepBefore: true,
          });
        }

        if (g.isTracked && runningGames.has(g.id)) {
          items.push({
            label: t("launcher.stopGame") || "Stop Game",
            onClick: () => { void invoke("stop_game", { gameId: g.id }).then(refreshRunning); },
            danger: true,
            sepBefore: true,
          });
        }

        return <ContextMenu x={contextMenu.x} y={contextMenu.y} items={items} onClose={() => setContextMenu(null)} />;
      })()}

      {editDialog && (
        <EditGameDialog
          appId={editDialog.appId}
          name={editDialog.name}
          installDir={editDialog.installDir}
          installPath={editDialog.installPath}
          sizeOnDisk={editDialog.sizeOnDisk}
          onClose={() => setEditDialog(null)}
          onSaved={() => { void ensureSteamGames(true); refresh(); }}
        />
      )}

      <CloudSavesDialog
        open={cloudDialogTarget !== null}
        appId={cloudDialogTarget?.appId ?? null}
        gameName={cloudDialogTarget?.gameName}
        onClose={() => setCloudDialogTarget(null)}
      />

      <AchievementsDialog
        open={!!achievementsTarget}
        appId={achievementsTarget?.appId ?? null}
        gameName={achievementsTarget?.gameName}
        onClose={() => setAchievementsTarget(null)}
      />
    </div>
  );
}

function showSteamToast(gameName: string, message: string, isError = false) {
  showToast(isError ? "error" : "success", gameName ? `${gameName}: ${message}` : message);
}
