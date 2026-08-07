import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import Button from "./ui/Button";
import GlassCard from "./ui/GlassCard";
import { GlassFloating } from "./ui/GlassSurface";
import Icon from "./ui/Icon";
import Select from "./ui/Select";
import TabButtons from "./ui/TabButtons";

interface AchievementItem {
  name: string;
  displayName: string;
  description: string | null;
  hidden: boolean;
  icon: string | null;
  iconGray: string | null;
  achieved: boolean;
  unlockTime: number;
}

interface AchievementsData {
  percentage: string;
  total: number;
  unlocked: number;
  achievements: AchievementItem[];
  liveStateAvailable?: boolean;
  liveStateError?: string | null;
  hasAchievements?: boolean;
}

const achievementsCache = new Map<string, AchievementsData | null>();

function formatUnlockTime(timestamp: number): string {
  if (!timestamp) return "—";
  return new Date(timestamp * 1000).toLocaleString();
}

interface AchievementsDialogProps {
  open: boolean;
  appId: number | null;
  gameName?: string | null;
  onClose: () => void;
}

export default function AchievementsDialog({
  open,
  appId,
  gameName,
  onClose,
}: AchievementsDialogProps) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [filter, setFilter] = useState<"all" | "unlocked" | "locked">("all");
  const [sort, setSort] = useState<"default" | "name" | "recent">("default");
  const [data, setData] = useState<AchievementsData | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      setFilter("all");
      setSort("default");
    } else if (mounted) {
      setClosing(true);
      const timer = setTimeout(() => setMounted(false), 180);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mounted]);

  useEffect(() => {
    if (!open || !appId) return;

    const cacheKey = `${appId}:${filter}:${sort}`;
    const cached = achievementsCache.get(cacheKey);
    if (cached !== undefined) {
      setData(cached);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setData(undefined);

    invoke<AchievementsData>("get_game_achievements", { appId, filter, sort })
      .then((result) => {
        if (!active) return;
        achievementsCache.set(cacheKey, result);
        setData(result);
      })
      .catch(() => {
        if (!active) return;
        achievementsCache.set(cacheKey, null);
        setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, appId, filter, sort]);

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => onClose(), 150);
  };

  if (!mounted || !appId) return null;

  const resolvedName = gameName || `App ${appId}`;
  const achievements = data?.achievements || [];

  const dialog = (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center px-4 py-6 soft-backdrop ${
        closing ? "animate-fade-out" : "animate-fade-in"
      }`}
      onClick={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <GlassFloating
        className={`relative flex w-[min(1100px,calc(100vw-32px))] max-h-[88vh] flex-col overflow-hidden rounded-[24px] p-0 shadow-[20px_20px_30px_rgba(0,0,0,0.068)] ${
          closing ? "animate-fade-out" : "animate-scale-in"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
          aria-label={t("common.close", { defaultValue: "关闭" })}
        >
          <Icon name="close" size={18} className="text-current" />
        </button>

        <div className="border-b border-border/60 px-5 py-4 pr-16">
          <div className="space-y-3">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">{t("steamAchievements.title", { defaultValue: "Steam 成就" })}</div>
              <div className="mt-1 flex min-w-0 items-center gap-2">
                <Icon name="trophy" size={18} className="text-primary" />
                <h2 className="truncate text-lg font-semibold">{resolvedName}</h2>
                <span className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                  App {appId}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <TabButtons
                name="achievements-filter"
                value={filter}
                size="sm"
                onChange={(value) => setFilter(value as "all" | "unlocked" | "locked")}
                options={[
                  { value: "all", label: t("steamAchievements.all", { defaultValue: "全部" }) },
                  { value: "unlocked", label: t("steamAchievements.unlocked", { defaultValue: "已解锁" }) },
                  { value: "locked", label: t("steamAchievements.locked", { defaultValue: "未解锁" }) },
                ]}
              />
              <Select
                name="achievements-sort"
                value={sort}
                onChange={(value) => setSort(value as "default" | "name" | "recent")}
                options={[
                  { value: "default", label: t("steamAchievements.sortDefault", { defaultValue: "默认" }) },
                  { value: "name", label: t("steamAchievements.sortName", { defaultValue: "名称" }) },
                  { value: "recent", label: t("steamAchievements.sortRecent", { defaultValue: "最近" }) },
                ]}
              />
            </div>
          </div>
        </div>

        <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">
          {loading && data === undefined ? (
            <div className="animate-fade-in space-y-4">
              <GlassCard className="rounded-2xl p-4">
                <div className="flex gap-4">
                  <div className="hidden h-28 w-20 rounded-xl bg-secondary/40 sm:block" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 w-24 rounded bg-secondary/30" />
                    <div className="h-7 w-48 rounded bg-secondary/40" />
                    <div className="h-5 w-20 rounded-full bg-secondary/30" />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="rounded-xl bg-secondary/20 p-4">
                      <div className="h-3 w-20 rounded bg-secondary/30" />
                      <div className="mt-2 h-7 w-24 rounded bg-secondary/40" />
                    </div>
                  ))}
                </div>
              </GlassCard>
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <GlassCard key={index} className="flex items-center gap-3 rounded-xl p-3">
                    <div className="h-16 w-16 rounded-lg bg-secondary/40" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-4 w-40 rounded bg-secondary/40" />
                      <div className="h-3 w-64 rounded bg-secondary/30" />
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          ) : !data ? (
            <GlassCard className="rounded-2xl border border-dashed border-border/70 px-6 py-12 text-center shadow-sm">
              <Icon name="trophy" size={40} className="mx-auto text-muted-foreground" />
              <div className="mt-4 text-base font-semibold text-foreground">
                {t("steamAchievements.localUnavailable", {
                  defaultValue: "本地成就不可用，请先确认 Steam 正在运行，且该游戏已有本地成就数据。",
                })}
              </div>
            </GlassCard>
          ) : (
            <div className="space-y-4">
              <GlassCard className="rounded-2xl p-4">
                <div className="flex gap-4">
                  <div className="hidden h-28 w-20 shrink-0 overflow-hidden rounded-xl bg-secondary/30 sm:block">
                    <img
                      src={`https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={(event) => {
                        (event.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground">{t("steamAchievements.game", { defaultValue: "游戏" })}</div>
                    <div className="mt-1 truncate text-2xl font-bold">{resolvedName}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                        <Icon name="trophy" size={14} className="text-primary" />
                        <span>App {appId}</span>
                      </div>
                      <div className="flex min-w-[min(100%,520px)] flex-1 flex-wrap items-center gap-2 text-xs">
                        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1">
                          <span className="text-muted-foreground">{t("steamAchievements.progress", { defaultValue: "完成率" })}</span>
                          <span className="font-semibold text-foreground">{data.percentage}%</span>
                          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <span
                              className="block h-full rounded-full bg-primary transition-all"
                              style={{ width: `${Math.min(Number(data.percentage) || 0, 100)}%` }}
                            />
                          </span>
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1">
                          <span className="text-muted-foreground">{t("steamAchievements.summary", { defaultValue: "已解锁 / 总数" })}</span>
                          <span className="font-semibold text-foreground">{data.unlocked} / {data.total}</span>
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1">
                          <span className="text-muted-foreground">{t("steamAchievements.unlocked", { defaultValue: "已解锁" })}</span>
                          <span className="font-semibold text-foreground">{data.unlocked}</span>
                        </div>
                      </div>
                    </div>
                    {data.liveStateAvailable === false && (
                      <div className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                        {t("steamAchievements.liveStateUnavailable", {
                          defaultValue: "当前仅加载到了本地成就定义，未能读取到 Steam 正在运行时的实时解锁状态。",
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </GlassCard>

              {achievements.length === 0 ? (
                <GlassCard className="rounded-2xl border border-dashed border-border/70 px-6 py-12 text-center shadow-sm">
                  <Icon name="trophy" size={40} className="mx-auto text-muted-foreground" />
                  <div className="mt-4 text-base font-semibold text-foreground">
                    {data.hasAchievements === false
                      ? t("steamAchievements.noAchievements", { defaultValue: "该游戏没有 Steam 成就" })
                      : t("steamAchievements.empty", { defaultValue: "没有匹配的成就" })}
                    </div>
                  <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
                    {data.hasAchievements === false
                      ? t("steamAchievements.noAchievementsHint", { defaultValue: "当前游戏本身未提供 Steam 成就，因此不会显示任何成就项目。" })
                      : t("steamAchievements.emptyHint", { defaultValue: "试试切换筛选条件。" })}
                  </p>
                </GlassCard>
              ) : (
                <div className="space-y-2">
                  {achievements.map((achievement) => {
                    const icon = achievement.achieved
                      ? (achievement.icon || achievement.iconGray)
                      : (achievement.iconGray || achievement.icon);

                    return (
                      <GlassCard
                        key={achievement.name}
                        className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${achievement.achieved ? "border-primary/20" : "opacity-90"}`}
                      >
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary/30">
                          {icon ? (
                            <img
                              src={icon}
                              alt=""
                              className={`h-full w-full object-cover ${achievement.achieved ? "" : "grayscale"}`}
                              loading="lazy"
                            />
                          ) : (
                            <Icon name="trophy" size={24} className="text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-sm font-medium">{achievement.displayName}</div>
                            {achievement.achieved ? (
                              <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                                {t("steamAchievements.unlocked", { defaultValue: "已解锁" })}
                              </span>
                            ) : (
                              <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                {t("steamAchievements.locked", { defaultValue: "未解锁" })}
                              </span>
                            )}
                            {achievement.hidden && (
                              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                                {t("steamAchievements.hidden", { defaultValue: "隐藏成就" })}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {achievement.description || t("steamAchievements.noDescription", { defaultValue: "暂无描述" })}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-xs text-muted-foreground">{t("steamAchievements.unlockTime", { defaultValue: "解锁时间" })}</div>
                          <div className="mt-1 text-xs font-medium">{achievement.achieved ? formatUnlockTime(achievement.unlockTime) : "—"}</div>
                        </div>
                      </GlassCard>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-border/60 px-5 py-4 flex justify-end">
          <Button variant="outline" onClick={handleClose}>
            {t("common.close", { defaultValue: "关闭" })}
          </Button>
        </div>
      </GlassFloating>
    </div>
  );

  return createPortal(dialog, document.body);
}
