import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { useAppData, type SteamGame } from "../hooks/useAppData";
import { useAnimation } from "../hooks/useAnimation";
import { useActiveTheme } from "../hooks/useThemeData";
import { useCountUp } from "../hooks/useCountUp";
import TabButtons from "../components/ui/TabButtons";
import SearchInput from "../components/ui/SearchInput";
import Button from "../components/ui/Button";
import GlassCard from "../components/ui/GlassCard";
import StatCard from "../components/ui/StatCard";
import Icon from "../components/ui/Icon";

// ── Library stats / completion DTOs (from steam_api commands) ──

interface TopGameDto {
  appid: number;
  name: string | null;
  minutes: number;
  iconUrl: string | null;
}

interface LibraryStatsDto {
  ownedCount: number;
  totalMinutes: number;
  avgMinutes: number;
  totalValueCents: number | null;
  valueCurrency: string | null;
  source: string;
  distribution: { label: string; games: number }[];
  topGames: TopGameDto[];
}

interface GameCompletionDto {
  appId: number;
  name: string | null;
  achieved: number;
  total: number;
  percent: number;
  source: "web" | "local" | "none";
}

// ── Helpers ────────────────────────────────────────────────────

function fmtHrs(secs: number) { return `${Math.floor(secs / 3600)}h`; }
function fmtMin(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

// ── Color generation from theme ─────────────────────────────────

function parseHslVar(raw: string | undefined): { h: number; s: number; l: number } {
  if (!raw) return { h: 215, s: 70, l: 45 };
  const parts = raw.trim().split(/\s+/);
  return { h: parseFloat(parts[0]) || 0, s: parseFloat(parts[1]) || 50, l: parseFloat(parts[2]) || 50 };
}

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const a = sNorm * Math.min(lNorm, 1 - lNorm);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return lNorm - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const toHex = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function generateChartColors(n: number, primaryHsl: string, accentHsl: string | undefined, mutedHsl: string | undefined): string[] {
  const base = parseHslVar(primaryHsl);
  const accent = parseHslVar(accentHsl);
  const sRef = accent.s;
  const lRef = Math.max(40, Math.min(65, base.l));
  const colors: string[] = [];
  const startH = base.h - 60;
  for (let i = 0; i < n; i++) {
    const h = ((startH + (360 / n) * i) % 360 + 360) % 360;
    const s = sRef - (i % 3) * 5;
    const l = lRef + (i % 2 === 0 ? 5 : -5);
    colors.push(hslToHex(h, Math.max(30, Math.min(100, s)), Math.max(25, Math.min(75, l))));
  }
  return colors;
}

// ── SVG Pie Chart ───────────────────────────────────────────────

function PieChart({ data, maxSlices, anim }: { data: { name: string; value: number; color: string }[]; maxSlices: number; anim: boolean }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const slices = data.slice(0, maxSlices);
  const other = data.slice(maxSlices).reduce((s, d) => s + d.value, 0);
  let angle = -90;
  const arcs = slices.map(d => {
    const sweep = (d.value / total) * 360;
    const start = angle; angle += sweep;
    return { ...d, start, sweep };
  });
  if (other > 0) arcs.push({ name: "Other", value: other, color: "#9ca3af", start: angle, sweep: (other / total) * 360 });

  function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
    const rad = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  }
  function arcPath(cx: number, cy: number, r: number, start: number, sweep: number): string {
    if (sweep >= 360) sweep = 359.9;
    const [x1, y1] = polar(cx, cy, r, start);
    const [x2, y2] = polar(cx, cy, r, start + sweep);
    const large = sweep > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
  }

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  return (
    <svg viewBox="0 0 200 200" className="w-full max-w-[280px] mx-auto">
      {arcs.map((d, i) => {
        const isHover = hoverIdx === i;
        const r = isHover ? 94 : 90;
        return (
          <path key={i} d={arcPath(100, 100, r, d.start, d.sweep)}
            fill={d.color} stroke="hsl(var(--card))" strokeWidth="1.5"
            className={`transition-all duration-150 cursor-pointer ${anim ? "animate-pie-reveal" : ""}`}
            style={{
              opacity: hoverIdx !== null && !isHover ? 0.6 : 1,
              animationDelay: anim ? `${i * 50}ms` : undefined,
              animationFillMode: "both",
            }}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}>
            <title>{d.name}: {fmtHrs(d.value)}</title>
          </path>
        );
      })}
    </svg>
  );
}

// ── Component ───────────────────────────────────────────────────

const PAGE_SIZE = 30;

export default function Playtime() {
  const { t } = useTranslation();
  const anim = useAnimation();
  const { cssVars } = useActiveTheme();
  const { steamGames: rawSteamGames, steamLoading, steamLoaded, ensureSteamGames } = useAppData();
  const steamGames = useMemo(() => rawSteamGames.filter(g => g.playtimeMinutes > 0), [rawSteamGames]);
  const [chartMode, setChartMode] = useState<"bar" | "pie" | "heatmap" | "list">("bar");
  const [sortKey, setSortKey] = useState<"time" | "name">("time");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [mounted, setMounted] = useState(false);

  // Account-level stats (value) + per-game achievement completion.
  const [stats, setStats] = useState<LibraryStatsDto | null>(null);
  const [completion, setCompletion] = useState<GameCompletionDto[] | null>(null);
  const [completionLoading, setCompletionLoading] = useState(false);

  const progressPalette = useMemo(
    () => generateChartColors(9, cssVars["--primary"], cssVars["--accent"], cssVars["--muted"]),
    [cssVars],
  );
  const piePalette = useMemo(
    () => generateChartColors(15, cssVars["--primary"], cssVars["--accent"], cssVars["--muted"]),
    [cssVars],
  );

  function progressColor(hours: number): string {
    if (hours < 5) return progressPalette[0];
    if (hours < 20) return progressPalette[1];
    if (hours < 50) return progressPalette[2];
    if (hours < 100) return progressPalette[3];
    if (hours < 200) return progressPalette[4];
    if (hours < 500) return progressPalette[5];
    if (hours < 1000) return progressPalette[6];
    if (hours < 2000) return progressPalette[7];
    return progressPalette[8];
  }

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    void ensureSteamGames();
  }, [ensureSteamGames]);

  useEffect(() => {
    void invoke<LibraryStatsDto>("get_library_stats").then(setStats).catch(() => setStats(null));
    setCompletionLoading(true);
    void invoke<GameCompletionDto[]>("get_library_completion", { limit: 50 })
      .then((list) => { setCompletion(list); setCompletionLoading(false); })
      .catch(() => { setCompletion(null); setCompletionLoading(false); });
  }, []);

  useEffect(() => { setPage(1); }, [search]);

  const totalSeconds = steamGames.reduce((s, g) => s + g.playtimeMinutes * 60, 0);
  const totalHours = totalSeconds / 3600;
  const maxHours = Math.max(1, ...steamGames.map(g => g.playtimeMinutes / 60));

  const filtered = useMemo(() =>
    [...steamGames]
      .filter(g => !search || (g.name || `App ${g.appId}`).toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) =>
        sortKey === "name"
          ? (a.name || "").localeCompare(b.name || "")
          : b.playtimeMinutes - a.playtimeMinutes
      ),
    [steamGames, search, sortKey],
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const pieData = [...steamGames]
    .sort((a, b) => b.playtimeMinutes - a.playtimeMinutes)
    .map((g, i) => ({
      name: g.name || `App ${g.appId}`,
      value: g.playtimeMinutes * 60,
      color: piePalette[i % piePalette.length],
    }));

  // Heatmap grid: prefer web-backed top games (covers non-installed games),
  // fall back to the locally known games.
  const heatmapGames: { appid: number; name: string; minutes: number }[] =
    stats?.topGames?.length
      ? stats.topGames.map((g) => ({ appid: g.appid, name: g.name || "", minutes: g.minutes }))
      : [...steamGames]
          .sort((a, b) => b.playtimeMinutes - a.playtimeMinutes)
          .slice(0, 48)
          .map((g) => ({ appid: g.appId, name: g.name || "", minutes: g.playtimeMinutes }));

  // Animated counts
  const animGames = useCountUp(mounted ? steamGames.length : steamGames.length, 600);
  const animHours = useCountUp(mounted ? Math.floor(totalHours) : Math.floor(totalHours), 600);
  const animAvg = useCountUp(mounted ? Math.floor(totalHours / Math.max(steamGames.length, 1)) : 0, 600);
  const animMax = useCountUp(mounted ? Math.floor(maxHours) : Math.floor(maxHours), 600);
  const valueYuan = stats?.totalValueCents != null ? Math.round(stats.totalValueCents / 100) : null;
  const animValue = useCountUp(mounted && valueYuan != null ? valueYuan : 0, 600);

  if (!steamLoaded || steamLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">{t("playtime.title")}</h1>
        <div className="text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }

  if (steamGames.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">{t("playtime.title")}</h1>
        <GlassCard bordered={false} className="text-center py-16 text-muted-foreground rounded-xl shadow-sm">
          <Icon name="chart" size={36} className="mx-auto mb-2 text-muted-foreground" />
          {"Steam playtime data not available"}
        </GlassCard>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("playtime.title")}</h1>

      {/* Overview cards — stagger + counting */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3 mb-6">
        {[
          { label: t("playtime.total"), value: animHours, format: (v: number) => `${v}h` },
          { label: t("playtime.games"), value: animGames, format: String },
          { label: t("playtime.avgPerGame"), value: animAvg, format: (v: number) => `${v}h` },
          { label: t("playtime.max"), value: animMax, format: (v: number) => `${v}h` },
          ...(valueYuan != null
            ? [{ label: t("playtime.totalValue"), value: animValue, format: (v: number) => `¥${v}` }]
            : []),
        ].map((card, i) => (
          <div key={i}
            className={anim ? "animate-fade-slide-up" : ""}
            style={anim ? { animationDelay: `${i * 80}ms`, animationFillMode: "both" } : undefined}
          >
            <StatCard label={card.label} value={card.value} format={card.format} accentColor={["primary", "accent", "emerald", "amber", "blue"][i]} animated={false} />
          </div>
        ))}
      </div>

      {/* Chart header */}
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-sm font-medium">Steam {t("playtime.title")} ({steamGames.length} games)</h2>
        <div className="ml-auto">
          <TabButtons
            name="playtime-chart"
            value={chartMode}
            size="sm"
            onChange={(v) => setChartMode(v as "bar" | "pie" | "heatmap" | "list")}
            options={[
              { value: "bar", label: <Icon name="chartLine" size={16} /> },
              { value: "pie", label: <Icon name="chart" size={16} /> },
              { value: "heatmap", label: <Icon name="grid" size={16} /> },
              { value: "list", label: <Icon name="list" size={16} /> },
            ]}
          />
        </div>
      </div>

      {/* Chart area */}
      {chartMode === "bar" ? (
        <GlassCard key={chartMode} bordered={false} className={`rounded-lg shadow-sm p-4 mb-6 min-h-[260px] flex flex-col justify-end ${anim ? "animate-fade-in" : ""}`}>
          <div className="flex items-end gap-0.5 h-[200px]">
            {[...steamGames].sort((a, b) => b.playtimeMinutes - a.playtimeMinutes).slice(0, 40).map((g, i) => {
              const hrs = g.playtimeMinutes / 60;
              const barH = maxHours > 0 ? Math.max((hrs / maxHours) * 196, hrs > 0 ? 4 : 1) : 1;
              return (
                <div key={g.appId} className="flex-1 flex flex-col justify-end items-center gap-0.5 min-w-0"
                  title={`${g.name || `App ${g.appId}`}: ${fmtMin(g.playtimeMinutes)}`}>
                  <div
                    className="w-full rounded-t hover:brightness-110 transition-all duration-150 cursor-pointer"
                    style={{
                      height: barH,
                      background: progressColor(hrs),
                      transformOrigin: "bottom",
                      animation: anim && mounted ? `barGrow 0.5s ease-out ${i * 30}ms both` : undefined,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </GlassCard>
      ) : chartMode === "pie" ? (
        <GlassCard key={chartMode} bordered={false} className={`rounded-lg shadow-sm p-4 mb-6 min-h-[260px] flex flex-col items-center justify-center ${anim ? "animate-fade-in" : ""}`}>
          <PieChart data={pieData} maxSlices={12} anim={!!(anim && mounted)} />
          <div className="flex flex-wrap gap-1.5 mt-3 justify-center">
            {pieData.slice(0, 12).map((d, i) => (
              <span key={i} className="text-[10px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                {d.name.length > 14 ? d.name.slice(0, 14) + "…" : d.name}
              </span>
            ))}
          </div>
        </GlassCard>
      ) : chartMode === "heatmap" ? (
        <GlassCard key={chartMode} bordered={false} className={`rounded-lg shadow-sm p-4 mb-6 ${anim ? "animate-fade-in" : ""}`}>
          <div className="flex flex-wrap gap-1">
            {heatmapGames.map((g) => {
              const hrs = g.minutes / 60;
              return (
                <div
                  key={g.appid}
                  className="h-3 w-3 rounded-[2px] transition-transform duration-150 hover:scale-125 cursor-default"
                  style={{ background: progressColor(hrs) }}
                  title={`${g.name || `App ${g.appid}`}: ${fmtMin(g.minutes)}`}
                />
              );
            })}
          </div>
          <div className="mt-3 text-[10px] text-muted-foreground">{t("playtime.heatmapHint")}</div>
        </GlassCard>
      ) : (
        /* ── List mode: search + sort + progress bars + pagination ── */
        <div key={chartMode} className={`mb-6 space-y-3 ${anim ? "animate-fade-in" : ""}`}>
          <div className="flex items-center gap-2">
            <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("games.search")} />
            <TabButtons
              name="playtime-sort"
              value={sortKey}
              size="xs"
              onChange={(v) => setSortKey(v as "time" | "name")}
              options={[
                { value: "time", label: "Time" },
                { value: "name", label: "Name" },
              ]}
            />
          </div>

          <GlassCard bordered={false} className="rounded-lg shadow-sm overflow-hidden">
            <div className="divide-y">
              {paged.map((g) => {
                const hrs = g.playtimeMinutes / 60;
                const pct = Math.min((hrs / maxHours) * 100, 100);
                const color = progressColor(hrs);
                return (
                  <div key={g.appId} className="px-4 py-3 hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium truncate max-w-[65%]">
                        {g.name || `App ${g.appId}`}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2 flex-shrink-0 tabular-nums">
                        {fmtMin(g.playtimeMinutes)}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.max(pct, 0.5)}%`, minWidth: pct > 0 ? 4 : 0, background: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page <= 1}>{t("games.firstPage")}</Button>
              <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1}>{t("games.prevPage")}</Button>
              <span className="text-xs text-muted-foreground px-2">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>{t("games.nextPage")}</Button>
              <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page >= totalPages}>{t("games.lastPage")}</Button>
            </div>
          )}
        </div>
      )}

      {/* Legend — Bar / Pie only */}
      {chartMode !== "list" && (
        <div className="flex flex-wrap gap-2 mt-2">
          {[
            ["0-5h", 0], ["5-20h", 1], ["20-50h", 2],
            ["50-100h", 3], ["100-200h", 4], ["200-500h", 5],
            ["500-1000h", 6], ["1000-2000h", 7], ["2000h+", 8],
          ].map(([label, idx]) => (
            <span key={label} className="text-[9px] text-muted-foreground flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: progressPalette[idx as number] }} /> {label}
            </span>
          ))}
        </div>
      )}

      {/* Achievement completion */}
      <GlassCard bordered={false} className="rounded-lg shadow-sm p-4 mb-6 mt-6">
        <h2 className="text-sm font-medium mb-3">{t("playtime.completionTitle")}</h2>
        {completionLoading ? (
          <div className="py-2 text-xs text-muted-foreground">{t("playtime.completionLoading")}</div>
        ) : !completion || completion.length === 0 ? (
          <div className="py-2 text-xs text-muted-foreground">{t("playtime.completionEmpty")}</div>
        ) : completion.every((c) => c.source === "none") ? (
          <div className="py-2 text-xs text-muted-foreground">{t("playtime.completionUnavailable")}</div>
        ) : (
          <div className="divide-y">
            {completion.filter((c) => c.source !== "none").slice(0, 30).map((c) => {
              const pct = Math.round(c.percent);
              return (
                <div key={c.appId} className="py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm truncate max-w-[70%]">{c.name || `App ${c.appId}`}</span>
                    <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0 ml-2">
                      {c.achieved}/{c.total} · {pct}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.max(pct, 0.5)}%`,
                        background: pct >= 100 ? "#22c55e" : "hsl(var(--primary))",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
