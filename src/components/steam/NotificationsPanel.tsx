import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import Button from "../ui/Button";
import GlassCard from "../ui/GlassCard";
import Icon from "../ui/Icon";
import { patchSteamHubCache, useSteamHubCache } from "../../lib/steamHubCache";
import type { SteamNotificationDto } from "../../lib/steamCommunity";

interface NotificationsPanelProps {
  appIds: number[];
  embedded?: boolean;
}

const KIND_META: Record<SteamNotificationDto["kind"], { labelKey: string; className: string; icon: "chart" | "info" | "key" }> = {
  price_drop: {
    labelKey: "notificationsKindDrop",
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    icon: "chart",
  },
  news: {
    labelKey: "notificationsKindNews",
    className: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    icon: "info",
  },
  confirmation: {
    labelKey: "notificationsKindConfirm",
    className: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
    icon: "key",
  },
};

/**
 * 通知 Tab: a reverse-chronological feed of price drops, watched-game news and
 * pending confirmations. Read state is persisted backend-side; the unread
 * count feeds the Steam Hub tab badge.
 */
export default function NotificationsPanel({ appIds, embedded = false }: NotificationsPanelProps) {
  const { t } = useTranslation();
  const { notifications } = useSteamHubCache();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    invoke<SteamNotificationDto[]>("get_notifications", { appIds })
      .then((list) => {
        if (cancelled) return;
        const unread = list.filter((n) => !n.read).length;
        patchSteamHubCache({ notifications: list, notificationsUnread: unread });
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Re-fetch when the monitoring scope changes.
  }, [appIds.join(",")]);

  const markAllRead = async () => {
    const ids = notifications.map((n) => n.id);
    if (ids.length === 0) return;
    try {
      await invoke("mark_notifications_read", { ids });
      const next = notifications.map((n) => ({ ...n, read: true }));
      patchSteamHubCache({ notifications: next, notificationsUnread: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className={embedded ? "" : "max-w-lg mx-auto"}>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {unreadCount > 0
            ? `${unreadCount} ${t("steam.notificationsUnread", { defaultValue: "条未读" })}`
            : t("steam.notificationsAllRead", { defaultValue: "已全部阅读" })}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => void markAllRead()}>
            {t("steam.notificationsMarkRead")}
          </Button>
        )}
      </div>

      {loading && notifications.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
      ) : error ? (
        <div className="py-10 text-center text-sm text-red-500">{error}</div>
      ) : notifications.length === 0 ? (
        <GlassCard bordered={false} className="py-12 text-center text-muted-foreground rounded-xl shadow-sm">
          <Icon name="bell" size={32} className="mx-auto mb-2 text-muted-foreground" />
          <div className="text-sm">{t("steam.notificationsEmpty")}</div>
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const meta = KIND_META[n.kind] ?? KIND_META.news;
            return (
              <div
                key={n.id}
                className={`app-surface app-glass-card rounded-[var(--radius)] border p-3 flex items-start gap-3 ${
                  n.read ? "border-border/40 opacity-70" : "border-border/60 border-l-2 border-l-primary"
                }`}
              >
                <div className={`mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg ${meta.className}`}>
                  <Icon name={meta.icon} size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>
                      {t(`steam.${meta.labelKey}`)}
                    </span>
                    <span className="text-xs text-muted-foreground">{n.timestamp}</span>
                  </div>
                  <div className="mt-1 text-sm font-medium break-words">{n.title}</div>
                  {n.subtitle && <div className="mt-0.5 text-xs text-muted-foreground break-words">{n.subtitle}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
