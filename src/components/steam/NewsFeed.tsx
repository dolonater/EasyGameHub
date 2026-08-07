import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import Button from "../ui/Button";
import TextField from "../ui/TextField";
import Icon from "../ui/Icon";
import GameSearchBox from "./GameSearchBox";
import { showToast } from "../Notification";
import { patchSteamHubCache, useSteamHubCache } from "../../lib/steamHubCache";
import type { MetadataDto, NewsItemDto } from "../../lib/steamCommunity";

interface NewsFeedProps {
  /** App IDs to monitor (wishlist ∪ manual watchlist). */
  appIds: number[];
  /** App ID → display name resolution. */
  appNames: Record<number, string>;
  onAddWatch: (appId: number, name?: string) => Promise<void> | void;
  onRemoveWatch: (appId: number) => Promise<void> | void;
}

/**
 * 新闻 tab: aggregated news/update feed for the monitored games, newest
 * first. Includes a minimal "关注游戏" entry point so the feed is usable
 * before the full watchlist management arrives with the wishlist tab.
 */
export default function NewsFeed({
  appIds,
  appNames,
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

  return (
    <div className="space-y-3">
      {/* Header + add-watch entry */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {t("steam.newsSummary", { defaultValue: "已关注 {{count}} 款游戏", count: appIds.length })}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddOpen((v) => !v)}
            ripple={false}
          >
            <Icon name="addGame" size={14} />
            {t("steam.newsAddGame", { defaultValue: "关注游戏" })}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)} ripple={false}>
            <Icon name="reset" size={14} />
            {t("steam.newsRefresh", { defaultValue: "刷新" })}
          </Button>
        </div>
      </div>

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
          <div className="text-xs text-muted-foreground/70">{t("steam.newsEmptyHint", { defaultValue: "点击右上角\"关注游戏\"输入 AppID" })}</div>
        </div>
      )}

      {!loading && !error && appIds.length > 0 && items.length === 0 && (
        <div className="app-surface app-glass-card rounded-[var(--radius)] border border-border/40 py-12 text-center text-muted-foreground text-sm">
          {t("steam.newsNoData", { defaultValue: "这些游戏暂无新闻" })}
        </div>
      )}

      {/* Feed */}
      {!loading && !error && items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => {
            const cover = metadata[item.appId]?.headerImage;
            return (
            <div
              key={`${item.appId}-${item.date}-${item.title}`}
              className="app-surface app-glass-card rounded-[var(--radius)] border border-border/40 p-4 flex gap-3"
            >
              {cover ? (
                <img
                  src={cover}
                  alt=""
                  className="h-14 w-24 flex-none rounded object-cover"
                />
              ) : null}
              <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
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
                onClick={(e) => { e.preventDefault(); openLink(item.url); }}
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
                  onClick={() => openLink(item.url)}
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
          })}
        </div>
      )}
    </div>
  );
}
