import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import Button from "../ui/Button";
import TextField from "../ui/TextField";
import Icon from "../ui/Icon";
import { glassMenuItemClass, GlassMenuPanel } from "../ui/GlassSurface";
import GameSearchBox from "./GameSearchBox";
import { showToast } from "../Notification";
import { patchSteamHubCache, useSteamHubCache } from "../../lib/steamHubCache";
import { formatPriceCents } from "../../lib/steamCommunity";
import type {
  MetadataDto,
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
type FilterMode = "all" | "discount" | "free" | "dropped";

const MENU_ITEM_CLASS = [
  `${glassMenuItemClass} flex w-full items-center gap-2 px-[7px] py-[3px] rounded-md text-sm font-semibold whitespace-nowrap`,
  "text-foreground/80 dark:text-muted-foreground",
  "hover:!text-primary-foreground",
  "hover:bg-primary",
  "hover:-translate-y-[1px]",
  "active:scale-[0.99]",
  "transition-all duration-300 ease-out",
  "[&_svg]:w-[17px] [&_svg]:h-[17px] [&_svg]:transition-all [&_svg]:duration-300 [&_svg]:ease-out",
  "[&_svg]:stroke-current",
].join(" ");

/** Small click-to-open menu used for the sort / filter dropdowns. */
function ChipDropdown({
  label,
  options,
  value,
  onSelect,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={rootRef} className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)} ripple={false}>
        <Icon name="chevronDown" size={12} />
        {label}:{current?.label}
      </Button>
      {open && (
        <GlassMenuPanel className="absolute right-0 top-full z-30 mt-1 w-max min-w-[7rem] rounded-[10px] border border-border px-[5px] py-[6px] flex flex-col gap-[3px] shadow-xl">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={MENU_ITEM_CLASS}
              onClick={() => {
                onSelect(o.value);
                setOpen(false);
              }}
            >
              {o.label}
              {o.value === value && <Icon name="check" size={14} className="ml-auto" />}
            </button>
          ))}
        </GlassMenuPanel>
      )}
    </div>
  );
}

/** Tiny inline price-history line, green when the current price is the low. */
function PriceSparkline({ points }: { points: PriceHistoryPoint[] }) {
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
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="flex-none text-muted-foreground/60">
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(points.length - 1)} cy={y(last.finalPrice)} r={1.8} fill={color} />
    </svg>
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
  const [thresholds, setThresholds] = useState<Record<number, number>>({});
  const [thresholdEditing, setThresholdEditing] = useState<number | null>(null);
  const [thresholdInput, setThresholdInput] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const [newAppId, setNewAppId] = useState("");
  const [newName, setNewName] = useState("");

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
  }, [combined, sort, filter, prices, metadata]);

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
                  {price && price.history.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <PriceSparkline points={price.history} />
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

                {item.source === "local" && (
                  <button
                    type="button"
                    onClick={() => void onRemoveWatch(item.appId)}
                    className="flex h-7 w-7 flex-none items-center justify-center self-start rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                    title={t("steam.wishlistRemove")}
                  >
                    <Icon name="close" size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
