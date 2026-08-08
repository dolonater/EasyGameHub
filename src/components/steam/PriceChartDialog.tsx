import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

const W = 480;
const H = 220;
const PAD = { top: 16, right: 12, bottom: 26, left: 12 };

/**
 * Larger price-history chart shown when the wishlist sparkline is clicked.
 * Price line over time, with min/max guides, first/last date labels and a
 * native tooltip (hover) per point.
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
  const [closing, setClosing] = useState(false);
  const [mounted, setMounted] = useState(false);
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

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const prices = displayPoints.map((p) => p.finalPrice);
  const max = prices.length ? Math.max(...prices) : 0;
  const min = prices.length ? Math.min(...prices) : 0;
  const range = max - min || 1;
  const mid = min + range / 2;
  const x = (i: number) =>
    PAD.left + (displayPoints.length <= 1 ? innerW / 2 : (i / (displayPoints.length - 1)) * innerW);
  const y = (p: number) => PAD.top + innerH - ((p - min) / range) * innerH;
  const line = displayPoints
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.finalPrice).toFixed(1)}`)
    .join(" ");
  const last = displayPoints.length > 0 ? displayPoints[displayPoints.length - 1] : null;
  const lowest = displayPoints.reduce(
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
          <div className="mt-0.5 text-xs text-muted-foreground">
            {last && formatPriceCents(last.finalPrice, displayCurrency)}
            {last && atLow && (
              <span className="ml-1 text-green-600 dark:text-green-400">历史最低</span>
            )}
          </div>
        </div>

        {displayPoints.length > 0 ? (
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

            {/* Lowest point marker */}
            <circle
              cx={x(lowest.index)}
              cy={y(lowest.price)}
              r={3.5}
              fill="#22c55e"
            />

            {/* Points with native tooltip */}
            {displayPoints.map((p, i) => (
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
              {displayPoints[0].date}
            </text>
            <text x={W - PAD.right} y={H - 8} textAnchor="end" className="fill-muted-foreground text-[9px]">
              {last?.date ?? ""}
            </text>
          </svg>
        ) : (
          <div className="py-10 text-center text-xs text-muted-foreground">—</div>
        )}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
