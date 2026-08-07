import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import type { GameInfo, SortKey, ViewMode } from "../lib/types";
import { useAppData } from "../hooks/useAppData";
import { formatSize, formatTimestamp } from "../lib/types";
import { showToast } from "../components/Notification";
import GameIcon from "../components/GameIcon";
import GameBannerCard from "../components/ui/GameBannerCard";
import GameCard from "../components/ui/GameCard";
import Dialog from "../components/ui/Dialog";
import Button from "../components/ui/Button";
import AchievementsDialog from "../components/AchievementsDialog";
import AddGameDialog from "../components/AddGameDialog";
import OverviewDialog from "../components/OverviewDialog";
import GlassCard from "../components/ui/GlassCard";
import GlassListCard from "../components/ui/GlassListCard";
import { useAnimation } from "../hooks/useAnimation";
import { useCoverCardStyle } from "../lib/coverCardStyle";
import Icon from "../components/ui/Icon";
import { useAnimatedHeight } from "../hooks/useAnimatedHeight";
import { staggerStyle } from "../lib/animation";
import TabButtons from "../components/ui/TabButtons";
import Select from "../components/ui/Select";
import SearchInput from "../components/ui/SearchInput";
import ContextMenu, { type MenuItem } from "../components/ui/ContextMenu";
import Checkbox from "../components/ui/Checkbox";
import { createRouteSessionCache, routeCacheKey } from "../lib/routeSessionCache";
import { emit } from "../plugins/events";

type Tab = "monitored" | "available";

const DEFAULT_AVAILABLE_CACHE_KEY = routeCacheKey("game-list-available", { showAll: false });
const gameListAvailableSessionCache = createRouteSessionCache<GameInfo[]>();

function loadViewMode(): ViewMode {
  try { return (localStorage.getItem("doona-view") as ViewMode) || "list"; } catch { return "list"; }
}

export default function GameList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const anim = useAnimation();
  const coverCardStyle = useCoverCardStyle();
  const { games, loading, refresh } = useAppData();
  const [tab, setTab] = useState<Tab>("monitored");
  const [availableGames, setAvailableGames] = useState<GameInfo[]>(() => gameListAvailableSessionCache.get(DEFAULT_AVAILABLE_CACHE_KEY) || []);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [sort, setSort] = useState<SortKey>("last_backup");
  const [view, setView] = useState<ViewMode>(loadViewMode);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; game: GameInfo } | null>(null);
  const [achievementsTarget, setAchievementsTarget] = useState<{ appId: number; gameName: string } | null>(null);
  const [showOverview, setShowOverview] = useState(false);
  const [showAddGame, setShowAddGame] = useState(false);
  const [editPathGame, setEditPathGame] = useState<GameInfo | null>(null);
  const [editPathValue, setEditPathValue] = useState("");
  const [removeGame, setRemoveGame] = useState<GameInfo | null>(null);
  const [removeBackups, setRemoveBackups] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchConfirm, setBatchConfirm] = useState<"" | "backup" | "restore" | "delete">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const PAGE_SIZE = 50;
  const listTopRef = useRef<HTMLDivElement>(null);
  const availableCacheKeyRef = useRef<string | null>(gameListAvailableSessionCache.has(DEFAULT_AVAILABLE_CACHE_KEY) ? DEFAULT_AVAILABLE_CACHE_KEY : null);

  const scrollListTop = () => {
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const loadAvailable = useCallback((force = false) => {
    const cacheKey = routeCacheKey("game-list-available", { showAll });
    const cached = gameListAvailableSessionCache.get(cacheKey);

    if (!force && cached) {
      setAvailableGames(cached);
      availableCacheKeyRef.current = cacheKey;
      return Promise.resolve();
    }

    setLoadingAvailable(true);
    return invoke<GameInfo[]>("get_available_games", { showAll })
      .then((result) => {
        gameListAvailableSessionCache.set(cacheKey, result);
        setAvailableGames(result);
        availableCacheKeyRef.current = cacheKey;
      })
      .catch(console.error)
      .finally(() => setLoadingAvailable(false));
  }, [showAll]);

  useEffect(() => {
    if (!gameListAvailableSessionCache.has(DEFAULT_AVAILABLE_CACHE_KEY)) {
      setLoadingAvailable(true);
      invoke<GameInfo[]>("get_available_games", { showAll: false })
        .then((result) => {
          gameListAvailableSessionCache.set(DEFAULT_AVAILABLE_CACHE_KEY, result);
          if (!showAll) {
            setAvailableGames(result);
            availableCacheKeyRef.current = DEFAULT_AVAILABLE_CACHE_KEY;
          }
        })
        .catch(console.error)
        .finally(() => setLoadingAvailable(false));
    }
  }, [showAll]);

  useEffect(() => {
    if (tab !== "available") return;
    void loadAvailable();
  }, [loadAvailable, tab]);

  // Close context menu on any click
  useEffect(() => {
    const handler = () => setContextMenu(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const currentGames = tab === "monitored" ? games : availableGames;

  const sortedGames = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return [...currentGames]
      .sort((a, b) => {
        // Pinned always on top
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        // Then by selected sort key
        switch (sort) {
          case "name":
            return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
          case "last_backup": {
            const la = a.last_backup || "";
            const lb = b.last_backup || "";
            return lb.localeCompare(la); // newest first
          }
          case "snapshot_count":
            return b.snapshot_count - a.snapshot_count; // largest first
          default:
            return 0;
        }
      })
      .filter((g) => !normalizedSearch || g.name.toLowerCase().includes(normalizedSearch));
  }, [currentGames, search, sort]);

  // Pagination for available tab
  const totalPages = Math.ceil(sortedGames.length / PAGE_SIZE);
  const displayedGames = useMemo(() => (
    tab === "available"
      ? sortedGames.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
      : sortedGames
  ), [page, sortedGames, tab]);
  const viewAnim = useAnimatedHeight(`${tab}:${view}:${displayedGames.length}`, anim);

  const handleViewChange = (v: ViewMode) => {
    setView(v);
    try { localStorage.setItem("doona-view", v); } catch {}
  };

  const handleAdd = async (game: GameInfo) => {
    try {
      await invoke("add_game", { gameId: game.id, name: game.name, savePath: game.save_path });
      refresh();
      await loadAvailable(true);
    } catch (e: any) {
      alert(String(e));
    }
  };

  const handleContextMenu = (e: React.MouseEvent, game: GameInfo) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, game });
  };

  const handlePin = async (game: GameInfo) => {
    setContextMenu(null);
    try {
      if (game.pinned) {
        await invoke("unpin_game", { gameId: game.id });
      } else {
        await invoke("pin_game", { gameId: game.id });
      }
      refresh();
    } catch (e: any) {
      alert(String(e));
    }
  };

  const handleEditPath = (game: GameInfo) => {
    setContextMenu(null);
    setEditPathGame(game);
    setEditPathValue(game.save_path);
  };

  const handleSavePath = async () => {
    if (!editPathGame || !editPathValue.trim()) return;
    try {
      await invoke("update_game_path", { gameId: editPathGame.id, savePath: editPathValue.trim() });
      setEditPathGame(null);
      refresh();
    } catch (e: any) {
      alert(String(e));
    }
  };

  const handleBrowsePath = async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const folder = await open({ directory: true, multiple: false });
    if (folder) setEditPathValue(folder as string);
  };

  const handleRemoveGame = (game: GameInfo) => {
    setContextMenu(null);
    setRemoveGame(game);
    setRemoveBackups(false);
  };

  const handleRemoveConfirm = async () => {
    if (!removeGame) return;
    try {
      await invoke("remove_game", { gameId: removeGame.id, deleteBackups: removeBackups });
      emit("game:removed", { gameId: removeGame.id, name: removeGame.name });
      setRemoveGame(null);
      showToast("info", t("notification.gameRemoved", { name: removeGame.name, extra: removeBackups ? t("notification.gameRemovedWithBackups") : "" }));
      refresh();
      await loadAvailable(true);
    } catch (e: any) {
      alert(String(e));
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(displayedGames.map((g) => g.id)));
  };

  const clearSelection = () => setSelected(new Set());

  const switchTab = (t: Tab) => {
    setTab(t);
    setBatchMode(false);
    setSelected(new Set());
    setSearch("");
    setPage(1);
  };

  const handleBatchAction = async (action: "backup" | "restore" | "delete") => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    try {
      if (action === "backup") await invoke("batch_backup", { gameIds: ids });
      else if (action === "restore") await invoke("batch_restore", { gameIds: ids });
      else await invoke("batch_delete_snapshots", { gameIds: ids });
      const actionLabel = action === "backup" ? t("notification.batchDoneBackup", { count: ids.length }) : action === "restore" ? t("notification.batchDoneRestore", { count: ids.length }) : t("notification.batchDoneDelete", { count: ids.length });
      showToast("success", actionLabel);
      setSelected(new Set());
      setBatchConfirm("");
      refresh();
    } catch (e: any) {
      alert(String(e));
    }
  };

  if (loading) return <div className="text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-5">{t("games.title")}</h1>

      {/* Toolbar: tabs left, controls right */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        {/* Tabs */}
        <div className="flex items-stretch gap-2">
          <TabButtons
            name="gamelist-tab"
            value={tab}
            onChange={(v) => switchTab(v as Tab)}
            size="sm"
            options={[
              { value: "monitored", label: `${t("games.status.active")} (${games.length})` },
              { value: "available", label: `${t("games.status.unavailable")} (${availableGames.length})` },
            ]}
          />

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowOverview(true)}
            title={t("dashboard.title")}
            className="h-auto w-[30px] !p-0 !gap-0"
          >
            <Icon name="chart" size={17} />
          </Button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Sort */}
          <Select
            name="gamelist-sort"
            value={sort}
            onChange={(v) => setSort(v as SortKey)}
            options={[
              { value: "last_backup", label: t("games.sortNewest") },
              { value: "name", label: t("games.sortAZ") },
              { value: "snapshot_count", label: t("games.sortSize") },
            ]}
          />

          <TabButtons
            name="gamelist-view"
            value={view}
            onChange={(v) => handleViewChange(v as ViewMode)}
            size="sm"
            options={[
              { value: "list", label: <Icon name="list" size={16} /> },
              { value: "grid", label: <Icon name="grid" size={16} /> },
            ]}
          />

          {tab === "monitored" && (
            <>
              <Button
                variant={batchMode ? "primary" : "outline"}
                size="sm"
                onClick={() => { setBatchMode(!batchMode); setSelected(new Set()); }}
              >
                {t("games.batchOps")}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowAddGame(true)}
              >
                + {t("games.addGame")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Batch action bar */}
      {tab === "monitored" && batchMode && (
        <GlassCard className="flex items-center gap-2 mb-4 p-3 rounded-lg">
          <span className="text-sm font-medium">
            {selected.size > 0
              ? t("games.selected", { count: selected.size })
              : t("games.selectHint") || "Select games below"}
          </span>
          <Button variant="outline" size="sm" onClick={selectAll}>{t("games.selectAll")}</Button>
          <Button variant="outline" size="sm" onClick={clearSelection} disabled={selected.size === 0}>{t("games.deselectAll")}</Button>
          <div className="flex-1" />
          <Button variant="primary" size="sm" onClick={() => setBatchConfirm("backup")} disabled={selected.size === 0}>{t("games.batchBackup")}</Button>
          <Button variant="outline" size="sm" onClick={() => setBatchConfirm("restore")} disabled={selected.size === 0}>{t("games.batchRestore")}</Button>
          <Button variant="outline" size="sm" ripple={false} onClick={() => setBatchConfirm("delete")} disabled={selected.size === 0}
            className="border-red-200 text-red-600">{t("games.deleteAllBackups")}</Button>
        </GlassCard>
      )}

      {/* Batch confirm modal */}
      <Dialog open={!!batchConfirm} onClose={() => setBatchConfirm("")}>
        <p>
          {batchConfirm === "backup" && t("batchDialog.backupMsg", { count: selected.size })}
          {batchConfirm === "restore" && t("batchDialog.restoreMsg", { count: selected.size })}
          {batchConfirm === "delete" && t("batchDialog.deleteMsg", { count: selected.size })}
        </p>
        <div className="flex justify-end gap-2 mt-3">
          <Button variant="outline" size="sm" onClick={() => setBatchConfirm("")}>{t("batchDialog.cancel")}</Button>
          <Button variant={batchConfirm === "delete" ? "danger" : "primary"} size="sm"
            onClick={() => handleBatchAction(batchConfirm as "backup"|"restore"|"delete")}>{t("batchDialog.confirm")}</Button>
        </div>
      </Dialog>

      {/* Search + show-all toggle */}
      <div className="mb-3 flex items-center gap-4">
        <SearchInput
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder={t("games.search")}
        />
        {tab === "available" && (
          <>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <Checkbox checked={showAll} onChange={(checked) => { setShowAll(checked); setPage(1); }} />
              {t("games.showAllGames")}
            </label>
            {loadingAvailable && (
              <span className="inline-flex items-center justify-center text-muted-foreground animate-spin" title={t("common.loading")}>
                <Icon name="reset" size={14} />
              </span>
            )}
          </>
        )}
      </div>

      {/* Content */}
      <div ref={listTopRef} />
      {displayedGames.length === 0 ? (
        <GlassCard className="rounded-xl text-center py-16 text-muted-foreground">
          {tab === "monitored" ? t("games.noGames") : t("addGame.noGamesFound")}
        </GlassCard>
      ) : (
        <div ref={viewAnim.outerRef} style={viewAnim.outerStyle} onTransitionEnd={viewAnim.onTransitionEnd} className={viewAnim.outerClassName}>
          <div ref={viewAnim.innerRef}>
            {view === "list" ? (
              /* Rich list view — header banner + detail card */
              <div key={view} className={`space-y-2 ${anim ? "animate-fade-in" : ""}`}>
          {displayedGames.map((game, index) => (
            <GlassListCard key={game.id}
              onContextMenu={(e) => handleContextMenu(e, game)}
              onClick={() => {
                if (tab === "monitored") navigate(`/games/${encodeURIComponent(game.id)}`);
              }}
              style={staggerStyle(index, anim)}
              className={`group relative ${anim ? "animate-rise-in" : ""}`}
            >
              <div className="flex gap-3">
                {/* Cover at 60% scale */}
                <div className="w-[138px] flex-shrink-0 aspect-[460/215] bg-secondary/20 rounded-md overflow-hidden m-2 mr-0 relative">
                  {game.steam_app_id ? (
                    <img
                      src={`https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${game.steam_app_id}/header.jpg`}
                      alt="" className="w-full h-full object-cover" loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${game.steam_app_id}/capsule_616x353.jpg`;
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg text-muted-foreground/30 font-bold">
                      {game.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {batchMode && (
                    <span onClick={(e) => e.stopPropagation()} className="absolute top-1.5 left-1.5 z-10">
                      <Checkbox checked={selected.has(game.id)} onChange={() => toggleSelect(game.id)} color="green" />
                    </span>
                  )}
                  {game.pinned && (
                    <Icon name="pin" size={14} className="absolute top-1 left-1 z-10 drop-shadow-sm text-foreground dark:text-white/85" />
                  )}
                </div>
                {/* Details at 60% scale */}
                <div className="flex-1 min-w-0 py-2 pr-3">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <h3 className="font-semibold text-sm truncate">{game.name}</h3>
                    {tab === "available" && (
                      <span className="text-[9px] bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                        {t("addGame.available")}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mb-1 flex items-center gap-2">
                    <span>{game.last_backup || t("games.noLastBackup")}</span>
                    {game.snapshot_count > 0 && <span>· {game.snapshot_count} {t("games.snap")}</span>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {game.save_path && <span className="truncate max-w-[180px]"><Icon name="folder" size={14} className="inline mr-1 align-text-bottom text-foreground dark:text-white/85" />{game.save_path}</span>}
                    {tab === "available" ? null : (
                      <span className="ml-auto">{game.snapshot_count > 0 ? `${game.snapshot_count} ${t("games.snap")}` : ""}</span>
                    )}
                  </div>
                </div>
              </div>
              {tab === "available" && (
                <Button
                  variant="primary"
                  size="sm"
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 !p-0 !gap-0 opacity-0 group-hover:opacity-100 transition-all duration-200 flex-shrink-0"
                  onClick={(e) => { e.stopPropagation(); handleAdd(game); }}
                  title={t("games.addGame")}
                >
                  <Icon name="addGame" size={16} />
                </Button>
              )}
            </GlassListCard>
          ))}
              </div>
            ) : (
              <div key={view} className={`grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 ${anim ? "animate-fade-in" : ""}`}>
          {displayedGames.map((game, index) => (
            <GameCard
              key={game.id}
              game={game}
              batchMode={tab === "monitored" && batchMode}
              selected={selected.has(game.id)}
              onToggle={() => toggleSelect(game.id)}
              showAdd={tab === "available"}
              onAdd={handleAdd}
              onContextMenu={handleContextMenu}
              onClick={() => {
                if (tab === "monitored") navigate(`/games/${encodeURIComponent(game.id)}`);
              }}
              lastBackup={game.last_backup}
              snapshotCount={game.snapshot_count}
              cardStyle={coverCardStyle}
              revealText={game.snapshot_count > 0 ? `共 ${game.snapshot_count} ${t("games.snap")}` : (game.last_backup || t("games.noLastBackup"))}
              className={anim ? "animate-rise-in" : ""}
              style={staggerStyle(index, anim)}
              t={t}
            />
          ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pagination — available tab only */}
      {tab === "available" && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6 mb-4">
          <Button variant="outline" size="sm" onClick={() => { setPage(1); scrollListTop(); }} disabled={page <= 1}>{t("games.firstPage")}</Button>
          <Button variant="outline" size="sm" onClick={() => { setPage(page - 1); scrollListTop(); }} disabled={page <= 1}>{t("games.prevPage")}</Button>
          <span className="text-xs text-muted-foreground px-2">{t("games.pageInfo", { page, total: totalPages, count: sortedGames.length })}</span>
          <Button variant="outline" size="sm" onClick={() => { setPage(page + 1); scrollListTop(); }} disabled={page >= totalPages}>{t("games.nextPage")}</Button>
          <Button variant="outline" size="sm" onClick={() => { setPage(totalPages); scrollListTop(); }} disabled={page >= totalPages}>{t("games.lastPage")}</Button>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={
            tab === "monitored"
              ? [
                  { label: contextMenu.game.pinned ? t("contextMenu.unpin") : t("contextMenu.pin"), onClick: () => handlePin(contextMenu.game) },
                  { label: contextMenu.game.auto_backup ? t("contextMenu.autoBackupOn") : t("contextMenu.autoBackupOff"), onClick: () => { invoke("set_game_auto_backup", { gameId: contextMenu.game.id, enabled: !contextMenu.game.auto_backup }).then(refresh); } },
                  { label: t("contextMenu.editSavePath"), onClick: () => handleEditPath(contextMenu.game) },
                  { label: t("contextMenu.openSaveDir"), onClick: () => invoke("open_in_explorer", { path: contextMenu.game.save_path }) },
                  { label: t("contextMenu.openBackupDir"), onClick: () => invoke("open_in_explorer", { path: contextMenu.game.backup_dir }) },
                  ...(contextMenu.game.steam_app_id
                    ? [{ label: t("steam.achievements") || "Achievements", onClick: () => setAchievementsTarget({ appId: contextMenu.game.steam_app_id!, gameName: contextMenu.game.name }) }]
                    : []),
                  { label: t("contextMenu.removeGame"), onClick: () => handleRemoveGame(contextMenu.game), danger: true },
                ]
              : [
                  { label: `+ ${t("games.addGame")}`, onClick: () => handleAdd(contextMenu.game) },
                  ...(contextMenu.game.steam_app_id
                    ? [{ label: t("steam.achievements") || "Achievements", onClick: () => setAchievementsTarget({ appId: contextMenu.game.steam_app_id!, gameName: contextMenu.game.name }) }]
                    : []),
                ]
          }
        />
      )}

      {/* Edit path dialog */}
      <Dialog open={!!editPathGame} onClose={() => setEditPathGame(null)} title={editPathGame?.name}>
        <p className="text-xs text-muted-foreground mb-3">{t("editPathDialog.hint")}</p>
        <div className="flex gap-2">
          <input value={editPathValue} onChange={(e) => setEditPathValue(e.target.value)}
            className="flex-1 px-3 py-2 border rounded-md text-sm bg-background" placeholder={t("editPathDialog.placeholder")} />
          <Button variant="outline" size="sm" onClick={handleBrowsePath} className="whitespace-nowrap">{t("settings.browse")}</Button>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={() => setEditPathGame(null)}>{t("editPathDialog.cancel")}</Button>
          <Button variant="primary" size="sm" onClick={handleSavePath}>{t("editPathDialog.save")}</Button>
        </div>
      </Dialog>

      <AddGameDialog
        open={showAddGame}
        onClose={() => setShowAddGame(false)}
        onGameAdded={() => {
          refresh();
          loadAvailable(true);
        }}
      />

      <AchievementsDialog
        open={!!achievementsTarget}
        appId={achievementsTarget?.appId ?? null}
        gameName={achievementsTarget?.gameName}
        onClose={() => setAchievementsTarget(null)}
      />

      <OverviewDialog
        open={showOverview}
        onClose={() => setShowOverview(false)}
      />

      {/* Remove game dialog */}
      <Dialog open={!!removeGame} onClose={() => setRemoveGame(null)} title={t("removeDialog.title", { name: removeGame?.name })}>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={removeBackups} onChange={setRemoveBackups} color="red" />
          <span>{t("removeDialog.deleteBackups")}</span>
        </label>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={() => setRemoveGame(null)}>{t("removeDialog.cancel")}</Button>
          <Button variant="danger" size="sm" onClick={handleRemoveConfirm}>{t("removeDialog.confirm")}</Button>
        </div>
      </Dialog>
    </div>
  );
}

/* ── List row ── */
function GameRow({
  game, tab, batchMode, selected, onToggle, onAdd, onContextMenu, onClick, t,
}: {
  game: GameInfo; tab: Tab; batchMode: boolean; selected: boolean;
  onToggle: () => void; onAdd: (g: GameInfo) => void;
  onContextMenu: (e: React.MouseEvent, g: GameInfo) => void;
  onClick: () => void; t: any;
}) {
  return (
    <div
      onContextMenu={(e) => onContextMenu(e, game)}
      onClick={onClick}
      className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors"
    >
      {tab === "monitored" && batchMode && (
        <span onClick={(e) => e.stopPropagation()} className="flex-shrink-0"><Checkbox checked={selected} onChange={onToggle} color="green" /></span>
      )}
      {game.pinned && <Icon name="pin" size={14} className="flex-shrink-0 text-foreground dark:text-white/85" />}
      <GameIcon steamAppId={game.steam_app_id} name={game.name} className="w-[46px] h-[28px] rounded flex-shrink-0 text-[10px]" />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate text-sm">{game.name}</div>
        <div className="text-xs text-muted-foreground truncate">{game.save_path}</div>
      </div>
      <div className="text-xs text-muted-foreground text-right flex-shrink-0 leading-tight">
        <div>{game.last_backup ? formatTimestamp(game.last_backup) : "—"}</div>
        <div>{game.snapshot_count > 0 ? `${game.snapshot_count} snap` : ""}</div>
      </div>
      <span
        className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
          game.status === "active"
            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
            : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
        }`}
      >
        {t(`games.status.${game.status}`)}
      </span>
      {tab === "available" && (
        <Button
          variant="primary"
          size="sm"
          className="flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); onAdd(game); }}
        >
          + {t("games.addGame")}
        </Button>
      )}
    </div>
  );
}

/* GameCard imported from src/components/ui/GameCard.tsx */
