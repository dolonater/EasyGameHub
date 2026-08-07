import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { showToast } from "../Notification";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import type { SessionDto, SteamProfileDto } from "../../lib/steamCommunity";

interface ProfilePanelProps {
  session: SessionDto | null;
  profile: SteamProfileDto | null;
  onLogout: () => void;
  onSwitchAccount: () => void;
}

/**
 * 概览 tab: a fuller profile summary card plus quick actions. The compact
 * identity strip lives in ProfileHeader; this tab is only meaningful when a
 * session exists.
 */
export default function ProfilePanel({
  session,
  profile,
  onLogout,
  onSwitchAccount,
}: ProfilePanelProps) {
  const { t } = useTranslation();

  if (!session) {
    return (
      <div className="app-surface app-glass-card rounded-[var(--radius)] border border-border/40 py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <Icon name="steamLogin" size={32} />
        <div className="text-sm">{t("steam.overviewNoSession", { defaultValue: "登录后查看个人资料概览" })}</div>
      </div>
    );
  }

  const personaName = profile?.personaName || session.accountName;
  const avatarUrl = profile?.avatarUrl;

  const copySteamId = async () => {
    try {
      await navigator.clipboard.writeText(String(session.steamId));
      showToast("success", t("steam.copied"));
    } catch {
      // Ignore clipboard failures in the webview.
    }
  };

  const openProfile = () => {
    void invoke("open_url", { url: `https://steamcommunity.com/profiles/${session.steamId}` });
  };

  const detailRow = (label: string, value: ReactNode) => (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right min-w-0">{value}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Profile summary */}
      <div className="app-surface app-glass-card rounded-[var(--radius)] border border-border/40 p-5">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={personaName}
              className="h-16 w-16 flex-none rounded-full border border-border/50 object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="flex h-16 w-16 flex-none items-center justify-center rounded-full bg-primary/15 text-primary text-2xl font-bold">
              {personaName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-lg font-bold truncate">{personaName}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {profile?.level != null && (
                <span className="rounded-full border border-border/60 bg-secondary/40 px-2 py-0.5 text-[11px] font-medium">
                  {t("steam.levelBadge", { defaultValue: "Lv. {{level}}", level: profile.level })}
                </span>
              )}
              {profile?.inGameName && (
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  <Icon name="launcher" size={12} />
                  {t("steam.inGame", { defaultValue: "游玩中" })} {profile.inGameName}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 divide-y divide-border/40 border-t border-border/40">
          {detailRow(t("steam.accountName", { defaultValue: "账号名" }), session.accountName)}
          {detailRow(
            t("steam.copySteamId64Short"),
            <button
              type="button"
              onClick={() => void copySteamId()}
              className="inline-flex items-center gap-1 text-foreground transition-colors hover:text-primary"
              title={t("steam.copySteamId")}
            >
              {session.steamId}
              <Icon name="externalLink" size={11} />
            </button>
          )}
          {profile?.level != null && detailRow(t("steam.level", { defaultValue: "等级" }), String(profile.level))}
          {profile?.inGameName != null && detailRow(t("steam.inGame"), profile.inGameName)}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={openProfile} ripple={false}>
          <Icon name="externalLink" size={14} />
          {t("steam.openProfile", { defaultValue: "资料页" })}
        </Button>
        <Button variant="outline" size="sm" onClick={onSwitchAccount} ripple={false}>
          <Icon name="reset" size={14} />
          {t("steam.switch")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => void onLogout()} ripple={false}>
          {t("steamLogin.logout")}
        </Button>
      </div>

      {/* Upcoming features hint */}
      <div className="text-xs text-muted-foreground">
        {t("steam.overviewComingSoon", { defaultValue: "更多社区功能（新闻、愿望单、成就）将在后续版本上线。" })}
      </div>
    </div>
  );
}
