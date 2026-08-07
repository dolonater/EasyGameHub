import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAnimation } from "../hooks/useAnimation";
import { useAppData } from "../hooks/useAppData";
import { formatRelativeTime, formatSize, formatTimestamp } from "../lib/types";
import Dialog from "./ui/Dialog";
import GlassCard from "./ui/GlassCard";
import StatCard from "./ui/StatCard";

function DonutRing({ percent, animate }: { percent: number; animate: boolean }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - percent / 100);

  return (
    <div className="relative flex h-28 w-28 items-center justify-center">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          className="text-primary transition-all duration-1000 ease-out"
          strokeDasharray={circ}
          strokeDashoffset={animate ? offset : circ}
          style={animate ? undefined : { strokeDashoffset: offset }}
        />
      </svg>
      <span className="relative text-lg font-bold tabular-nums">{Math.round(percent)}%</span>
    </div>
  );
}

function TimelineItem({ game, size, time, delay }: { game: string; size: string; time: string; delay: number }) {
  return (
    <div
      className="flex gap-3 items-start animate-timeline-slide-in opacity-0"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      <div className="flex flex-col items-center">
        <span className="mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-primary" />
      </div>
      <div className="min-w-0 flex-1 pb-3">
        <div className="truncate text-sm font-medium text-foreground">{game}</div>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>{size}</span>
          <span>{time}</span>
        </div>
      </div>
    </div>
  );
}

export default function OverviewDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const anim = useAnimation();
  const { stats, config, loading } = useAppData();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setMounted(true), 100);
    return () => {
      clearTimeout(timer);
      setMounted(false);
    };
  }, [open]);

  const maxBytes = config ? config.max_backup_size_gb * 1024 * 1024 * 1024 : 0;
  const usedBytes = stats?.total_size_bytes ?? 0;
  const usagePercent = maxBytes > 0 ? Math.min(100, (usedBytes / maxBytes) * 100) : usedBytes > 0 ? 100 : 0;
  const statCards = stats ? [
    { label: t("dashboard.protectedGames"), value: stats.protected_games, accent: "primary" as const },
    { label: t("dashboard.totalSnapshots"), value: stats.total_snapshots, accent: "accent" as const },
    { label: t("dashboard.totalSize"), value: stats.total_size_bytes, format: (v: number) => formatSize(v), accent: "emerald" as const },
    { label: t("dashboard.lastBackup"), value: stats.last_backup ? 1 : 0, format: () => stats.last_backup ? formatTimestamp(stats.last_backup) : "-", accent: "amber" as const },
  ] : [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("dashboard.title")}
      className="!w-[min(760px,calc(100vw-2rem))] !items-stretch max-h-[calc(100vh-4rem)] overflow-y-auto"
    >
      {loading || !stats || !config ? (
        <div className="py-8 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
      ) : (
        <div className="space-y-4 text-foreground">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {statCards.map((card, index) => (
              <StatCard
                key={card.label}
                label={card.label}
                value={card.value}
                format={card.format}
                accentColor={card.accent}
                animated={mounted && anim}
                className="hover:translate-y-0"
                style={anim ? { animationDelay: `${index * 60}ms`, animationFillMode: "both" } : undefined}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <GlassCard bordered={false} className="rounded-lg p-4 flex flex-col items-center shadow-sm">
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">{t("dashboard.storageUsage")}</h2>
              <DonutRing percent={usagePercent} animate={mounted && anim} />
              <span className="mt-2 text-xs text-muted-foreground">
                {formatSize(usedBytes)}
                {maxBytes > 0 ? ` / ${formatSize(maxBytes)}` : ` / ${t("dashboard.unlimited")}`}
              </span>
            </GlassCard>

            <GlassCard bordered={false} className="rounded-lg p-4 flex items-center gap-4 shadow-sm">
              <div className="relative">
                <span className={`inline-block h-4 w-4 rounded-full ${stats.is_watching ? "bg-green-500" : "bg-muted-foreground/40"}`} />
                {stats.is_watching && (
                  <span className="absolute inset-0 h-4 w-4 animate-ping rounded-full bg-green-500 opacity-30" />
                )}
              </div>
              <div>
                <div className="text-sm font-medium">
                  {stats.is_watching ? t("dashboard.watching") : t("dashboard.notWatching")}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {config.auto_backup ? t("settings.autoBackup") : t("wizard.autoBackupOff")}
                  {config.periodic_minutes > 0 && ` · ${t("settings.periodicBackup")}: ${config.periodic_minutes}min`}
                  {config.daily_backup_time && ` · ${t("settings.dailyBackupTime")}: ${config.daily_backup_time}`}
                </div>
              </div>
            </GlassCard>
          </div>

          <GlassCard bordered={false} className="rounded-lg p-4 shadow-sm">
            <h2 className="mb-4 text-sm font-medium">{t("dashboard.recentActivityTitle")}</h2>
            {stats.recent_activity.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("dashboard.noRecentActivity")}</p>
            ) : (
              <div className="border-l-2 border-muted pl-3">
                {stats.recent_activity.slice(0, 8).map((item, index) => (
                  <TimelineItem
                    key={`${item.game_name}-${item.timestamp}-${index}`}
                    game={item.game_name}
                    size={formatSize(item.size_bytes)}
                    time={formatRelativeTime(item.timestamp)}
                    delay={index * 60}
                  />
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      )}
    </Dialog>
  );
}
