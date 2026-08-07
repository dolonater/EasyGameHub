import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import Button from "../ui/Button";
import TextField from "../ui/TextField";
import Icon from "../ui/Icon";
import ChipDropdown from "../ui/ChipDropdown";
import GameSearchBox from "./GameSearchBox";
import { showToast } from "../Notification";
import { patchSteamHubCache, useSteamHubCache } from "../../lib/steamHubCache";
import type { MetadataDto, NewsItemDto } from "../../lib/steamCommunity";

interface NewsFeedProps {
  /** App IDs to monitor (wishlist ∪ manual watchlist). */
  appIds: number[];
  /** App ID → display name resolution. */
  appNames: Record<number, string>;
  /** App IDs the user can un-watch (manual watchlist, not the Steam wishlist). */
  watchAppIds: number[];
  onAddWatch: (appId: number, name?: string) => Promise<void> | void;
  onRemoveWatch: (appId: number) => Promise<void> | void;
}

type FeedCategory = "announcement" | "update" | "news" | "other";

/** Bucket a news item by feed type; falls back to its label heuristics. */
function feedCategory(item: NewsItemDto): FeedCategory {
  const label = (item.feedLabel || "").toLowerCase();
  if (label.includes("announcement")) return "announcement";
  if (label.includes("patch") || label.includes("update")) return "update";
  if (label.includes("news")) return "news";
  if (item.feedType != null) {
    if (item.feedType === 4) return "announcement";
    if (item.feedType === 2) return "update";
    if (item.feedType === 1 || item.feedType === 3) return "news";
  }
  return "other";
}

const READ_STORAGE_KEY = "doona-steam-news-read-v1";
const itemKey = (item: NewsItemDto) => `${item.appId}:${item.date}:${item.title}`;

function loadReadKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    // Corrupt or unavailable storage — start fresh.
  }
  return new Set();
}

function saveReadKeys(set: Set<string>) {
  try {
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // Ignore storage failures.
  }
}

/**
 * 新闻 tab: aggregated news/update feed for the monitored games with per-game
 * filtering/grouping, feed-type filtering, unread markers and a watched-games
 * management panel. Games are added by name via store search.
 */
export default function NewsFeed({
  appIds,
  appNames,
  watchAppIds,
  onAddWatch,
  onRemoveWatch,
}: NewsFeedProps) {
  const { t } = useTranslation();
  const { newsItems, newsMetadata, newsKey } = useSteamHubCache();
  const cacheKey = appIds.join(",");
  const hasCache = newsKey === cacheKey;

  // Initialize from the shared cache so re-mounting after a route switch shows
  // the last feed instantly instead of flashing a spinner.
  const [items, setItems] = useState<NewsItemDto[]>(hasCache ? newsItems : []);
  const [metadata, setMetadata] = useState<Record<number, MetadataDto>>(
    hasCache ? newsMetadata : {}
  );
  const [loading, setLoading] = useState(!hasCache);
  const [error, setError] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const [newAppId, setNewAppId] = useState("");
  const [newName, setNewName] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [manageOpen, setManageOpen] = useState(false);

  // Filtering / grouping / unread / expand state.
  const [gameFilter, setGameFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [grouped, setGrouped] = useState(false);
  const [collapsedGames, setCollapsedGames] = useState<Set<number>>(new Set());
  const [readKeys, setReadKeys] = useState<Set<string>>(() => loadReadKeys());

  // Reset the game filter when the watched set changes (e.g. a watch removed).
  useEffect(() => {
    setGameFilter("all");
  }, [cacheKey]);

  // Optional metadata (header images) for the monitored games.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (appIds.length === 0) {
        setMetadata({});
        return;
      }
      try {
        const list = await invoke<MetadataDto[]>("get_steam_metadata", { appIds });
        if (!cancelled) {
          const map = Object.fromEntries(list.map((m) => [m.appId, m]));
          setMetadata(map);
          patchSteamHubCache({ newsMetadata: map });
        }
      } catch {
        // Covers are optional — fall back to name-only cards.
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [appIds]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setError(false);
      if (appIds.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }
      // Only flash the spinner when we don't already have cached data for this
      // key; otherwise render the snapshot and refresh silently.
      if (newsKey !== cacheKey) setLoading(true);
      try {
        const feed = await invoke<NewsItemDto[]>("get_news_feed", {
          appIds,
          perGame: 3,
        });
        if (!cancelled) {
          setItems(feed);
          patchSteamHubCache({ newsItems: feed, newsKey: cacheKey });
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appIds, refreshKey, cacheKey]);

  const filtered = useMemo(() => {
    let list = items;
    if (gameFilter !== "all") list = list.filter((i) => i.appId === Number(gameFilter));
    if (typeFilter !== "all") list = list.filter((i) => feedCategory(i) === typeFilter);
    return list;
  }, [items, gameFilter, typeFilter]);

  const groups = useMemo(() => {
    const map = new Map<number, NewsItemDto[]>();
    for (const item of filtered) {
      const arr = map.get(item.appId) ?? [];
      arr.push(item);
      map.set(item.appId, arr);
    }
    return [...map.entries()];
  }, [filtered]);

  const unreadCount = useMemo(
    () => items.filter((i) => !readKeys.has(itemKey(i))).length,
    [items, readKeys]
  );

  const markRead = (item: NewsItemDto) => {
    const key = itemKey(item);
    setReadKeys((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      saveReadKeys(next);
      return next;
    });
  };

  const markAllRead = () => {
    setReadKeys((prev) => {
      const next = new Set(prev);
      items.forEach((i) => next.add(itemKey(i)));
      saveReadKeys(next);
      return next;
    });
  };

  const toggleGroup = (appId: number) => {
    setCollapsedGames((prev) => {
      const next = new Set(prev);
      if (next.has(appId)) next.delete(appId);
      else next.add(appId);
      return next;
    });
  };

  const openLink = (url: string) => {
    void invoke("open_url", { url });
  };

  const handleAdd = async () => {
    const appId = Number(newAppId);
    if (!appId) return;
    await onAddWatch(appId, newName || undefined);
    setNewAppId("");
    setNewName("");
    setAddOpen(false);
    setManual(false);
    showToast("success", t("steam.newsAdded", { defaultValue: "已添加关注" }));
  };

  const handlePick = (appId: number, name: string) => {
    Promise.resolve(onAddWatch(appId, name)).then(() => {
      setAddOpen(false);
      setManual(false);
      showToast("success", t("steam.newsAdded", { defaultValue: "已添加关注" }));
    });
  };

  const fmtDate = (sec: number) => new Date(sec * 1000).toLocaleString();

  const renderCard = (item: NewsItemDto, bare = false) => {
    const cover = metadata[item.appId]?.headerImage;
    const key = itemKey(item);
    const unread = !readKeys.has(key);
    const open = () => {
      markRead(item);
      openLink(item.url);
    };
    return (
      <div
        key={key}
        className={
          bare
            ? "p-4 flex gap-3"
            : "app-surface app-glass-card rounded-[var(--radius)] border border-border/40 p-4 flex gap-3"
        }
      >
        {cover ? (
          <img src={cover} alt="" className="h-14 w-24 flex-none rounded object-cover" />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {unread && <span className="h-1.5 w-1.5 flex-none rounded-full bg-blue-500" />}
            <span className="text-xs font-semibold">{appNames[item.appId] || `App ${item.appId}`}</span>
            {item.feedLabel && (
              <span className="rounded-full border border-border/60 bg-secondary/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                {item.feedLabel}
              </span>
            )}
            <span className="ml-auto text-[11px] text-muted-foreground">{fmtDate(item.date)}</span>
          </div>
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => { e.preventDefault(); open(); }}
            className="mt-1.5 block text-sm font-semibold text-foreground transition-colors hover:text-primary"
          >
            {item.title}
          </a>
          {item.contents && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.contents}</p>
          )}
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={open}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
            >
              <Icon name="externalLink" size={12} />
              {t("steam.newsRead", { defaultValue: "阅读原文" })}
            </button>
            {appIds.includes(item.appId) && (
              <button
                type="button"
                onClick={() => void onRemoveWatch(item.appId)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
              >
                <Icon name="close" size={12} />
                {t("steam.newsUnwatch", { defaultValue: "取消关注" })}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const gameOptions = [
    { value: "all", label: t("steam.newsGameAll", { defaultValue: "全部游戏" }) },
    ...appIds.map((id) => ({ value: String(id), label: appNames[id] || `App ${id}` })),
  ];
  const typeOptions = [
    { value: "all", label: t("steam.newsTypeAll", { defaultValue: "全部类型" }) },
    { value: "announcement", label: t("steam.newsTypeAnnouncement", { defaultValue: "公告" }) },
    { value: "update", label: t("steam.newsTypeUpdate", { defaultValue: "更新" }) },
    { value: "news", label: t("steam.newsTypeNews", { defaultValue: "新闻" }) },
    { value: "other", label: t("steam.newsTypeOther", { defaultValue: "其他" }) },
  ];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {t("steam.newsSummary", { defaultValue: "已关注 {{count}} 款游戏", count: appIds.length })}
          {unreadCount > 0 && (
            <span className="ml-1.5 rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {unreadCount} {t("steam.newsUnreadCount", { defaultValue: "条未读" })}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setManageOpen((v) => !v)} ripple={false}>
            <Icon name="steamAccounts" size={14} />
            {t("steam.newsManage", { defaultValue: "管理" })}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAddOpen((v) => !v)} ripple={false}>
            <Icon name="addGame" size={14} />
            {t("steam.newsAddGame", { defaultValue: "关注游戏" })}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)} ripple={false}>
            <Icon name="reset" size={14} />
            {t("steam.newsRefresh", { defaultValue: "刷新" })}
          </Button>
        </div>
      </div>

      {/* Filters / tools */}
      {appIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <ChipDropdown
            label={t("steam.newsGameFilter", { defaultValue: "游戏" })}
            options={gameOptions}
            value={gameFilter}
            onSelect={setGameFilter}
          />
          <ChipDropdown
            label={t("steam.newsTypeFilter", { defaultValue: "类型" })}
            options={typeOptions}
            value={typeFilter}
            onSelect={setTypeFilter}
          />
          <Button
            variant={grouped ? "primary" : "outline"}
            size="sm"
            onClick={() => setGrouped((v) => !v)}
            ripple={false}
          >
            <Icon name="list" size={13} />
            {t("steam.newsGroup", { defaultValue: "分组" })}
          </Button>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} ripple={false}>
              <Icon name="check" size={13} />
              {t("steam.newsMarkAllRead", { defaultValue: "全部已读" })}
            </Button>
          )}
        </div>
      )}

      {/* Watched-games management panel */}
      {manageOpen && (
        <div className="app-surface app-glass-card relative z-40 rounded-[var(--radius)] border border-border/40 p-3">
          <div className="mb-2 text-xs text-muted-foreground">
            {t("steam.newsManageTitle", { defaultValue: "已关注游戏" })}
          </div>
          {appIds.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              {t("steam.newsManageEmpty", { defaultValue: "暂无关注" })}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {appIds.map((appId) => {
                const name = appNames[appId] || `App ${appId}`;
                const count = items.filter((i) => i.appId === appId).length;
                const removable = watchAppIds.includes(appId);
                const cover = metadata[appId]?.headerImage;
                return (
                  <div
                    key={appId}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-secondary/40"
                  >
                    {cover ? (
                      <img src={cover} alt="" className="h-5 w-9 flex-none rounded object-cover" />
                    ) : (
                      <Icon name="steamInventory" size={14} className="flex-none text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
                    <span className="flex-none text-[11px] text-muted-foreground">{count} 条</span>
                    {removable ? (
                      <button
                        type="button"
                        onClick={() => void onRemoveWatch(appId)}
                        title={t("steam.newsUnwatch", { defaultValue: "取消关注" })}
                        className="flex h-6 w-6 flex-none items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                      >
                        <Icon name="close" size={13} />
                      </button>
                    ) : (
                      <span className="flex-none text-[10px] text-muted-foreground/60">
                        {t("steam.newsFromWishlist", { defaultValue: "来自愿望单" })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add-watch form */}
      {addOpen && (
        <div className="app-surface app-glass-card relative z-40 rounded-[var(--radius)] border border-border/40 p-3 flex flex-col gap-2">
          {!manual ? (
            <>
              <GameSearchBox onPick={handlePick} autoFocus />
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">{t("steam.newsSearchHint", { defaultValue: "输入游戏名搜索，点击结果直接添加" })}</span>
                <button
                  type="button"
                  onClick={() => setManual(true)}
                  className="text-muted-foreground transition-colors hover:text-primary"
                >
                  {t("steam.searchManual", { defaultValue: "手动输入 AppID" })}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[120px] flex-1">
                  <label className="block text-xs text-muted-foreground mb-1">
                    {t("steam.newsAppId", { defaultValue: "AppID" })}
                  </label>
                  <TextField
                    type="number"
                    value={newAppId}
                    onChange={(e) => setNewAppId(e.target.value)}
                    placeholder="730"
                  />
                </div>
                <div className="min-w-[140px] flex-1">
                  <label className="block text-xs text-muted-foreground mb-1">
                    {t("steam.newsNameOptional", { defaultValue: "名称(可选)" })}
                  </label>
                  <TextField
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={t("steam.newsNameOptional", { defaultValue: "名称(可选)" })}
                  />
                </div>
                <Button size="sm" onClick={() => void handleAdd()} ripple={false}>
                  {t("steam.newsAdd", { defaultValue: "添加" })}
                </Button>
              </div>
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setManual(false)}
                  className="text-xs text-muted-foreground transition-colors hover:text-primary"
                >
                  {t("steam.searchByName", { defaultValue: "按名称搜索" })}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* States */}
      {loading && (
        <div className="app-surface app-glass-card rounded-[var(--radius)] border border-border/40 py-12 text-center text-muted-foreground text-sm">
          {t("common.loading")}
        </div>
      )}

      {!loading && error && (
        <div className="app-surface app-glass-card rounded-[var(--radius)] border border-border/40 py-12 text-center text-muted-foreground text-sm">
          {t("steam.newsError", { defaultValue: "新闻加载失败" })}
        </div>
      )}

      {!loading && !error && appIds.length === 0 && (
        <div className="app-surface app-glass-card rounded-[var(--radius)] border border-border/40 py-14 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Icon name="search" size={32} />
          <div className="text-sm">{t("steam.newsEmpty", { defaultValue: "先关注一些游戏来获取更新动态" })}</div>
          <div className="text-xs text-muted-foreground/70">{t("steam.newsEmptyHint", { defaultValue: "点击右上角\"关注游戏\"搜索加入" })}</div>
        </div>
      )}

      {!loading && !error && appIds.length > 0 && items.length === 0 && (
        <div className="app-surface app-glass-card rounded-[var(--radius)] border border-border/40 py-12 text-center text-muted-foreground text-sm">
          {t("steam.newsNoData", { defaultValue: "这些游戏暂无新闻" })}
        </div>
      )}

      {!loading && !error && appIds.length > 0 && items.length > 0 && filtered.length === 0 && (
        <div className="app-surface app-glass-card rounded-[var(--radius)] border border-border/40 py-12 text-center text-muted-foreground text-sm">
          {t("steam.newsFilterEmpty", { defaultValue: "当前筛选条件下没有新闻" })}
        </div>
      )}

      {/* Feed */}
      {!loading && !error && filtered.length > 0 && (
        grouped ? (
          <div className="space-y-2">
            {groups.map(([appId, groupItems]) => {
              const collapsed = collapsedGames.has(appId);
              const cover = metadata[appId]?.headerImage;
              const groupUnread = groupItems.filter((i) => !readKeys.has(itemKey(i))).length;
              return (
                <div
                  key={appId}
                  className="app-surface app-glass-card rounded-[var(--radius)] border border-border/40 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleGroup(appId)}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-secondary/30"
                  >
                    <Icon
                      name={collapsed ? "caretRight" : "angleUp"}
                      size={14}
                      className="flex-none text-muted-foreground"
                    />
                    {cover ? (
                      <img src={cover} alt="" className="h-5 w-9 flex-none rounded object-cover" />
                    ) : (
                      <Icon name="steamInventory" size={14} className="flex-none text-muted-foreground" />
                    )}
                    <span className="truncate text-sm font-semibold">
                      {appNames[appId] || `App ${appId}`}
                    </span>
                    <span className="flex-none text-[11px] text-muted-foreground">
                      {groupItems.length} 条
                    </span>
                    {groupUnread > 0 && (
                      <span className="rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        {groupUnread}
                      </span>
                    )}
                  </button>
                  {!collapsed && (
                    <div className="divide-y divide-border/40 border-t border-border/40">
                      {groupItems.map((item) => renderCard(item, true))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">{filtered.map((item) => renderCard(item))}</div>
        )
      )}
    </div>
  );
}
