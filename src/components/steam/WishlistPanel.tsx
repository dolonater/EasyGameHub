import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import Button from "../ui/Button";
import TextField from "../ui/TextField";
import Icon from "../ui/Icon";
import ChipDropdown from "../ui/ChipDropdown";
import GameSearchBox from "./GameSearchBox";
import PriceChartDialog from "./PriceChartDialog";
import StoreDetailDialog from "./StoreDetailDialog";
import { showToast } from "../Notification";
import { patchSteamHubCache, useSteamHubCache } from "../../lib/steamHubCache";
import { formatPriceCents } from "../../lib/steamCommunity";
import type {
  MetadataDto,
  PriceDropEventDto,
  PriceDto,
  PriceHistoryPoint,
  SessionDto,
  WatchItemDto,
  WishlistItemDto,
} from "../../lib/steamCommunity";

interface WishlistPanelProps {
  session: SessionDto | null;
  wishItems: WishlistItemDto[];
  wishError: boolean;
  wishLoading: boolean;
  onRefreshWishlist: () => Promise<void>;
  watchItems: WatchItemDto[];
  onAddWatch: (appId: number, name?: string) => Promise<void>;
  onRemoveWatch: (appId: number) => Promise<void>;
}

type Source = "wishlist" | "local";

interface CombinedItem {
  appId: number;
  name: string;
  source: Source;
}

type SortMode = "default" | "discount" | "priceAsc" | "priceDesc" | "name";
type FilterMode = "all" | "discount" | "free" | "dropped" | "comingSoon";
type SourceFilter = "all" | "wishlist" | "local";

/** Tiny inline price-history line, green when the current price is the low.
 *  Clicking opens the larger chart (PriceChartDialog). */
function PriceSparkline({
  points,
  onClick,
  title,
}: {
  points: PriceHistoryPoint[];
  onClick?: () => void;
  title?: string;
}) {
  if (points.length < 2) return null;
  const W = 64;
  const H = 22;
  const PAD = 2;
  const max = Math.max(...points.map((p) => p.finalPrice));
  const min = Math.min(...points.map((p) => p.finalPrice));
  const range = max - min || 1;
  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const y = (p: number) => H - PAD - ((p - min) / range) * (H - PAD * 2);
  const last = points[points.length - 1];
  const atLow = last.finalPrice <= min + 0.5; // current price is (near) the low
  const color = atLow ? "#22c55e" : "currentColor";
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.finalPrice).toFixed(1)}`)
    .join(" ");
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex-none rounded transition-opacity hover:opacity-80"
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="text-muted-foreground/60">
        <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={x(points.length - 1)} cy={y(last.finalPrice)} r={1.8} fill={color} />
      </svg>
    </button>
  );
}

/**
 * 愿望单 tab: public Steam wishlist merged with the local watchlist, showing
 * live prices, discount badges, drop detection, historical-low badge + price
 * sparkline, per-game reminder thresholds, and search-by-name add.
 */
export default function WishlistPanel({
  session,
  wishItems,
  wishError,
  wishLoading,
  onRefreshWishlist,
  watchItems,
  onAddWatch,
  onRemoveWatch,
}: WishlistPanelProps) {
  const { t } = useTranslation();
  const { wishPrices, wishMetadata, wishKey } = useSteamHubCache();

  const [sort, setSort] = useState<SortMode>("default");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [thresholds, setThresholds] = useState<Record<number, number>>({});
  const [thresholdEditing, setThresholdEditing] = useState<number | null>(null);
  const [thresholdInput, setThresholdInput] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const [newAppId, setNewAppId] = useState("");
  const [newName, setNewName] = useState("");
  const [chartItem, setChartItem] = useState<{
    appId: number;
    name: string;
    points: PriceHistoryPoint[];
    currency: string | null;
  } | null>(null);
  const [detailAppId, setDetailAppId] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const combined = useMemo<CombinedItem[]>(() => {
    const map = new Map<number, CombinedItem>();
    for (const w of wishItems) {
      map.set(w.appId, {
        appId: w.appId,
        name: w.name || `App ${w.appId}`,
        source: "wishlist",
      });
    }
    for (const w of watchItems) {
      const existing = map.get(w.appId);
      map.set(w.appId, {
        appId: w.appId,
        name: w.name || existing?.name || `App ${w.appId}`,
        source: "local",
      });
    }
    return Array.from(map.values());
  }, [wishItems, watchItems]);
  const cacheKey = useMemo(() => combined.map((c) => c.appId).join(","), [combined]);
  const hasCache = wishKey === cacheKey;

  // Initialize prices/metadata from the shared cache so re-mounting after a
  // route switch renders the last snapshot instantly instead of flashing a
  // loading placeholder while the (network) price fetch runs again.
  const [prices, setPrices] = useState<Record<number, PriceDto>>(hasCache ? wishPrices : {});
  const [metadata, setMetadata] = useState<Record<number, MetadataDto>>(
    hasCache ? wishMetadata : {}
  );
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">("idle");
  const [refreshKey, setRefreshKey] = useState(0);
  const toasted = useRef(new Set<number>());
  const thresholdToasted = useRef(new Set<number>());

  // Load reminder thresholds once (per-app price floor, persisted backend-side).
  useEffect(() => {
    let cancelled = false;
    void invoke<Record<number, number>>("get_price_thresholds")
      .then((map) => {
        if (!cancelled) setThresholds(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the persisted price-drop log (survives restarts / history cap).
  const [dropEvents, setDropEvents] = useState<PriceDropEventDto[]>([]);
  useEffect(() => {
    let cancelled = false;
    void invoke<PriceDropEventDto[]>("get_price_drop_events")
      .then((list) => {
        if (!cancelled) setDropEvents(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (combined.length === 0) {
        setPrices({});
        setMetadata({});
        return;
      }
      // Only flash the loading placeholder when we don't have cached data for
      // this key; otherwise render the snapshot and refresh silently.
      if (wishKey !== cacheKey) setLoadState("loading");
      try {
        const appIds = combined.map((c) => c.appId);
        const [priceList, metaList] = await Promise.all([
          invoke<PriceDto[]>("get_steam_prices", { appIds }),
          invoke<MetadataDto[]>("get_steam_metadata", { appIds }),
        ]);
        if (cancelled) return;
        const priceMap = Object.fromEntries(priceList.map((p) => [p.appId, p]));
        const metaMap = Object.fromEntries(metaList.map((m) => [m.appId, m]));
        setPrices(priceMap);
        setMetadata(metaMap);
        setLoadState("idle");
        patchSteamHubCache({ wishPrices: priceMap, wishMetadata: metaMap, wishKey: cacheKey });

        // Toast newly-detected drops once per price-drop event.
        const dropped = priceList.filter((p) => p.dropped && !toasted.current.has(p.appId));
        if (dropped.length > 0) {
          dropped.forEach((p) => toasted.current.add(p.appId));
          showToast("info", t("steam.priceDropToast", { defaultValue: "{{count}} 款关注游戏降价", count: dropped.length }));
        }
        // Toast newly-hit reminder thresholds once per event.
        const hit = priceList.filter((p) => p.thresholdHit && !thresholdToasted.current.has(p.appId));
        if (hit.length > 0) {
          hit.forEach((p) => thresholdToasted.current.add(p.appId));
          showToast("info", t("steam.thresholdReachedToast", { defaultValue: "{{count}} 款关注游戏已达提醒价", count: hit.length }));
        }
      } catch {
        if (!cancelled) {
          // Keep any cached/displayed prices or metadata — only surface an
          // error when there is nothing at all to show (e.g. genuine first
          // load failure). A transient background-refresh failure must not
          // replace cached prices with an error banner.
          const hasAnyData =
            Object.keys(prices).length > 0 || Object.keys(metadata).length > 0;
          if (!hasAnyData) setLoadState("error");
        }
      }
    };
    void load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combined, refreshKey, cacheKey, t]);

  // Apply sort + filter to the combined list (recomputes as prices arrive).
  const visible = useMemo(() => {
    let list = combined;
    if (filter === "discount") {
      list = list.filter((i) => (prices[i.appId]?.discountPercent ?? 0) > 0);
    } else if (filter === "free") {
      list = list.filter((i) => metadata[i.appId]?.isFree === true);
    } else if (filter === "dropped") {
      list = list.filter((i) => prices[i.appId]?.dropped === true);
    } else if (filter === "comingSoon") {
      list = list.filter((i) => metadata[i.appId]?.comingSoon === true);
    }
    if (sourceFilter === "wishlist") {
      list = list.filter((i) => i.source === "wishlist");
    } else if (sourceFilter === "local") {
      list = list.filter((i) => i.source === "local");
    }
    const sorted = [...list];
    switch (sort) {
      case "discount":
        sorted.sort((a, b) => (prices[b.appId]?.discountPercent ?? 0) - (prices[a.appId]?.discountPercent ?? 0));
        break;
      case "priceAsc":
        sorted.sort((a, b) => (prices[a.appId]?.finalPrice ?? Infinity) - (prices[b.appId]?.finalPrice ?? Infinity));
        break;
      case "priceDesc":
        sorted.sort((a, b) => (prices[b.appId]?.finalPrice ?? -1) - (prices[a.appId]?.finalPrice ?? -1));
        break;
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        sorted.sort((a, b) => a.appId - b.appId);
    }
    return sorted;
  }, [combined, sort, filter, sourceFilter, prices, metadata]);

  const handlePick = (appId: number, name: string) => {
    void onAddWatch(appId, name);
    setAddOpen(false);
    setManual(false);
  };

  const handleManualAdd = async () => {
    const appId = Number(newAppId);
    if (!appId) return;
    await onAddWatch(appId, newName || undefined);
    setNewAppId("");
    setNewName("");
    setAddOpen(false);
    setManual(false);
  };

  const saveThreshold = async (appId: number, cents: number | null) => {
    try {
      await invoke("set_price_threshold", { appId, threshold: cents });
      setThresholds((prev) => {
        const next = { ...prev };
        if (cents != null) next[appId] = cents;
        else delete next[appId];
        return next;
      });
      setThresholdEditing(null);
      setThresholdInput("");
      showToast(
        "success",
        cents != null
          ? t("steam.wishlistThresholdSaved", { defaultValue: "提醒价已保存" })
          : t("steam.wishlistThresholdCleared", { defaultValue: "已取消提醒" }),
      );
    } catch (e: any) {
      showToast("error", String(e));
    }
  };

  const startThresholdEdit = (appId: number) => {
    setThresholdEditing(appId);
    setThresholdInput(thresholds[appId] != null ? String((thresholds[appId]! / 100).toFixed(2)) : "");
  };

  const currencyOf = (appId: number) => prices[appId]?.currency ?? null;

  interface DropEvent {
    appId: number;
    name: string;
    date: string;
    prevPrice: number;
    newPrice: number;
    discount: number;
    currency: string | null;
    /** Synthetic event for a sale that is live now but was never observed
     *  dropping (e.g. the game was added while already on sale). */
    isCurrent: boolean;
  }

  function fmtNow(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  /** 降价记录 = persisted drop events ∪ observed history drops ∪ live sales. */
  const dropHistory = useMemo<DropEvent[]>(() => {
    const nameMap = new Map(combined.map((c) => [c.appId, c.name]));
    const events: DropEvent[] = [];
    const seen = new Set<string>();

    const addEvent = (e: DropEvent) => {
      const key = `${e.appId}:${e.newPrice}:${e.discount}:${e.date}`;
      if (seen.has(key)) return;
      seen.add(key);
      events.push(e);
    };

    // 1) Persisted drop events (durable log — survives restarts, the history
    //    cap, and games leaving the watchlist).
    for (const ev of dropEvents) {
      addEvent({
        appId: ev.appId,
        name: nameMap.get(ev.appId) ?? `App ${ev.appId}`,
        date: ev.date,
        prevPrice: ev.prevPrice,
        newPrice: ev.newPrice,
        discount: ev.discountPercent,
        currency: ev.currency,
        isCurrent: false,
      });
    }

    // 2) Observed drops from price history (covers pre-persistence data).
    for (const item of combined) {
      const price = prices[item.appId];
      if (!price) continue;
      for (let i = 1; i < price.history.length; i++) {
        const prev = price.history[i - 1];
        const cur = price.history[i];
        if (cur.finalPrice < prev.finalPrice) {
          addEvent({
            appId: item.appId,
            name: item.name,
            date: cur.date,
            prevPrice: prev.finalPrice,
            newPrice: cur.finalPrice,
            discount: cur.discountPercent,
            currency: price.currency,
            isCurrent: false,
          });
        }
      }
    }

    // 3) Live sale never recorded (e.g. added mid-sale): synthesize
    //    list price → sale price.
    const recordedStates = new Set<string>();
    for (const ev of dropEvents) {
      recordedStates.add(`${ev.appId}:${ev.newPrice}:${ev.discountPercent}`);
    }
    for (const item of combined) {
      const price = prices[item.appId];
      if (!price) continue;
      const final = price.finalPrice;
      const initial = price.initialPrice;
      if (
        final == null ||
        initial == null ||
        price.discountPercent <= 0 ||
        final >= initial
      ) {
        continue;
      }
      // Already persisted, or a history point already shows this exact sale.
      if (recordedStates.has(`${item.appId}:${final}:${price.discountPercent}`)) continue;
      if (price.history.some((p) => p.finalPrice === final && p.discountPercent === price.discountPercent)) {
        continue;
      }
      events.push({
        appId: item.appId,
        name: item.name,
        // Use the last observed date when available so it sorts like history.
        date: price.history.length > 0 ? price.history[price.history.length - 1].date : fmtNow(),
        prevPrice: initial,
        newPrice: final,
        discount: price.discountPercent,
        currency: price.currency,
        isCurrent: true,
      });
    }

    // Date strings are fixed-width "YYYY-MM-DD HH:MM:SS", so lexicographic
    // sorting equals chronological sorting.
    events.sort((a, b) => b.date.localeCompare(a.date));
    return events.slice(0, 30);
  }, [combined, prices, dropEvents]);

  const fmtPrice = (cents: number, currency: string | null) => formatPriceCents(cents, currency);

  const priceNode = (item: CombinedItem) => {
    const meta = metadata[item.appId];
    const price = prices[item.appId];
    if (meta?.isFree) {
      return <span className="text-sm font-semibold">{t("steam.wishlistFree")}</span>;
    }
    if (!price || price.finalPrice == null) {
      return <span className="text-sm text-muted-foreground">{t("steam.wishlistPriceUnknown")}</span>;
    }
    return (
      <div className="flex flex-wrap items-center gap-2">
        {price.dropped && (
          <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-600 dark:text-green-400">
            {t("steam.wishlistPriceDrop")}
          </span>
        )}
        {price.discountPercent > 0 && (
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            -{price.discountPercent}%
          </span>
        )}
        <span className="text-sm font-semibold">
          {price.finalFormatted || fmtPrice(price.finalPrice, price.currency)}
        </span>
        {price.discountPercent > 0 && price.initialPrice != null && (
          <span className="text-xs text-muted-foreground line-through">
            {price.initialFormatted || fmtPrice(price.initialPrice, price.currency)}
          </span>
        )}
      </div>
    );
  };

  const notice = !session
    ? t("steam.wishlistNoticeLoggedOut", { defaultValue: "登录后可同步公开愿望单" })
    : wishError
      ? t("steam.wishlistNoticePrivate", { defaultValue: "无法读取公开愿望单（可能已设为私密），仅显示本地关注" })
      : null;

  const sortOptions = [
    { value: "default", label: t("steam.wishlistSortDefault", { defaultValue: "默认" }) },
    { value: "discount", label: t("steam.wishlistSortDiscount", { defaultValue: "折扣最高" }) },
    { value: "priceAsc", label: t("steam.wishlistSortPriceAsc", { defaultValue: "价格从低到高" }) },
    { value: "priceDesc", label: t("steam.wishlistSortPriceDesc", { defaultValue: "价格从高到低" }) },
    { value: "name", label: t("steam.wishlistSortName", { defaultValue: "名称" }) },
  ];
  const filterOptions = [
    { value: "all", label: t("steam.wishlistFilterAll", { defaultValue: "全部" }) },
    { value: "discount", label: t("steam.wishlistFilterDiscount", { defaultValue: "折扣中" }) },
    { value: "free", label: t("steam.wishlistFilterFree", { defaultValue: "免费" }) },
    { value: "dropped", label: t("steam.wishlistFilterDropped", { defaultValue: "降价中" }) },
    { value: "comingSoon", label: t("steam.wishlistFilterComingSoon", { defaultValue: "未发售" }) },
  ];
  const sourceOptions = [
    { value: "all", label: t("steam.wishlistSourceAll", { defaultValue: "全部来源" }) },
    { value: "wishlist", label: t("steam.wishlistSourceSteam", { defaultValue: "Steam 愿望单" }) },
    { value: "local", label: t("steam.wishlistSourceLocal", { defaultValue: "本地关注" }) },
  ];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {t("steam.wishlistSummary", { defaultValue: "共 {{count}} 款", count: visible.length })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ChipDropdown
            label={t("steam.wishlistSort", { defaultValue: "排序" })}
            options={sortOptions}
            value={sort}
            onSelect={(v) => setSort(v as SortMode)}
          />
          <ChipDropdown
            label={t("steam.wishlistFilter", { defaultValue: "筛选" })}
            options={filterOptions}
            value={filter}
            onSelect={(v) => setFilter(v as FilterMode)}
          />
          <ChipDropdown
            label={t("steam.wishlistSource", { defaultValue: "来源" })}
            options={sourceOptions}
            value={sourceFilter}
            onSelect={(v) => setSourceFilter(v as SourceFilter)}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHistoryOpen((v) => !v)}
            ripple={false}
          >
            <Icon name="chartLine" size={14} />
            {t("steam.wishlistDropHistory", { defaultValue: "降价记录" })}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAddOpen((v) => !v)} ripple={false}>
            <Icon name="addGame" size={14} />
            {t("steam.wishlistAddGame")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => { void onRefreshWishlist(); setRefreshKey((k) => k + 1); }} ripple={false}>
            <Icon name="reset" size={14} />
            {t("steam.wishlistRefresh")}
          </Button>
        </div>
      </div>

      {/* Price-drop history */}
      {historyOpen && (
        <div className="app-surface app-glass-card relative z-40 rounded-[var(--radius)] border border-border/40 p-3">
          <div className="mb-2 text-xs text-muted-foreground">
            {t("steam.wishlistDropHistoryTitle", { defaultValue: "降价记录（来自价格历史）" })}
          </div>
          {dropHistory.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              {t("steam.wishlistDropHistoryEmpty", { defaultValue: "暂无降价记录" })}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {dropHistory.map((e, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-secondary/40"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">{e.name}</span>
                  {e.isCurrent && (
                    <span className="flex-none rounded-full border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                      {t("steam.wishlistDropCurrent", { defaultValue: "当前折扣" })}
                    </span>
                  )}
                  <span className="flex-none text-[11px] text-muted-foreground">{e.date}</span>
                  <span className="flex-none text-xs text-muted-foreground line-through">
                    {fmtPrice(e.prevPrice, e.currency ?? currencyOf(e.appId))}
                  </span>
                  <Icon name="arrowRight" size={11} className="flex-none text-muted-foreground" />
                  <span className="flex-none text-sm font-semibold text-green-600 dark:text-green-400">
                    {fmtPrice(e.newPrice, e.currency ?? currencyOf(e.appId))}
                  </span>
                  {e.discount > 0 && (
                    <span className="flex-none rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      -{e.discount}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Wishlist notice */}
      {(notice || wishLoading) && (
        <div className="app-surface app-glass-card rounded-[var(--radius)] border border-border/40 px-4 py-2 text-xs text-muted-foreground">
          {wishLoading ? t("common.loading") : notice}
        </div>
      )}

      {/* Add-watch form. `relative z-40` lifts the card (and its search
          dropdown) above the sibling glass cards, which each form their own
          stacking context via backdrop-filter. */}
      {addOpen && (
        <div className="app-surface app-glass-card relative z-40 rounded-[var(--radius)] border border-border/40 p-3 flex flex-col gap-2">
          {!manual ? (
            <>
              <GameSearchBox onPick={handlePick} autoFocus />
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">{t("steam.wishlistSearchHint", { defaultValue: "输入游戏名搜索，点击结果直接添加" })}</span>
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
                  <label className="block text-xs text-muted-foreground mb-1">{t("steam.newsAppId")}</label>
                  <TextField type="number" value={newAppId} onChange={(e) => setNewAppId(e.target.value)} placeholder="730" />
                </div>
                <div className="min-w-[140px] flex-1">
                  <label className="block text-xs text-muted-foreground mb-1">{t("steam.newsNameOptional")}</label>
                  <TextField value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("steam.newsNameOptional")} />
                </div>
                <Button size="sm" onClick={() => void handleManualAdd()} ripple={false}>
                  {t("steam.newsAdd")}
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
      {loadState === "loading" && combined.length > 0 && (
        <div className="app-surface app-glass-card rounded-[var(--radius)] border border-border/40 py-12 text-center text-muted-foreground text-sm">
          {t("common.loading")}
        </div>
      )}
      {loadState === "error" && (
        <div className="app-surface app-glass-card rounded-[var(--radius)] border border-border/40 py-12 text-center text-muted-foreground text-sm">
          {t("steam.wishlistError", { defaultValue: "价格信息加载失败" })}
        </div>
      )}
      {combined.length === 0 && !wishLoading && (
        <div className="app-surface app-glass-card rounded-[var(--radius)] border border-border/40 py-14 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Icon name="starOutline" size={32} />
          <div className="text-sm">{t("steam.wishlistEmpty")}</div>
          <div className="text-xs text-muted-foreground/70">{t("steam.wishlistEmptyHint", { defaultValue: "通过右上角\"添加关注\"加入游戏" })}</div>
        </div>
      )}
      {combined.length > 0 && visible.length === 0 && loadState !== "loading" && (
        <div className="app-surface app-glass-card rounded-[var(--radius)] border border-border/40 py-12 text-center text-muted-foreground text-sm">
          {t("steam.wishlistFilterEmpty", { defaultValue: "当前筛选条件下没有游戏" })}
        </div>
      )}

      {/* Cards */}
      {loadState !== "loading" && visible.length > 0 && (
        <div className="space-y-2">
          {visible.map((item) => {
            const meta = metadata[item.appId];
            const price = prices[item.appId];
            const threshold = thresholds[item.appId];
            const editing = thresholdEditing === item.appId;
            return (
              <div key={item.appId} className="app-surface app-glass-card rounded-[var(--radius)] border border-border/40 p-3 flex gap-3">
                {meta?.headerImage ? (
                  <img src={meta.headerImage} alt={item.name} className="h-16 w-28 flex-none rounded object-cover" />
                ) : (
                  <div className="flex h-16 w-28 flex-none items-center justify-center rounded bg-secondary/40 text-muted-foreground">
                    <Icon name="steamInventory" size={20} />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold truncate">{item.name}</span>
                    <span className="rounded-full border border-border/60 bg-secondary/40 px-2 py-0.5 text-[11px] text-muted-foreground">
                      {item.source === "wishlist" ? t("steam.wishlistSourceSteam") : t("steam.wishlistSourceLocal")}
                    </span>
                    {meta?.comingSoon && (
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        {t("steam.wishlistComingSoon", { defaultValue: "即将发售" })}
                      </span>
                    )}
                  </div>

                  {meta && meta.genres.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {meta.genres.slice(0, 3).map((g) => (
                        <span key={g} className="text-[11px] text-muted-foreground">{g}</span>
                      ))}
                    </div>
                  )}

                  {meta?.shortDescription && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{meta.shortDescription}</p>
                  )}

                  <div className="mt-1.5">{priceNode(item)}</div>

                  {/* Historical low + sparkline + reminder threshold row */}
                  {price && price.finalPrice != null && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {price.history.length >= 2 ? (
                        <PriceSparkline
                          points={price.history}
                          onClick={() =>
                            setChartItem({
                              appId: item.appId,
                              name: item.name,
                              points: price.history,
                              currency: price.currency,
                            })
                          }
                          title={t("steam.wishlistViewChart", { defaultValue: "查看价格走势" })}
                        />
                      ) : (
                        <span className="text-[11px] text-muted-foreground/60">
                          {t("steam.wishlistChartHint", { defaultValue: "价格曲线将在多次刷新后生成" })}
                        </span>
                      )}
                      {price.lowestPrice != null &&
                        price.finalPrice === price.lowestPrice &&
                        price.history.length >= 2 && (
                          <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-600 dark:text-green-400">
                            {t("steam.wishlistHistoricalLow", { defaultValue: "历史最低" })}
                          </span>
                        )}
                      {price.thresholdHit && (
                        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          {t("steam.wishlistThresholdHit", { defaultValue: "已达提醒价" })}
                        </span>
                      )}
                      {!editing ? (
                        <>
                          {threshold != null && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              {t("steam.wishlistThresholdSet", { defaultValue: "低于 ¥{{price}} 提醒", price: fmtPrice(threshold, price.currency) })}
                              <button
                                type="button"
                                onClick={() => void saveThreshold(item.appId, null)}
                                className="text-muted-foreground transition-colors hover:text-destructive"
                                title={t("common.remove")}
                              >
                                <Icon name="close" size={11} />
                              </button>
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => startThresholdEdit(item.appId)}
                            className={`inline-flex items-center gap-1 text-[11px] ${threshold != null ? "text-primary" : "text-muted-foreground"} transition-colors hover:text-primary`}
                            title={t("steam.wishlistSetThreshold", { defaultValue: "设置提醒价" })}
                          >
                            <Icon name="bell" size={12} />
                            {threshold == null && t("steam.wishlistSetThreshold", { defaultValue: "提醒" })}
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <TextField
                            type="number"
                            density="compact"
                            value={thresholdInput}
                            onChange={(e) => setThresholdInput(e.target.value)}
                            placeholder={t("steam.wishlistThresholdPlaceholder", { defaultValue: "价格(元)" })}
                            className="w-24"
                          />
                          <Button size="sm" variant="outline" onClick={() => {
                            const cents = Math.round(parseFloat(thresholdInput) * 100);
                            void saveThreshold(item.appId, Number.isFinite(cents) && cents > 0 ? cents : null);
                          }} ripple={false}>
                            {t("common.save")}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setThresholdEditing(null)} ripple={false}>
                            {t("common.cancel")}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-none flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDetailAppId(item.appId)}
                    className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    title={t("steam.storeDetail", { defaultValue: "商店详情" })}
                  >
                    <Icon name="info" size={14} />
                  </button>
                  {item.source === "local" && (
                    <button
                      type="button"
                      onClick={() => void onRemoveWatch(item.appId)}
                      className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                      title={t("steam.wishlistRemove")}
                    >
                      <Icon name="close" size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <StoreDetailDialog appId={detailAppId} onClose={() => setDetailAppId(null)} />

      <PriceChartDialog
        open={chartItem !== null}
        onClose={() => setChartItem(null)}
        title={chartItem?.name ?? ""}
        points={chartItem?.points ?? []}
        currency={chartItem?.currency ?? null}
      />
    </div>
  );
}
