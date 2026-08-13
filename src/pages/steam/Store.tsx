import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import GlassCard from "../../components/ui/GlassCard";
import GameBannerCard from "../../components/ui/GameBannerCard";
import Icon from "../../components/ui/Icon";
import Select from "../../components/ui/Select";
import TextField from "../../components/ui/TextField";
import Toggle from "../../components/ui/Toggle";
import StoreDetailDialog from "../../components/steam/StoreDetailDialog";
import { showToast } from "../../lib/toast";
import { useAnimation } from "../../hooks/useAnimation";
import { useSteamWatchlist } from "../../hooks/useSteamWatchlist";
import { patchSteamHubCache, useSteamHubCache } from "../../lib/steamHubCache";
import { browseSteamGames, capsuleImageUrl, getStoreHome, headerImageUrl } from "../../lib/steamStore";
import { formatPrice } from "../../lib/steamCommunity";
import type { BrowseItemDto, FeaturedRailDto, StoreHomeDto } from "../../lib/steamCommunity";

/** Fixed genre list (`category1` ids), labels via i18n. */
const GENRES: { id: number; i18n: string }[] = [
  { id: 19, i18n: "steam.storeGenreAction" },
  { id: 21, i18n: "steam.storeGenreAdventure" },
  { id: 23, i18n: "steam.storeGenreIndie" },
  { id: 24, i18n: "steam.storeGenreRpg" },
  { id: 25, i18n: "steam.storeGenreStrategy" },
  { id: 28, i18n: "steam.storeGenreCasual" },
  { id: 29, i18n: "steam.storeGenreSimulation" },
  { id: 30, i18n: "steam.storeGenreSports" },
  { id: 31, i18n: "steam.storeGenreRacing" },
  { id: 32, i18n: "steam.storeGenreMmo" },
  { id: 38, i18n: "steam.storeGenreHorror" },
  { id: 998, i18n: "steam.storeGenreFreeToPlay" },
];

/** Sort options (`sort_by` whitelist). */
const SORTS: { value: string; i18n: string }[] = [
  { value: "relevance", i18n: "steam.storeSortRelevance" },
  { value: "Price_ASC", i18n: "steam.storeSortPriceAsc" },
  { value: "Price_DESC", i18n: "steam.storeSortPriceDesc" },
  { value: "Reviews_DESC", i18n: "steam.storeSortReviewsDesc" },
  { value: "Released_DESC", i18n: "steam.storeSortReleasedDesc" },
];

/** Region switcher (same set as the multi-region price dialog). */
const REGIONS: { value: string; i18n: string }[] = [
  { value: "cn", i18n: "steam.storeRegionCn" },
  { value: "us", i18n: "steam.storeRegionUs" },
  { value: "jp", i18n: "steam.storeRegionJp" },
  { value: "kr", i18n: "steam.storeRegionKr" },
  { value: "de", i18n: "steam.storeRegionDe" },
  { value: "gb", i18n: "steam.storeRegionGb" },
  { value: "au", i18n: "steam.storeRegionAu" },
  { value: "hk", i18n: "steam.storeRegionHk" },
];

/** Rail id → i18n key; falls back to the backend-provided name. */
function railTitleKey(id: string): string | null {
  switch (id) {
    case "specials":
      return "steam.storeRailSpecials";
    case "coming_soon":
      return "steam.storeRailComingSoon";
    case "top_sellers":
      return "steam.storeRailTopSellers";
    case "new_releases":
      return "steam.storeRailNewReleases";
    default:
      return null;
  }
}

/** Discount badge + price line shared by rail/grid cards. */
function PriceInfo({ item }: { item: BrowseItemDto }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2">
      {item.discountPercent != null && item.discountPercent > 0 && (
        <span className="rounded bg-green-600 px-1.5 py-0.5 text-[11px] font-bold text-white flex-shrink-0">
          -{item.discountPercent}%
        </span>
      )}
      <span className="text-xs text-foreground/80">
        {item.finalPrice != null
          ? formatPrice(item.finalPrice, item.currency)
          : t("steam.storeNoPrice")}
      </span>
      {item.initialPrice != null &&
        item.discountPercent != null &&
        item.discountPercent > 0 && (
          <span className="text-[11px] text-muted-foreground line-through">
            {formatPrice(item.initialPrice, item.currency)}
          </span>
        )}
    </div>
  );
}

/** Card used by rail rows (fixed width via parent) and the browse grid. */
function StoreItemCard({
  item,
  onClick,
  followed,
  onToggleWatch,
}: {
  item: BrowseItemDto;
  onClick?: () => void;
  followed?: boolean;
  onToggleWatch?: () => void;
}) {
  const { t } = useTranslation();
  const [stage, setStage] = useState(0);
  const [loaded, setLoaded] = useState(false);
  // Derived capsule URL first (sharp), then the API-provided URL (real, works
  // for games on Steam's new asset system), then the header CDN URL.
  const sources = [
    capsuleImageUrl(item.appId),
    item.tinyImage,
    headerImageUrl(item.appId),
  ].filter((s): s is string => !!s);
  const failed = stage >= sources.length;
  const hasPlatforms =
    item.platforms != null &&
    (item.platforms.windows || item.platforms.mac || item.platforms.linux);
  return (
    <div
      onClick={onClick}
      className={`rounded-lg overflow-hidden app-surface border border-foreground/10 ${
        onClick ? "cursor-pointer transition-all hover:ring-2 hover:ring-primary/40" : ""
      }`}
    >
      <div className="relative aspect-[616/353] bg-secondary/20">
        {!failed ? (
          <img
            src={sources[stage]}
            alt={item.name}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => {
              if (stage < sources.length - 1) setStage(stage + 1);
              else setStage(sources.length);
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
            <Icon name="steamInventory" size={24} />
          </div>
        )}
        {onToggleWatch && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleWatch();
            }}
            className={[
              "absolute right-2 top-2 rounded px-2 py-0.5 text-[11px] font-medium border backdrop-blur-sm transition-colors",
              followed
                ? "bg-primary/85 text-primary-foreground border-primary/40"
                : "bg-black/45 text-white border-white/25 hover:bg-black/65",
            ].join(" ")}
          >
            {followed ? t("steam.storeFollowed") : t("steam.storeFollow")}
          </button>
        )}
      </div>
      <div className="p-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate min-w-0 flex-1">{item.name}</span>
          {item.metacriticScore != null && (
            <span className="flex-none rounded bg-green-700 px-1 text-[10px] font-bold text-white">
              {item.metacriticScore}
            </span>
          )}
        </div>
        {hasPlatforms && (
          <div className="mt-1 flex items-center gap-1 text-muted-foreground">
            {item.platforms!.windows && <Icon name="windows" size={12} />}
            {item.platforms!.mac && <Icon name="apple" size={12} />}
            {item.platforms!.linux && <Icon name="linux" size={12} />}
          </div>
        )}
        <div className="mt-1">
          <PriceInfo item={item} />
        </div>
      </div>
    </div>
  );
}

/** A horizontal scrollable rail with a title. */
function RailRow({
  title,
  items,
  followedIds,
  onOpenDetail,
  onToggleWatch,
}: {
  title: string;
  items: BrowseItemDto[];
  followedIds: Set<number>;
  onOpenDetail: (appId: number) => void;
  onToggleWatch: (item: BrowseItemDto) => void;
}) {
  return (
    <section>
      <h2 className="mb-2 text-base font-semibold">{title}</h2>
      <div className="flex gap-3 overflow-x-auto app-scrollbar pb-2 -mb-2">
        {items.map((item) => (
          <div key={item.appId} className="flex-none w-64">
            <StoreItemCard
              item={item}
              onClick={() => onOpenDetail(item.appId)}
              followed={followedIds.has(item.appId)}
              onToggleWatch={() => onToggleWatch(item)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function RailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-2 h-5 w-32 rounded bg-foreground/10" />
      <div className="flex gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex-none w-64 h-28 rounded-lg bg-foreground/10" />
        ))}
      </div>
    </div>
  );
}

/**
 * Steam store browsing page — two views:
 * - home: featured rail + curated rails (shown when no filter is active)
 * - grid: single-row toolbar (search / genre / sort / specials / region)
 *   + a filterable browse grid with "load more" pagination.
 */
export default function Store() {
  const { t } = useTranslation();
  const anim = useAnimation();

  // ── Watch state (shared with Steam Hub, optimistic toggles) ──
  const { watchItems } = useSteamHubCache();
  const watch = useSteamWatchlist();
  const watchedIds = useMemo(
    () => new Set(watchItems.map((w) => w.appId)),
    [watchItems]
  );
  const [detailAppId, setDetailAppId] = useState<number | null>(null);

  const toggleWatch = useCallback(
    async (item: BrowseItemDto) => {
      const followed = watchedIds.has(item.appId);
      const prev = watchItems;
      patchSteamHubCache({
        watchItems: followed
          ? prev.filter((w) => w.appId !== item.appId)
          : [
              ...prev,
              { appId: item.appId, name: item.name, addedAt: new Date().toISOString() },
            ],
      });
      try {
        if (followed) {
          await watch.remove(item.appId);
        } else {
          await watch.add(item.appId, item.name);
        }
      } catch {
        patchSteamHubCache({ watchItems: prev });
        showToast("error", t("steam.storeFollowFailed"));
      }
    },
    [watch, watchItems, watchedIds, t]
  );

  // ── Home state ───────────────────────────────────────────
  const [home, setHome] = useState<StoreHomeDto | null>(null);
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeError, setHomeError] = useState<string | null>(null);

  // ── Toolbar state ────────────────────────────────────────
  const [term, setTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("relevance");
  const [specials, setSpecials] = useState(false);
  const [region, setRegion] = useState("cn");

  // ── Grid state ───────────────────────────────────────────
  const [items, setItems] = useState<BrowseItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [gridLoading, setGridLoading] = useState(false);
  const [gridError, setGridError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  /** True once any non-default filter is active → browse grid view. */
  const browsing =
    debouncedTerm.trim() !== "" ||
    category !== "" ||
    sort !== "relevance" ||
    specials;

  // Debounced search term (350 ms, matching GameSearchBox).
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedTerm(term), 350);
    return () => window.clearTimeout(id);
  }, [term]);

  const loadHome = useCallback(async () => {
    setHomeLoading(true);
    setHomeError(null);
    try {
      setHome(await getStoreHome());
    } catch (e) {
      setHomeError(e instanceof Error ? e.message : String(e));
    } finally {
      setHomeLoading(false);
    }
  }, []);

  // Home only loads when no filter is active (region stays cn on home).
  useEffect(() => {
    if (browsing) return;
    void loadHome();
  }, [browsing, loadHome]);

  // ── Browse grid ──────────────────────────────────────────
  // Guards stale responses when filters change mid-request.
  const requestIdRef = useRef(0);

  const loadFirstPage = useCallback(async () => {
    const id = ++requestIdRef.current;
    setGridLoading(true);
    setGridError(null);
    setLoadingMore(false);
    try {
      const result = await browseSteamGames({
        term: debouncedTerm.trim() || undefined,
        category: category ? Number(category) : undefined,
        sort,
        specials,
        cc: region,
        start: 0,
      });
      if (id !== requestIdRef.current) return;
      setItems(result.items);
      setTotal(result.total);
    } catch (e) {
      if (id !== requestIdRef.current) return;
      setGridError(e instanceof Error ? e.message : String(e));
    } finally {
      if (id === requestIdRef.current) setGridLoading(false);
    }
  }, [debouncedTerm, category, sort, specials, region]);

  // Any filter change resets to the first page.
  useEffect(() => {
    if (!browsing) return;
    void loadFirstPage();
  }, [browsing, loadFirstPage]);

  const loadMore = useCallback(async () => {
    const id = ++requestIdRef.current;
    setLoadingMore(true);
    try {
      const result = await browseSteamGames({
        term: debouncedTerm.trim() || undefined,
        category: category ? Number(category) : undefined,
        sort,
        specials,
        cc: region,
        start: items.length,
      });
      if (id !== requestIdRef.current) return;
      setItems((prev) => [...prev, ...result.items]);
      setTotal(result.total);
    } catch {
      // Keep the button clickable so the user can retry.
    } finally {
      if (id === requestIdRef.current) setLoadingMore(false);
    }
  }, [debouncedTerm, category, sort, specials, region, items.length]);

  const featured = home?.featured ?? [];
  const rails = home?.rails ?? [];
  const loadedAll = total > 0 && items.length >= total;

  return (
    <div className="space-y-4">
      <GlassCard className="p-4">
        <h1 className="text-xl font-bold">{t("steam.storePageTitle")}</h1>
      </GlassCard>

      {browsing ? (
        <>
          {/* ── Toolbar ── */}
          <GlassCard className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <TextField
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder={t("steam.storeSearchPlaceholder")}
                className="min-w-[200px] flex-1"
              />
              <Select
                name="store-category"
                value={category}
                onChange={setCategory}
                options={[
                  { value: "", label: t("steam.storeCategoryAll") },
                  ...GENRES.map((g) => ({ value: String(g.id), label: t(g.i18n) })),
                ]}
              />
              <Select
                name="store-sort"
                value={sort}
                onChange={setSort}
                options={SORTS.map((s) => ({ value: s.value, label: t(s.i18n) }))}
              />
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Toggle on={specials} onChange={setSpecials} id="store-specials" />
                {t("steam.storeSpecialsOnly")}
              </label>
              <Select
                name="store-region"
                value={region}
                onChange={setRegion}
                options={REGIONS.map((r) => ({ value: r.value, label: t(r.i18n) }))}
              />
            </div>
          </GlassCard>

          {/* ── Grid ── */}
          {gridLoading ? (
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(210px,1fr))]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse h-36 rounded-lg bg-foreground/10" />
              ))}
            </div>
          ) : gridError ? (
            <GlassCard className="p-8 flex flex-col items-center gap-3 text-center">
              <Icon name="warning" size={28} className="text-muted-foreground" />
              <p className="text-muted-foreground">{t("steam.storeError")}</p>
              {gridError && (
                <p className="max-w-full break-all text-xs text-muted-foreground/60">{gridError}</p>
              )}
              <button
                type="button"
                onClick={() => void loadFirstPage()}
                className="app-surface app-glass-button px-4 py-1.5 text-sm border rounded-lg hover:bg-secondary"
              >
                {t("steam.storeRetry")}
              </button>
            </GlassCard>
          ) : total === 0 ? (
            <GlassCard className="p-8 text-center text-muted-foreground">
              {t("steam.storeEmpty")}
            </GlassCard>
          ) : (
            <div className={`space-y-4 ${anim ? "animate-fade-slide-up" : ""}`}>
              <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(210px,1fr))]">
                {items.map((item) => (
                  <StoreItemCard
                    key={item.appId}
                    item={item}
                    onClick={() => setDetailAppId(item.appId)}
                    followed={watchedIds.has(item.appId)}
                    onToggleWatch={() => void toggleWatch(item)}
                  />
                ))}
              </div>
              {loadedAll ? (
                <p className="text-center text-xs text-muted-foreground">
                  {t("steam.storeLoadedAll")}
                </p>
              ) : (
                <div className="flex justify-center">
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={() => void loadMore()}
                    className="app-surface app-glass-button px-5 py-2 text-sm border rounded-lg hover:bg-secondary disabled:opacity-60"
                  >
                    {loadingMore ? t("steam.storeLoadMore") + "…" : t("steam.storeLoadMore")}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      ) : homeLoading ? (
        <div className="space-y-6">
          <div className="animate-pulse h-40 rounded-lg bg-foreground/10" />
          <RailSkeleton />
          <RailSkeleton />
        </div>
      ) : homeError ? (
        <GlassCard className="p-8 flex flex-col items-center gap-3 text-center">
          <Icon name="warning" size={28} className="text-muted-foreground" />
          <p className="text-muted-foreground">{t("steam.storeError")}</p>
          {homeError && (
            <p className="max-w-full break-all text-xs text-muted-foreground/60">{homeError}</p>
          )}
          <button
            type="button"
            onClick={() => void loadHome()}
            className="app-surface app-glass-button px-4 py-1.5 text-sm border rounded-lg hover:bg-secondary"
          >
            {t("steam.storeRetry")}
          </button>
        </GlassCard>
      ) : (
        <div className={`space-y-6 ${anim ? "animate-fade-slide-up" : ""}`}>
          {featured.length > 0 && (
            <section>
              <h2 className="mb-2 text-base font-semibold">
                {t("steam.storeRailFeatured")}
              </h2>
              <div className="flex gap-3 overflow-x-auto app-scrollbar pb-2 -mb-2">
                {featured.map((item) => (
                  <div key={item.appId} className="flex-none w-96">
                    <GameBannerCard
                      appId={item.appId}
                      name={item.name}
                      imageUrl={item.tinyImage || undefined}
                      badges={
                        item.discountPercent != null && item.discountPercent > 0
                          ? [{ label: `-${item.discountPercent}%`, color: "green" }]
                          : undefined
                      }
                      rightContent={<PriceInfo item={item} />}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {rails.map((rail: FeaturedRailDto) => {
            const title =
              railTitleKey(rail.id) != null
                ? t(railTitleKey(rail.id) as string)
                : rail.name ?? rail.id;
            return (
              <RailRow
                key={rail.id}
                title={title}
                items={rail.items}
                followedIds={watchedIds}
                onOpenDetail={setDetailAppId}
                onToggleWatch={(item) => void toggleWatch(item)}
              />
            );
          })}
        </div>
      )}

      <StoreDetailDialog appId={detailAppId} onClose={() => setDetailAppId(null)} />
    </div>
  );
}
