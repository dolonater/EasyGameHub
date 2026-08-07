import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import Button from "../ui/Button";
import TextField from "../ui/TextField";
import Icon from "../ui/Icon";
import { showToast } from "../Notification";
import type {
  MetadataDto,
  PriceDto,
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

const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: "¥",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  RUB: "₽",
  KRW: "₩",
  CAD: "C$",
  AUD: "A$",
  BRL: "R$",
  HKD: "HK$",
  TWD: "NT$",
};

/**
 * 愿望单 tab: public Steam wishlist merged with the local watchlist, showing
 * live prices, discount badges and drop detection. Falls back to the local
 * list when the wishlist is private or the user is not logged in.
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
  const [prices, setPrices] = useState<Record<number, PriceDto>>({});
  const [metadata, setMetadata] = useState<Record<number, MetadataDto>>({});
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">("idle");
  const [refreshKey, setRefreshKey] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [newAppId, setNewAppId] = useState("");
  const [newName, setNewName] = useState("");
  const toasted = useRef(new Set<number>());

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
    return Array.from(map.values()).sort((a, b) => a.appId - b.appId);
  }, [wishItems, watchItems]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (combined.length === 0) {
        setPrices({});
        setMetadata({});
        return;
      }
      setLoadState("loading");
      try {
        const appIds = combined.map((c) => c.appId);
        const [priceList, metaList] = await Promise.all([
          invoke<PriceDto[]>("get_steam_prices", { appIds }),
          invoke<MetadataDto[]>("get_steam_metadata", { appIds }),
        ]);
        if (cancelled) return;
        setPrices(Object.fromEntries(priceList.map((p) => [p.appId, p])));
        setMetadata(Object.fromEntries(metaList.map((m) => [m.appId, m])));
        setLoadState("idle");

        // Toast newly-detected drops once per price-drop event.
        const dropped = priceList.filter((p) => p.dropped && !toasted.current.has(p.appId));
        if (dropped.length > 0) {
          dropped.forEach((p) => toasted.current.add(p.appId));
          showToast("info", t("steam.priceDropToast", { defaultValue: "{{count}} 款关注游戏降价", count: dropped.length }));
        }
      } catch {
        if (!cancelled) setLoadState("error");
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [combined, refreshKey, t]);

  const handleAdd = async () => {
    const appId = Number(newAppId);
    if (!appId) return;
    await onAddWatch(appId, newName || undefined);
    setNewAppId("");
    setNewName("");
    setAddOpen(false);
  };

  const fmtPrice = (cents: number, currency: string | null) => {
    const symbol = currency ? CURRENCY_SYMBOLS[currency] || `${currency} ` : "";
    return `${symbol}${(cents / 100).toFixed(2)}`;
  };

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

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {t("steam.wishlistSummary", { defaultValue: "共 {{count}} 款", count: combined.length })}
        </div>
        <div className="flex items-center gap-2">
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

      {/* Add-watch form */}
      {addOpen && (
        <div className="app-surface app-glass-card rounded-[var(--radius)] border border-border/40 p-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[120px] flex-1">
            <label className="block text-xs text-muted-foreground mb-1">{t("steam.newsAppId")}</label>
            <TextField type="number" value={newAppId} onChange={(e) => setNewAppId(e.target.value)} placeholder="730" />
          </div>
          <div className="min-w-[140px] flex-1">
            <label className="block text-xs text-muted-foreground mb-1">{t("steam.newsNameOptional")}</label>
            <TextField value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("steam.newsNameOptional")} />
          </div>
          <Button size="sm" onClick={() => void handleAdd()} ripple={false}>
            {t("steam.newsAdd")}
          </Button>
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

      {/* Cards */}
      {loadState !== "loading" && combined.length > 0 && (
        <div className="space-y-2">
          {combined.map((item) => {
            const meta = metadata[item.appId];
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
