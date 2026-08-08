import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import TabButtons from "../../components/ui/TabButtons";
import AccountMenu from "../../components/steam/AccountMenu";
import ProfilePanel from "../../components/steam/ProfilePanel";
import NewsFeed from "../../components/steam/NewsFeed";
import WishlistPanel from "../../components/steam/WishlistPanel";
import AccountSwitch from "./AccountSwitch";
import Authenticator from "./Authenticator";
import DownloadManager from "./DownloadManager";
import SocialPanel from "../../components/steam/SocialPanel";
import NotificationsPanel from "../../components/steam/NotificationsPanel";
import SteamLoginDialog from "../../components/steam/SteamLoginDialog";
import { useSteamSession } from "../../hooks/useSteamSession";
import { useSteamWatchlist } from "../../hooks/useSteamWatchlist";
import { useSteamWishlist } from "../../hooks/useSteamWishlist";
import { patchSteamHubCache, useSteamHubCache } from "../../lib/steamHubCache";

type SteamTab =
  | "overview"
  | "news"
  | "wishlist"
  | "notifications"
  | "social"
  | "accounts"
  | "authenticator"
  | "downloads";

/**
 * Integrated Steam hub page (replaces the old /steam/login route).
 *
 * Login is a dialog; the old standalone pages (accounts / authenticator /
 * downloads) are embedded as sub-tabs. 新闻/愿望单/成就 sub-tabs are filled
 * in by later phases.
 */
export default function SteamHub() {
  const { t } = useTranslation();
  const {
    session,
    profile,
    loading,
    loginOpen,
    setLoginOpen,
    refresh,
    logout,
  } = useSteamSession();
  const watch = useSteamWatchlist();
  const { activeTab, notificationsUnread } = useSteamHubCache();
  // Restore the last sub-tab after a route switch, so returning to the Steam
  // page does not bounce you back to Overview.
  const [tab, setTab] = useState<SteamTab>(() => (activeTab as SteamTab) || "overview");
  // Wishlist loads only when its tab is open — no cross-region request on
  // every Steam page mount.
  const wish = useSteamWishlist(session, tab === "wishlist");

  // News monitoring scope = wishlist ∪ manual watchlist.
  const monitoredAppIds = useMemo(
    () => [...new Set([...wish.appIds, ...watch.appIds])],
    [wish.appIds, watch.appIds]
  );
  const monitoredAppNames = useMemo(
    () => ({
      ...watch.appNames,
      ...Object.fromEntries(wish.items.map((item) => [item.appId, item.name || `App ${item.appId}`])),
    }),
    [watch.appNames, wish.items]
  );

  return (
    <div className="max-w-3xl">
      {/* ── Top bar: title + account avatar (top-right) ── */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-bold leading-tight">{t("steam.hubTitle")}</h1>
          {!session && !loading && (
            <p className="mt-0.5 text-xs text-muted-foreground">{t("steam.hubLoginHint")}</p>
          )}
        </div>
        <AccountMenu
          session={session}
          profile={profile}
          loading={loading}
          onLogin={() => setLoginOpen(true)}
          onLogout={logout}
          onSwitchAccount={() => setTab("accounts")}
        />
      </div>

      {/* ── Sub-tabs ── */}
      <TabButtons
        name="steam-hub-tabs"
        value={tab}
        onChange={(v) => {
          setTab(v as SteamTab);
          patchSteamHubCache({ activeTab: v });
        }}
        options={[
          { value: "overview", label: t("steam.tabOverview") },
          { value: "news", label: t("steam.tabNews") },
          { value: "wishlist", label: t("steam.tabWishlist") },
          {
            value: "notifications",
            label: (
              <span className="inline-flex items-center gap-1">
                {t("steam.tabNotifications")}
                {notificationsUnread > 0 && (
                  <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold leading-4 text-primary-foreground">
                    {notificationsUnread}
                  </span>
                )}
              </span>
            ),
          },
          { value: "social", label: t("steam.tabSocial") },
          { value: "accounts", label: t("steam.accountSwitch") },
          { value: "authenticator", label: t("authenticator.title") },
          { value: "downloads", label: t("download.title") },
        ]}
      />

      <div className="mt-5">
        {tab === "overview" && (
          <ProfilePanel
            session={session}
            profile={profile}
            onLogout={logout}
            onSwitchAccount={() => setTab("accounts")}
          />
        )}
        {tab === "news" && (
          <NewsFeed
            appIds={monitoredAppIds}
            appNames={monitoredAppNames}
            watchAppIds={watch.appIds}
            onAddWatch={watch.add}
            onRemoveWatch={watch.remove}
          />
        )}
        {tab === "wishlist" && (
          <WishlistPanel
            session={session}
            wishItems={wish.items}
            wishError={wish.error}
            wishLoading={wish.loading}
            onRefreshWishlist={wish.refresh}
            watchItems={watch.items}
            onAddWatch={watch.add}
            onRemoveWatch={watch.remove}
          />
        )}
        {tab === "notifications" && (
          <NotificationsPanel appIds={monitoredAppIds} embedded />
        )}
        {tab === "social" && <SocialPanel session={session} embedded />}
        {tab === "accounts" && <AccountSwitch embedded />}
        {tab === "authenticator" && <Authenticator embedded />}
        {tab === "downloads" && <DownloadManager embedded />}
      </div>

      <SteamLoginDialog
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onLoggedIn={() => void refresh()}
      />
    </div>
  );
}
