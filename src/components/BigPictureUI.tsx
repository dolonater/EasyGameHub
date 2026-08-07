import { useEffect, useState, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { useAppData } from "../hooks/useAppData";
import { useFocusGrid } from "../hooks/useFocusGrid";
import { useGamepad } from "../hooks/useGamepad";
import { useThemeMode } from "../hooks/useThemeData";
import { toggleFullscreen } from "../lib/fullscreen";
import { showToast } from "./Notification";
import BigPictureCard from "./ui/BigPictureCard";
import SearchInput from "./ui/SearchInput";
import Icon from "./ui/Icon";
import { startSteamInstall } from "../lib/steamInstall";

const FILTERS = [
  { value: "all", key: "steam.allGames" },
  { value: "installed", key: "steam.installedGames" },
  { value: "uninstalled", key: "steam.uninstalledGames", fallback: "Uninstalled" },
  { value: "favorites", key: "launcher.favorite" },
];

export default function BigPictureUI() {
  const { t } = useTranslation();
  const { games, steamGames, steamLoading, steamLoaded, ensureSteamGames, favorites } = useAppData();
  const { toggleMode } = useThemeMode();
  const gridRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const TB_COUNT = 7;
  const [toolbarItem, setToolbarItem] = useState(0);

  useEffect(() => {
    void ensureSteamGames();
  }, [ensureSteamGames]);

  // ── Merge tracked + inventory-only games (same unified library logic) ──
  const inventoryMeta = useMemo(
    () => new Map(steamGames.map((ig) => [ig.appId, { playtimeMinutes: ig.playtimeMinutes, isInstalled: ig.isInstalled }])),
    [steamGames],
  );
  const trackedIds = useMemo(
    () => new Set(games.map((tg) => tg.steam_app_id).filter(Boolean)),
    [games],
  );

  const merged = useMemo(() => [
    ...games.map((g) => ({
      ...g,
      _isTracked: true as boolean,
      _invAppId: g.steam_app_id ?? null as number | null,
      _invPlaytime: g.steam_app_id ? (inventoryMeta.get(g.steam_app_id)?.playtimeMinutes ?? 0) : 0,
      _invInstalled: g.steam_app_id ? (inventoryMeta.get(g.steam_app_id)?.isInstalled ?? false) : false,
    })),
    ...steamGames
      .filter((ig) => !trackedIds.has(ig.appId))
      .map((ig) => ({
        id: `steam-${ig.appId}`,
        name: ig.name || `App ${ig.appId}`,
        save_path: "",
        backup_dir: "",
        steam_app_id: ig.appId as number | null,
        is_custom: false,
        last_backup: null,
        snapshot_count: 0,
        status: "inactive" as const,
        pinned: false,
        auto_backup: false,
        _isTracked: false,
        _invAppId: ig.appId as number | null,
        _invPlaytime: ig.playtimeMinutes,
        _invInstalled: ig.isInstalled,
      })),
  ], [games, steamGames, inventoryMeta, trackedIds]);

  // ── Filter & sort ──
  const displayed = useMemo(() => {
    let list = merged.filter((g: any) => {
      if (!steamLoaded && (filter === "installed" || filter === "uninstalled")) return g._isTracked;
      if (filter === "installed") return g._invInstalled ?? true;
      if (filter === "uninstalled") return g._invInstalled === false;
      if (filter === "favorites") return favorites.has(g.id);
      return true;
    });
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((g: any) => g.name.toLowerCase().includes(q));
    }
    // Tracked first, then pinned, then by name
    return list.sort((a: any, b: any) => {
      if (a._isTracked && !b._isTracked) return -1;
      if (!a._isTracked && b._isTracked) return 1;
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }, [merged, filter, search, favorites, steamLoaded]);

  // ── Launch handler ──
  const handleLaunch = async (idx: number) => {
    const game = displayed[idx] as any;
    if (!game) return;
    if (!game._isTracked && game._invAppId) {
      if (game._invInstalled) {
        await invoke("open_url", { url: `steam://rungameid/${game._invAppId}` });
        showToast("success", `${t("launcher.launching")} ${game.name}`);
      } else {
        await startSteamInstall(game._invAppId, game.name, t);
      }
      return;
    }
    try {
      await invoke<string>("launch_game", { gameId: game.id });
      showToast("success", `${t("launcher.launching")} ${game.name}`);
    } catch (e: any) {
      showToast("error", String(e));
    }
  };

  // ── Grid columns from CSS ──
  const [gridCols, setGridCols] = useState(4);
  const gridColsRef = useRef<number>(4);
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const gridEl = gridRef.current?.querySelector(".bp-grid") as HTMLElement | null;
      if (!gridEl) return;
      const readCols = () => {
        const cols = getComputedStyle(gridEl).gridTemplateColumns.split(" ").length;
        if (cols > 0 && cols !== gridColsRef.current) {
          gridColsRef.current = cols;
          setGridCols(cols);
        }
      };
      readCols();
      const observer = new ResizeObserver(readCols);
      observer.observe(gridEl);
      return () => observer.disconnect();
    });
    return () => {};
  }, [displayed.length]);

  const { focusIndex, focusedItem, navigate, setFocusIndex } = useFocusGrid(
    { itemCount: displayed.length, columns: gridCols, hasToolbar: true },
    handleLaunch,
  );
  const isOnToolbar = focusIndex === -1;

  useEffect(() => {
    if (showSearch) searchRef.current?.focus();
  }, [showSearch]);

  // ── Gamepad ──
  const navRef = useRef({ navigate, focusedItem, isOnToolbar });
  navRef.current = { navigate, focusedItem, isOnToolbar };

  useGamepad({
    onDirection: (dir) => {
      const { isOnToolbar: tbar, navigate: nav } = navRef.current;
      if (tbar) {
        if (dir === "left") setToolbarItem((p) => (p - 1 + TB_COUNT) % TB_COUNT);
        if (dir === "right") setToolbarItem((p) => (p + 1) % TB_COUNT);
        if (dir === "down") setFocusIndex(0);
      } else {
        nav(dir);
      }
    },
    onAction: () => {
      const { isOnToolbar: tbar, focusedItem: fi } = navRef.current;
      if (tbar) activateToolbar();
      else if (fi !== null) handleLaunch(fi);
    },
    onBack: () => {
      if (showSearch) { setShowSearch(false); return; }
      toggleFullscreen();
    },
  }, true);

  // ── Keyboard: toolbar ──
  const isOnToolbarRef = useRef(isOnToolbar);
  isOnToolbarRef.current = isOnToolbar;
  const toolbarItemRef = useRef(toolbarItem);
  toolbarItemRef.current = toolbarItem;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (!isOnToolbarRef.current) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); e.stopImmediatePropagation(); setToolbarItem((p) => (p - 1 + TB_COUNT) % TB_COUNT); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); e.stopImmediatePropagation(); setToolbarItem((p) => (p + 1) % TB_COUNT); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); e.stopImmediatePropagation(); setFocusIndex(0); return; }
      if (e.key === "Enter") { e.preventDefault(); e.stopImmediatePropagation(); activateToolbar(); return; }
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); if (showSearch) { setShowSearch(false); } else { toggleFullscreen(); } return; }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setFocusIndex, showSearch]);

  function activateToolbar() {
    const item = toolbarItemRef.current;
    if (item < 4) {
      setFilter(FILTERS[item].value);
    } else if (item === 4) {
      toggleMode();
    } else if (item === 5) {
      setShowSearch(true);
    } else {
      toggleFullscreen();
    }
  }

  const tbClass = (i: number) =>
    toolbarItem === i && isOnToolbar ? "ring-2 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-[#0a0a0b] scale-105" : "";

  const formatPlaytime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60 > 0 ? `${minutes % 60}m` : ""}`;
  };

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-[#0a0a0b] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none z-0 dark:block hidden"
        style={{ background: "radial-gradient(ellipse 80% 60% at 50% 60%, #1a1a2e 0%, #0a0a0b 70%)" }} />

      {/* ── Top bar ── */}
      <div className="relative z-20 flex items-center px-8 py-4 flex-shrink-0">
        <h1 className="text-xl font-extrabold text-gray-800 dark:text-white/90 tracking-wider select-none">
          EASY<span className="text-primary">GAME</span>HUB
        </h1>
        <div className="flex-1" />
        {steamLoading && <span className="mr-4 text-xs text-gray-400 dark:text-white/45">{t("common.loading")} Steam</span>}
        <div className="flex items-center gap-3">
          {/* Theme toggle */}
          <button
            onClick={() => toggleMode()}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 ${tbClass(4)} ${
              toolbarItem === 4 && isOnToolbar
                ? "bg-primary/20 text-primary ring-2 ring-primary"
                : "text-gray-400 dark:text-white/50 hover:text-gray-600 dark:hover:text-white/80 hover:bg-gray-100 dark:hover:bg-white/10"
            }`}
          >
            <Icon name="theme" size={20} />
          </button>

          {/* Search */}
          {showSearch ? (
            <div className={`flex items-center gap-2 animate-scale-in ${tbClass(5)}`}>
              <SearchInput
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("games.search")}
                className="w-[220px]"
                onBlur={() => { if (!search) setShowSearch(false); }}
                onKeyDown={(e) => { if (e.key === "Escape") { setShowSearch(false); e.stopPropagation(); } }}
              />
            </div>
          ) : (
            <button
              onClick={() => setShowSearch(true)}
              className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 ${tbClass(5)} ${
                toolbarItem === 5 && isOnToolbar
                  ? "bg-primary/20 text-primary ring-2 ring-primary"
                  : "text-gray-400 dark:text-white/50 hover:text-gray-600 dark:hover:text-white/80 hover:bg-gray-100 dark:hover:bg-white/10"
              }`}
            >
              <Icon name="search" size={20} />
            </button>
          )}

          {/* Exit */}
          <button
            onClick={() => toggleFullscreen()}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 ${tbClass(6)} ${
              toolbarItem === 6 && isOnToolbar
                ? "bg-red-500/20 text-red-400 ring-2 ring-red-500"
                : "text-gray-400 dark:text-white/40 hover:text-red-400 hover:bg-red-500/10"
            }`}
          >
            <Icon name="fullscreen" size={20} />
          </button>
        </div>
      </div>

      {/* ── Checkbox filter pills ── */}
      <div className="relative z-20 flex items-center gap-1.5 px-8 flex-shrink-0">
        {FILTERS.map((f, i) => {
          const active = filter === f.value;
          const focused = toolbarItem === i && isOnToolbar;
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                active
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-gray-400 dark:text-white/50 hover:text-gray-600 dark:hover:text-white/80 hover:bg-gray-100 dark:hover:bg-white/10"
              } ${tbClass(i)} ${
                focused ? "ring-2 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-[#0a0a0b] scale-105" : ""
              }`}
            >
              {t(f.key) || f.fallback || f.value}
            </button>
          );
        })}
        <span className="text-[11px] text-gray-300 dark:text-white/20 ml-1">· {displayed.length}</span>
      </div>

      {/* ── Cover grid ── */}
      <div ref={gridRef} className="relative z-10 flex-1 overflow-y-auto px-8 pt-3 pb-6"
        style={{ scrollbarWidth: "none" }}>
        {displayed.length === 0 ? (
          <div className="flex items-center justify-center h-full text-white/20 text-xl">
            {t("games.noGames")}
          </div>
        ) : (
          <div className="bp-grid grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
            {displayed.map((game: any, i: number) => (
              <BigPictureCard
                key={game.id}
                steamAppId={game.steam_app_id || game._invAppId || null}
                name={game.name}
                playtime={game._invPlaytime > 0 ? formatPlaytime(game._invPlaytime) : undefined}
                focused={i === focusedItem}
                onClick={() => handleLaunch(i)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom hint bar */}
      <div className="relative z-20 flex items-center justify-center gap-10 px-8 py-4 flex-shrink-0">
        <span className="flex items-center gap-2 text-gray-300 dark:text-white/15 text-[11px]">
          <span className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center"><Icon name="arrowLeft" size={12} className="text-white/30" /></span> Navigate
        </span>
        <span className="flex items-center gap-2 text-gray-300 dark:text-white/15 text-[11px]">
          <span className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-white/30 text-[10px] font-bold">A</span> Launch
        </span>
        <span className="flex items-center gap-2 text-gray-300 dark:text-white/15 text-[11px]">
          <span className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-white/30 text-[10px] font-bold">B</span> Back
        </span>
      </div>
    </div>
  );
}
