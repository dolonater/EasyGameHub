import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import Dialog from "../ui/Dialog";
import Icon from "../ui/Icon";
import Button from "../ui/Button";
import { formatPriceCents } from "../../lib/steamCommunity";
import type { RegionPriceDto, StoreDetailDto } from "../../lib/steamCommunity";

interface StoreDetailDialogProps {
  appId: number | null;
  onClose: () => void;
}

/** Collapse Steam store HTML (tags, entities) into readable text. */
function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

/**
 * Store detail dialog: header image, meta, short description, a multi-region
 * price comparison table, screenshots, DLC list, requirements and a link to
 * the store page. Opened from the wishlist / store-search results.
 */
export default function StoreDetailDialog({ appId, onClose }: StoreDetailDialogProps) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<StoreDetailDto | null>(null);
  const [regions, setRegions] = useState<RegionPriceDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shot, setShot] = useState<number | null>(null);

  useEffect(() => {
    if (appId == null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    setRegions([]);
    setShot(null);
    (async () => {
      try {
        const [d, r] = await Promise.all([
          invoke<StoreDetailDto>("get_store_detail", { appId }),
          invoke<RegionPriceDto[]>("get_multi_region_price", { appId }),
        ]);
        if (!cancelled) {
          setDetail(d);
          setRegions(r);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appId]);

  const shots = detail?.screenshots ?? [];
  const activeShot = shots[shot ?? 0];

  const openStore = () => {
    if (detail) {
      void invoke("open_url", { url: `https://store.steampowered.com/app/${detail.appId}` });
    }
  };

  return (
    <Dialog
      open={!!appId}
      onClose={onClose}
      size="lg"
      title={detail?.name || t("steam.storeDetail")}
    >
      <div className="space-y-4">
        {loading && (
          <div className="py-10 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
        )}
        {error && <div className="py-6 text-center text-sm text-red-500">{error}</div>}

        {detail && (
          <>
            {detail.headerImage && (
              <img src={detail.headerImage} alt="" className="w-full rounded-xl object-cover" />
            )}

            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              {detail.genres.map((g) => (
                <span key={g} className="rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">
                  {g}
                </span>
              ))}
              {detail.isFree && (
                <span className="rounded-full bg-green-500/15 px-2 py-0.5 font-medium text-green-600 dark:text-green-400">
                  {t("steam.storeFree")}
                </span>
              )}
              {detail.metacritic && (
                <a
                  href={detail.metacritic.url || undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-[#66cc33]/15 px-2 py-0.5 font-semibold text-[#66cc33] hover:opacity-80"
                >
                  Metacritic {detail.metacritic.score}
                </a>
              )}
              {detail.recommendationsTotal != null && (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">
                  {t("steam.storeReviews", { defaultValue: "评价" })} {detail.recommendationsTotal}
                </span>
              )}
              {detail.releaseDate && (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">
                  {t("steam.storeReleased")}: {detail.releaseDate}
                </span>
              )}
            </div>

            {detail.shortDescription && (
              <p className="text-sm leading-relaxed text-muted-foreground">{detail.shortDescription}</p>
            )}

            {(detail.price || regions.length > 0) && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">{t("steam.storeRegions")}</h3>
                <div className="overflow-hidden rounded-lg border border-border/50">
                  {regions.map((r, i) => (
                    <div
                      key={r.cc}
                      className={`flex items-center gap-3 px-3 py-2 text-sm ${i % 2 ? "bg-secondary/30" : ""}`}
                    >
                      <span className="w-12 flex-none text-xs text-muted-foreground">{r.cc.toUpperCase()}</span>
                      {r.finalFormatted ? (
                        <>
                          <span className="min-w-0 flex-1 truncate font-medium">{r.finalFormatted}</span>
                          {r.initialCents != null && r.finalCents != null && r.initialCents > r.finalCents && (
                            <span className="flex-none text-xs text-muted-foreground line-through">
                              {r.initialFormatted}
                            </span>
                          )}
                          {r.discountPercent > 0 && (
                            <span className="flex-none rounded bg-[#4c6b22] px-1.5 py-0.5 text-[11px] font-semibold text-white">
                              -{r.discountPercent}%
                            </span>
                          )}
                          {r.cnyCents != null && (
                            <span className="flex-none text-xs text-muted-foreground">
                              ≈ {formatPriceCents(r.cnyCents, "CNY")}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {shots.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">{t("steam.storeScreenshots")}</h3>
                {activeShot?.pathFull && (
                  <img src={activeShot.pathFull} alt="" className="mb-2 w-full rounded-lg border border-border/40" />
                )}
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {shots.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setShot(i)}
                      className={`h-12 w-20 flex-none overflow-hidden rounded border transition-opacity ${
                        i === shot ? "border-primary opacity-100" : "border-transparent opacity-70 hover:opacity-100"
                      }`}
                    >
                      {s.pathThumbnail && <img src={s.pathThumbnail} alt="" className="h-full w-full object-cover" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {detail.dlc.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">{t("steam.storeDlc")}</h3>
                <div className="space-y-1">
                  {detail.dlc.map((d) => (
                    <div key={d.appId} className="flex items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">{d.name || `App ${d.appId}`}</span>
                      {d.finalFormatted && (
                        <span className="flex-none text-xs text-muted-foreground">{d.finalFormatted}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detail.pcRequirements &&
              (detail.pcRequirements.minimum || detail.pcRequirements.recommended) && (
                <div>
                  <h3 className="mb-1 text-sm font-semibold">{t("steam.storeRequirements")}</h3>
                  {detail.pcRequirements.minimum && (
                    <p className="text-xs leading-relaxed whitespace-pre-line text-muted-foreground">
                      {t("steam.storeMinimum", { defaultValue: "最低" })}: {stripHtml(detail.pcRequirements.minimum)}
                    </p>
                  )}
                  {detail.pcRequirements.recommended && (
                    <p className="mt-1 text-xs leading-relaxed whitespace-pre-line text-muted-foreground">
                      {t("steam.storeRecommended", { defaultValue: "推荐" })}: {stripHtml(detail.pcRequirements.recommended)}
                    </p>
                  )}
                </div>
              )}

            {detail.supportedLanguages && (
              <p className="text-xs text-muted-foreground">
                {t("steam.storeLanguages")}: {detail.supportedLanguages}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={openStore}>
                <Icon name="externalLink" size={14} />
                {t("steam.storeOpen")}
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
