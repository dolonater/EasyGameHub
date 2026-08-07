import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { useAppData } from "../hooks/useAppData";
import { showToast } from "../components/Notification";
import Button from "../components/ui/Button";
import Dialog from "../components/ui/Dialog";
import Checkbox from "../components/ui/Checkbox";
import ContextMenu, { type MenuItem } from "../components/ui/ContextMenu";
import Icon from "../components/ui/Icon";
import { GlassSidebar, GlassTileButton, SearchInput } from "../components/ui";
import ScreenshotGrid from "../components/screenshots/ScreenshotGrid";
import ScreenshotLightbox from "../components/screenshots/ScreenshotLightbox";
import { useAnimation } from "../hooks/useAnimation";
import { useAnimatedHeight } from "../hooks/useAnimatedHeight";

interface ScreenshotFile {
  path: string;
  name: string;
  size_bytes: number;
  modified_at: string | null;
}

const PAGE_SIZE = 24;
const SCREENSHOT_COUNTS_CACHE_KEY = "doona-screenshot-counts-cache";

const screenshotsSessionCache = {
  counts: null as Record<string, number> | null,
  screenshotsByGame: {} as Record<string, ScreenshotFile[]>,
  selectedGame: null as string | null,
  page: 1,
};

function readCachedScreenshotCounts() {
  if (screenshotsSessionCache.counts) {
    return screenshotsSessionCache.counts;
  }

  try {
    const raw = sessionStorage.getItem(SCREENSHOT_COUNTS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

    const counts: Record<string, number> = {};
    for (const [gameId, count] of Object.entries(parsed)) {
      if (typeof count === "number" && Number.isFinite(count)) {
        counts[gameId] = count;
      }
    }
    screenshotsSessionCache.counts = counts;
    return counts;
  } catch {
    return null;
  }
}

function writeCachedScreenshotCounts(counts: Record<string, number>) {
  screenshotsSessionCache.counts = counts;
  try {
    sessionStorage.setItem(SCREENSHOT_COUNTS_CACHE_KEY, JSON.stringify(counts));
  } catch {}
}

function clearCachedScreenshotCounts() {
  screenshotsSessionCache.counts = null;
  try {
    sessionStorage.removeItem(SCREENSHOT_COUNTS_CACHE_KEY);
  } catch {}
}

export default function Screenshots() {
  const { t } = useTranslation();
  const anim = useAnimation();
  const { games, loading: gamesLoading } = useAppData();
  const cachedCounts = useMemo(() => readCachedScreenshotCounts(), []);
  const [selectedGame, setSelectedGame] = useState<string | null>(screenshotsSessionCache.selectedGame);
  const [screenshots, setScreenshots] = useState<ScreenshotFile[]>(
    screenshotsSessionCache.selectedGame
      ? (screenshotsSessionCache.screenshotsByGame[screenshotsSessionCache.selectedGame] || [])
      : [],
  );
  const [counts, setCounts] = useState<Record<string, number>>(cachedCounts || {});
  const [countsReady, setCountsReady] = useState(Boolean(cachedCounts));
  const [screenshotsLoading, setScreenshotsLoading] = useState(false);
  const [page, setPage] = useState(screenshotsSessionCache.page || 1);
  const [gameQuery, setGameQuery] = useState("");

  // Viewer / delete state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; screenshot: ScreenshotFile } | null>(null);

  const countsRequestIdRef = useRef(0);
  const screenshotsRequestIdRef = useRef(0);
  const unmountedRef = useRef(false);
  const listTopRef = useRef<HTMLDivElement>(null);

  const selectedGameInfo = games.find((g) => g.id === selectedGame) || null;
  const selectedCount = selectedGame ? (counts[selectedGame] ?? screenshots.length) : 0;
  const gamesWithScreenshots = Object.values(counts).filter((count) => count > 0).length;
  const deletingScreenshot = useMemo(
    () => screenshots.find((s) => s.path === deletingPath) || null,
    [screenshots, deletingPath],
  );
  const selectedCountInBatch = selectedPaths.size;
  const totalPages = Math.max(1, Math.ceil(screenshots.length / PAGE_SIZE));
  const pagedScreenshots = useMemo(
    () => screenshots.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [screenshots, page],
  );
  const visibleGames = useMemo(() => {
    const query = gameQuery.trim().toLowerCase();
    return [...games]
      .filter((game) => {
        if (!query) return true;
        return game.name.toLowerCase().includes(query) || game.id.toLowerCase().includes(query);
      })
      .sort((a, b) => {
        return (counts[b.id] || 0) - (counts[a.id] || 0);
      });
  }, [counts, gameQuery, games]);
  const pageAnim = useAnimatedHeight(`${selectedGame}:${page}:${pagedScreenshots.length}`, anim);

  const scrollListTop = () => {
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handlePageChange = (nextPage: number) => {
    const clampedPage = Math.min(totalPages, Math.max(1, nextPage));
    setPage(clampedPage);
    screenshotsSessionCache.page = clampedPage;
    scrollListTop();
  };

  const loadCounts = useCallback(async (preferCache = true) => {
    const cached = readCachedScreenshotCounts();
    if (preferCache && cached) {
      setCounts(cached);
      setCountsReady(true);
      return;
    }

    const requestId = ++countsRequestIdRef.current;
    try {
      const pairs = await invoke<[string, number][]>("get_screenshot_counts");
      if (unmountedRef.current || requestId !== countsRequestIdRef.current) return;
      const next: Record<string, number> = {};
      for (const [gameId, count] of pairs) next[gameId] = count;
      writeCachedScreenshotCounts(next);
      setCounts(next);
      setCountsReady(true);
    } catch {
      if (unmountedRef.current || requestId !== countsRequestIdRef.current) return;
      setCounts({});
      setCountsReady(true);
    }
  }, []);

  const loadScreenshots = useCallback(async (gameId: string, preferCache = true) => {
    if (preferCache && screenshotsSessionCache.screenshotsByGame[gameId]) {
      setScreenshots(screenshotsSessionCache.screenshotsByGame[gameId]);
      return;
    }

    const requestId = ++screenshotsRequestIdRef.current;
    setScreenshotsLoading(true);
    try {
      const files = await invoke<ScreenshotFile[]>("get_screenshots", { gameId });
      if (unmountedRef.current || requestId !== screenshotsRequestIdRef.current) return;
      screenshotsSessionCache.screenshotsByGame[gameId] = files;
      setScreenshots(files);
    } catch {
      if (unmountedRef.current || requestId !== screenshotsRequestIdRef.current) return;
      setScreenshots([]);
    } finally {
      if (!unmountedRef.current && requestId === screenshotsRequestIdRef.current) {
        setScreenshotsLoading(false);
      }
    }
  }, []);

  const refreshCurrentGame = useCallback(async () => {
    if (!selectedGame) return;
    await loadScreenshots(selectedGame, false);
  }, [selectedGame, loadScreenshots]);

  const refreshCounts = useCallback(async () => {
    clearCachedScreenshotCounts();
    await loadCounts(false);
  }, [loadCounts]);

  const handleAddFolder = useCallback(async () => {
    if (!selectedGame) return;
    const { open } = await import("@tauri-apps/plugin-dialog");
    const dir = await open({ directory: true, multiple: false });
    if (dir) {
      await invoke("add_screenshot_dir", { gameId: selectedGame, directory: dir as string });
      screenshotsSessionCache.screenshotsByGame[selectedGame] = [];
      await refreshCurrentGame();
      await refreshCounts();
    }
  }, [selectedGame, refreshCounts, refreshCurrentGame]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deletingPath) return;

    const deletingIndex = screenshots.findIndex((s) => s.path === deletingPath);
    if (deletingIndex < 0) {
      setDeletingPath(null);
      return;
    }

    setDeletingBusy(true);
    try {
      await invoke("delete_screenshot", { path: deletingPath });

      const nextScreenshots = screenshots.filter((s) => s.path !== deletingPath);
      setScreenshots(nextScreenshots);
      setDeletingPath(null);
      setSelectedPaths((prev) => {
        const next = new Set(prev);
        next.delete(deletingPath);
        return next;
      });

      if (selectedGame) {
        screenshotsSessionCache.screenshotsByGame[selectedGame] = nextScreenshots;
        setCounts((prev) => {
          const next = {
            ...prev,
            [selectedGame]: nextScreenshots.length,
          };
          writeCachedScreenshotCounts(next);
          return next;
        });
      }

      if (nextScreenshots.length === 0) {
        setViewerOpen(false);
        setViewerIndex(0);
      } else {
        const nextIndex = deletingIndex < nextScreenshots.length
          ? deletingIndex
          : nextScreenshots.length - 1;
        setViewerIndex(nextIndex);
        setViewerOpen(true);
      }

      const nextPage = Math.min(page, Math.max(1, Math.ceil(nextScreenshots.length / PAGE_SIZE)));
      setPage(nextPage);
      screenshotsSessionCache.page = nextPage;

      await refreshCounts();
      showToast("success", t("screenshots.deleteSuccess"));
    } catch (e: any) {
      showToast("error", String(e));
    } finally {
      setDeletingBusy(false);
    }
  }, [deletingPath, screenshots, selectedGame, page, refreshCounts, t]);

  const handleBatchDelete = useCallback(async () => {
    if (!selectedGame || selectedPaths.size === 0) return;
    setDeletingBusy(true);
    try {
      for (const path of selectedPaths) {
        await invoke("delete_screenshot", { path });
      }
      const nextScreenshots = screenshots.filter((s) => !selectedPaths.has(s.path));
      screenshotsSessionCache.screenshotsByGame[selectedGame] = nextScreenshots;
      setScreenshots(nextScreenshots);
      setSelectedPaths(new Set());
      setBatchMode(false);
      setViewerOpen(false);
      setViewerIndex(0);
      setCounts((prev) => {
        const next = { ...prev, [selectedGame]: nextScreenshots.length };
        writeCachedScreenshotCounts(next);
        return next;
      });
      const nextPage = Math.min(page, Math.max(1, Math.ceil(nextScreenshots.length / PAGE_SIZE)));
      setPage(nextPage);
      screenshotsSessionCache.page = nextPage;
      await refreshCounts();
      showToast("success", t("screenshots.batchDeleteSuccess", { count: selectedCountInBatch, defaultValue: `已删除 ${selectedCountInBatch} 张截图` }));
    } catch (e: any) {
      showToast("error", String(e));
    } finally {
      setDeletingBusy(false);
    }
  }, [selectedGame, selectedPaths, screenshots, page, refreshCounts, selectedCountInBatch, t]);

  useEffect(() => {
    unmountedRef.current = false;
    void loadCounts(true);
    if (screenshotsSessionCache.selectedGame) {
      void loadScreenshots(screenshotsSessionCache.selectedGame, true);
    }
    return () => {
      unmountedRef.current = true;
      countsRequestIdRef.current++;
      screenshotsRequestIdRef.current++;
      screenshotsSessionCache.selectedGame = selectedGame;
      screenshotsSessionCache.page = page;
      setViewerOpen(false);
      setContextMenu(null);
    };
  }, [loadCounts, loadScreenshots, selectedGame, page]);

  useEffect(() => {
    if (!selectedGame) {
      setScreenshots([]);
      setViewerOpen(false);
      setViewerIndex(0);
      setDeletingPath(null);
      setSelectedPaths(new Set());
      setPage(1);
      screenshotsSessionCache.selectedGame = null;
      screenshotsSessionCache.page = 1;
      return;
    }
    screenshotsSessionCache.selectedGame = selectedGame;
    setPage(1);
    screenshotsSessionCache.page = 1;
    void loadScreenshots(selectedGame, true);
  }, [selectedGame, loadScreenshots]);

  useEffect(() => {
    if (selectedGame && !games.some((g) => g.id === selectedGame)) {
      setSelectedGame(null);
      setScreenshots([]);
      setSelectedPaths(new Set());
      setPage(1);
      screenshotsSessionCache.selectedGame = null;
      screenshotsSessionCache.page = 1;
    }
  }, [games, selectedGame]);

  useEffect(() => {
    const handler = () => setContextMenu(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const handleOpenViewer = (index: number) => {
    const absoluteIndex = (page - 1) * PAGE_SIZE + index;
    setViewerIndex(absoluteIndex);
    setViewerOpen(true);
  };

  const handleOpenFolder = (path: string) => {
    invoke("open_in_explorer", { path });
  };

  const toggleSelectPath = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleTileContextMenu = (e: React.MouseEvent, screenshot: ScreenshotFile) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, screenshot });
  };

  const contextMenuItems: MenuItem[] = contextMenu ? [
    {
      label: t("screenshots.openImage"),
      onClick: () => {
        const idx = screenshots.findIndex((s) => s.path === contextMenu.screenshot.path);
        if (idx >= 0) {
          setViewerIndex(idx);
          setViewerOpen(true);
        }
      },
    },
    {
      label: t("screenshots.openFolder"),
      onClick: () => handleOpenFolder(contextMenu.screenshot.path),
      sepBefore: true,
    },
    {
      label: t("screenshots.delete"),
      onClick: () => setDeletingPath(contextMenu.screenshot.path),
      danger: true,
    },
  ] : [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("nav.screenshots")}</h1>

      <div className="flex gap-4 min-h-0">
        {/* Game list sidebar */}
        <GlassSidebar className="w-64 flex-shrink-0 rounded-[var(--radius)] border border-border/60 p-3">
          <div className="pb-3 border-b border-border/60">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{t("nav.gamesLabel")}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {!countsReady
                    ? t("common.loading")
                    : t("screenshots.sidebarSummary", {
                        defaultValue: "{{games}} 个游戏含截图",
                        games: gamesWithScreenshots,
                      })}
                </div>
              </div>
              <Icon name="screenshots" size={18} className="text-muted-foreground" />
            </div>

            <SearchInput
              value={gameQuery}
              onChange={(e) => setGameQuery(e.target.value)}
              placeholder={t("common.search", { defaultValue: "Search" })}
              className="mt-3 max-w-none"
            />
          </div>

          <div className="app-scrollbar mt-3 space-y-2 max-h-[calc(100vh-282px)] overflow-auto pr-1">
            {gamesLoading || !countsReady ? (
              <div className="space-y-2">
                {Array.from({ length: 7 }).map((_, index) => (
                  <div key={index} className="h-[42px] rounded border border-border/70 bg-secondary/25 animate-pulse" />
                ))}
              </div>
            ) : visibleGames.length === 0 ? (
              <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                {t("common.noResults", { defaultValue: "No results" })}
              </div>
            ) : (
              visibleGames.map((g) => {
                const count = counts[g.id] || 0;
                const selected = selectedGame === g.id;
                return (
                  <GlassTileButton
                    key={g.id}
                    selected={selected}
                    onClick={() => setSelectedGame(g.id)}
                    className={[
                      "w-full min-h-[42px] flex items-center justify-between gap-2 px-3 py-2 text-left",
                      selected ? "bg-primary/10 text-foreground" : "bg-transparent text-foreground",
                    ].join(" ")}
                  >
                    <span className="min-w-0 flex items-center">
                      <span className="truncate text-[13px] leading-tight">{g.name}</span>
                    </span>
                    {count > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${selected ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                        {count}
                      </span>
                    )}
                  </GlassTileButton>
                );
              })
            )}
          </div>
        </GlassSidebar>

        {/* Screenshots area */}
        <div className="flex-1 min-w-0 space-y-3">
          {!selectedGame ? (
            <div className="py-16 px-6 text-center">
              <Icon name="image" size={56} className="mx-auto mb-3 text-foreground dark:text-white/85" />
              <p className="text-sm font-medium text-foreground">{t("screenshots.selectGame")}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {t("screenshots.selectHint", {
                  defaultValue: "选择左侧游戏后，即可在应用内浏览截图。",
                })}
              </p>
            </div>
          ) : (
            <>
              <div className="px-1 pb-1.5 border-b border-border/60 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{selectedGameInfo?.name || t("nav.screenshots")}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>
                      {screenshotsLoading && screenshots.length === 0
                        ? t("common.loading")
                        : t("screenshots.countSummary", {
                            defaultValue: "{{count}} 张截图",
                            count: selectedCount,
                          })}
                    </span>
                    {viewerOpen && (
                      <span className="px-2 py-0.5 rounded-full bg-secondary/80 text-foreground/80">
                        {viewerIndex + 1}/{Math.max(screenshots.length, 1)}
                      </span>
                    )}
                    {batchMode && selectedCountInBatch > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {t("screenshots.batchSelected", { count: selectedCountInBatch, defaultValue: `已选 ${selectedCountInBatch} 张` })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {screenshots.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setBatchMode((prev) => {
                          const next = !prev;
                          if (!next) {
                            setSelectedPaths(new Set());
                          }
                          return next;
                        });
                      }}
                    >
                      {batchMode ? t("common.cancel") : t("screenshots.batchManage", { defaultValue: "批量管理" })}
                    </Button>
                  )}
                  {batchMode && screenshots.length > 0 && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setSelectedPaths(new Set(screenshots.map((s) => s.path)))}>
                        {t("screenshots.selectAll", { defaultValue: "全选" })}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setSelectedPaths(new Set())}>
                        {t("screenshots.clearSelection", { defaultValue: "清空选择" })}
                      </Button>
                      <Button variant="danger" size="sm" onClick={handleBatchDelete} disabled={selectedCountInBatch === 0 || deletingBusy}>
                        {t("screenshots.batchDelete", { defaultValue: "批量删除" })}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div ref={listTopRef} />

              {screenshotsLoading && screenshots.length === 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="aspect-[16/10] rounded-2xl border bg-secondary/30 animate-pulse" />
                  ))}
                </div>
              ) : screenshots.length === 0 ? (
                <div className="text-center py-14 px-6 text-muted-foreground text-sm">
                  <Icon name="image" size={56} className="mx-auto mb-3 text-foreground dark:text-white/85" />
                  <p className="text-sm font-medium text-foreground">{t("screenshots.empty")}</p>
                  {selectedGameInfo?.steam_app_id && (
                    <p className="mt-2 text-xs text-muted-foreground/80">{t("screenshots.emptySteamScanned")}</p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground/80">
                    {t("screenshots.emptyHint", {
                      defaultValue: "你可以添加自定义截图目录，或继续使用 Steam 自动扫描目录。",
                    })}
                  </p>
                  <Button variant="outline" className="mt-4" onClick={handleAddFolder}>
                    {t("screenshots.addFolder")}
                  </Button>
                </div>
              ) : (
                <>
                  <div
                    ref={pageAnim.outerRef}
                    style={pageAnim.outerStyle}
                    onTransitionEnd={pageAnim.onTransitionEnd}
                    className={pageAnim.outerClassName}
                  >
                    <div ref={pageAnim.innerRef} key={`${selectedGame}:${page}`}>
                      <ScreenshotGrid
                        screenshots={pagedScreenshots}
                        onOpen={handleOpenViewer}
                        batchMode={batchMode}
                        selectedPaths={selectedPaths}
                        onToggleSelect={toggleSelectPath}
                        onContextMenu={handleTileContextMenu}
                      />
                    </div>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6 mb-2">
                      <Button variant="outline" size="sm" onClick={() => handlePageChange(1)} disabled={page <= 1}>{t("games.firstPage")}</Button>
                      <Button variant="outline" size="sm" onClick={() => handlePageChange(page - 1)} disabled={page <= 1}>{t("games.prevPage")}</Button>
                      <span className="text-xs text-muted-foreground px-2">{t("screenshots.pageInfo", { page, total: totalPages, count: screenshots.length, defaultValue: `${page} / ${totalPages}（${screenshots.length} 张）` })}</span>
                      <Button variant="outline" size="sm" onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages}>{t("games.nextPage")}</Button>
                      <Button variant="outline" size="sm" onClick={() => handlePageChange(totalPages)} disabled={page >= totalPages}>{t("games.lastPage")}</Button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      <ScreenshotLightbox
        open={viewerOpen}
        screenshots={screenshots}
        index={viewerIndex}
        onIndexChange={setViewerIndex}
        onClose={() => setViewerOpen(false)}
        onOpenFolder={handleOpenFolder}
        onDelete={(path) => setDeletingPath(path)}
      />

      <Dialog
        open={!!deletingPath}
        onClose={() => !deletingBusy && setDeletingPath(null)}
        title={t("screenshots.deleteConfirmTitle")}
        actions={(
          <>
            <Button variant="outline" size="sm" onClick={() => setDeletingPath(null)} disabled={deletingBusy}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" size="sm" onClick={handleConfirmDelete} disabled={deletingBusy}>
              {t("screenshots.delete")}
            </Button>
          </>
        )}
      >
        <p>{t("screenshots.deleteConfirmDesc", { name: deletingScreenshot?.name || "" })}</p>
      </Dialog>
    </div>
  );
}
