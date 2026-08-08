import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import Icon from "../ui/Icon";
import { formatPriceCents } from "../../lib/steamCommunity";
import type { PriceHistoryPoint } from "../../lib/steamCommunity";

interface PriceChartDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  points: PriceHistoryPoint[];
  currency: string | null;
}

type RangeValue = "6m" | "12m" | "all";

const W = 480;
const H = 220;
const PAD = { top: 16, right: 12, bottom: 26, left: 12 };
const RANGE_MS: Record<Exclude<RangeValue, "all">, number> = {
  "6m": 6 * 30 * 24 * 3600 * 1000,
  "12m": 12 * 30 * 24 * 3600 * 1000,
};

/**
 * Larger price-history chart shown when the wishlist sparkline is clicked.
 * Price line over time with a 6 months / 12 months / all date-range filter,
 * min/max guides, first/last date labels and a native tooltip per point.
 *
 * Must tolerate an empty `points` array: the parent clears the chart item as
 * soon as the dialog starts closing, so the fade-out animation still renders
 * with no data. The last opened data is kept during the fade so the panel
 * doesn't blank/collapse, and the chart still guards against empty input.
 */
export default function PriceChartDialog({
  open,
  onClose,
  title,
  points,
  currency,
}: PriceChartDialogProps) {
  const { t } = useTranslation();
  const [closing, setClosing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [range, setRange] = useState<RangeValue>("all");
  // Keep the last opened data while closing, so clearing `chartItem` in the
  // parent doesn't empty the chart mid-fade-out.
  const lastRef = useRef({ title, points, currency });

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      const timer = setTimeout(() => setMounted(false), 180);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!mounted) return null;

  if (open) lastRef.current = { title, points, currency };
  const { title: displayTitle, points: displayPoints, currency: displayCurrency } = lastRef.current;

  const rangeOptions = [
    { value: "6m" as const, label: t("steam.range6m", { defaultValue: "6个月" }) },
    { value: "12m" as const, label: t("steam.range12m", { defaultValue: "12个月" }) },
    { value: "all" as const, label: t("steam.rangeAll", { defaultValue: "全部" }) },
  ];

  // Apply the date-range filter (history dates are local "YYYY-MM-DD HH:MM:SS").
  let chartPoints = displayPoints;
  if (range !== "all") {
    const cutoff = Date.now() - RANGE_MS[range];
    chartPoints = displayPoints.filter((p) => {
      const time = Date.parse(p.date.replace(" ", "T"));
      return Number.isFinite(time) ? time >= cutoff : true;
    });
  }

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const prices = chartPoints.map((p) => p.finalPrice);
  const max = prices.length ? Math.max(...prices) : 0;
  const min = prices.length ? Math.min(...prices) : 0;
  const rangePrice = max - min || 1;
  const mid = min + rangePrice / 2;
  const x = (i: number) =>
    PAD.left + (chartPoints.length <= 1 ? innerW / 2 : (i / (chartPoints.length - 1)) * innerW);
  const y = (p: number) => PAD.top + innerH - ((p - min) / rangePrice) * innerH;
  const line = chartPoints
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.finalPrice).toFixed(1)}`)
    .join(" ");
  // Overlaid discount-rate curve on its own 0–100% scale.
  const discountY = (discount: number) =>
    PAD.top + innerH - (Math.max(0, Math.min(100, discount)) / 100) * innerH;
  const discountLine = chartPoints
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${discountY(p.discountPercent).toFixed(1)}`)
    .join(" ");
  const last = chartPoints.length > 0 ? chartPoints[chartPoints.length - 1] : null;
  const lowest = chartPoints.reduce(
    (acc, p, i) => (p.finalPrice < acc.price ? { price: p.finalPrice, index: i } : acc),
    { price: Number.POSITIVE_INFINITY, index: 0 },
  );
  const atLow = last ? last.finalPrice === lowest.price : false;

  const overlay = (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center soft-backdrop ${
        closing ? "animate-fade-out" : "animate-fade-in"
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`app-surface app-glass-floating relative w-[92vw] max-w-[520px] rounded-[20px] border border-border/50 p-5 shadow-xl ${
          closing ? "animate-fade-out" : "animate-scale-in"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex items-center justify-center rounded-full p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Icon name="close" size={18} />
        </button>

        <div className="pr-8">
          <div className="truncate text-sm font-bold">{displayTitle}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {last && formatPriceCents(last.finalPrice, displayCurrency)}
            {last && atLow && (
              <span className="text-green-600 dark:text-green-400">历史最低</span>
            )}
          </div>

          {/* Date-range selector + legend */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <div className="flex items-center gap-1">
              {rangeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRange(option.value)}
                  className={[
                    "rounded-full px-2 py-0.5 text-[11px] transition-colors",
                    range === option.value
                      ? "bg-primary/15 font-medium text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-3 rounded bg-primary" />
                {t("steam.priceChartPrice", { defaultValue: "价格" })}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-px w-3 border-t-2 border-dashed border-amber-500" />
                {t("steam.priceChartDiscount", { defaultValue: "折扣率" })}
              </span>
            </div>
          </div>
        </div>

        {chartPoints.length >= 2 ? (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="mt-3 w-full"
            role="img"
            aria-label="price history"
          >
            {/* Gridlines: max / mid / min */}
            {[max, mid, min].map((v) => (
              <g key={v}>
                <line
                  x1={PAD.left}
                  y1={y(v)}
                  x2={W - PAD.right}
                  y2={y(v)}
                  stroke="currentColor"
                  strokeOpacity={0.12}
                  strokeDasharray="3 4"
                />
                <text
                  x={W - PAD.right - 2}
                  y={y(v) - 3}
                  textAnchor="end"
                  className="fill-muted-foreground text-[9px]"
                >
                  {formatPriceCents(v, displayCurrency)}
                </text>
              </g>
            ))}

            {/* Line */}
            <path
              d={line}
              fill="none"
              stroke={atLow ? "#22c55e" : "hsl(var(--primary))"}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Discount-rate curve (overlaid, 0–100%) */}
            <path
              d={discountLine}
              fill="none"
              stroke="#f59e0b"
              strokeWidth={1.25}
              strokeDasharray="3 3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Lowest point marker */}
            <circle
              cx={x(lowest.index)}
              cy={y(lowest.price)}
              r={3.5}
              fill="#22c55e"
            />

            {/* Points with native tooltip */}
            {chartPoints.map((p, i) => (
              <circle
                key={i}
                cx={x(i)}
                cy={y(p.finalPrice)}
                r={2.5}
                fill="transparent"
                className="cursor-pointer"
              >
                <title>
                  {p.date}
                  {"\n"}
                  {formatPriceCents(p.finalPrice, displayCurrency)}
                  {p.discountPercent > 0 ? ` (-${p.discountPercent}%)` : ""}
                </title>
              </circle>
            ))}

            {/* Date labels */}
            <text x={PAD.left} y={H - 8} className="fill-muted-foreground text-[9px]">
              {chartPoints[0].date}
            </text>
            <text x={W - PAD.right} y={H - 8} textAnchor="end" className="fill-muted-foreground text-[9px]">
              {last?.date ?? ""}
            </text>
          </svg>
        ) : (
          <div className="py-10 text-center text-xs text-muted-foreground">
            {displayPoints.length >= 2
              ? t("steam.priceChartNoDataInRange", { defaultValue: "所选范围内数据不足" })
              : "—"}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
