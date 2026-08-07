import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { showToast } from "../Notification";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import { glassMenuItemClass, GlassMenuPanel } from "../ui/GlassSurface";
import { shortSteamId } from "../../lib/steamCommunity";
import type { SessionDto, SteamProfileDto } from "../../lib/steamCommunity";

interface AccountMenuProps {
  session: SessionDto | null;
  profile: SteamProfileDto | null;
  loading: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onSwitchAccount: () => void;
}

const MENU_ITEM_CLASS = [
  `${glassMenuItemClass} flex w-full items-center gap-2 px-[7px] py-[3px] rounded-md text-sm font-semibold whitespace-nowrap`,
  "text-foreground/80 dark:text-muted-foreground",
  "hover:!text-primary-foreground",
  "hover:bg-primary",
  "hover:-translate-y-[1px]",
  "active:scale-[0.99]",
  "transition-all duration-300 ease-out",
  "[&_svg]:w-[17px] [&_svg]:h-[17px] [&_svg]:transition-all [&_svg]:duration-300 [&_svg]:ease-out",
  "[&_svg]:stroke-current",
].join(" ");

/**
 * Compact account control for the Steam hub top bar.
 *
 * Logged in: renders the avatar only (top-right); clicking it opens a small
 * dropdown with identity (name / account / SteamID64) and quick actions.
 * Logged out: a compact login button.
 */
export default function AccountMenu({
  session,
  profile,
  loading,
  onLogin,
  onLogout,
  onSwitchAccount,
}: AccountMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (loading) {
    return (
      <div className="h-10 w-10 flex-none animate-pulse rounded-full border border-border/40 bg-secondary/40" />
    );
  }

  if (!session) {
    return (
      <Button size="sm" onClick={onLogin} ripple={false}>
        <Icon name="steamLogin" size={14} />
        {t("steam.hubLoginCta")}
      </Button>
    );
  }

  const personaName = profile?.personaName || session.accountName;
  const avatarUrl = profile?.avatarUrl;
  const initial = personaName.charAt(0).toUpperCase();

  const copySteamId = async () => {
    try {
      await navigator.clipboard.writeText(String(session.steamId));
      showToast("success", t("steam.copied"));
    } catch {
      // Clipboard may be unavailable in the webview; ignore.
    }
  };

  const openProfile = () => {
    void invoke("open_url", { url: `https://steamcommunity.com/profiles/${session.steamId}` });
  };

  const avatarNode = () => {
    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt={personaName}
          className="h-9 w-9 flex-none rounded-full border border-border/50 object-cover"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      );
    }
    return (
      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-bold">
        {initial}
      </div>
    );
  };

  const runAction = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={rootRef} className="relative flex-none">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95"
        title={personaName}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {avatarNode()}
        {profile?.inGameName && (
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 ring-2 ring-[var(--background)]" />
        )}
      </button>

      {open && (
        <GlassMenuPanel className="absolute right-0 top-full z-50 mt-2 w-max max-w-[min(90vw,26rem)] rounded-[10px] border border-border px-[5px] py-[6px] flex flex-col gap-[3px] shadow-xl animate-fade-in">
          {/* Identity header */}
          <div className="border-b border-border/60 px-2 pb-2 pt-1 mb-1">
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">{personaName}</div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {session.accountName}
                {profile?.level != null && (
                  <span className="ml-1 text-muted-foreground/70">
                    {t("steam.levelBadge", { defaultValue: "Lv. {{level}}", level: profile.level })}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void copySteamId()}
              className="mt-2 flex w-full items-center gap-1.5 truncate rounded-md px-1.5 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              title={t("steam.copySteamId")}
            >
              <Icon name="copy" size={13} />
              <span className="truncate">ID:{shortSteamId(session.steamId)}</span>
            </button>
          </div>

          <button type="button" className={MENU_ITEM_CLASS} onClick={() => runAction(openProfile)}>
            <Icon name="externalLink" size={17} />
            {t("steam.openProfile", { defaultValue: "资料页" })}
          </button>
          <button type="button" className={MENU_ITEM_CLASS} onClick={() => runAction(onSwitchAccount)}>
            <Icon name="reset" size={17} />
            {t("steam.switch")}
          </button>
          <button
            type="button"
            className={`${MENU_ITEM_CLASS} hover:bg-destructive`}
            onClick={() => runAction(() => void onLogout())}
          >
            <Icon name="signOut" size={17} />
            {t("steamLogin.logout")}
          </button>
        </GlassMenuPanel>
      )}
    </div>
  );
}
