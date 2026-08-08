import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { useAnimation } from "../hooks/useAnimation";
import { useAppearance } from "../hooks/useAppearance";
import { useActiveTheme, useGlobalThemeStyle } from "../hooks/useThemeData";
import { getSidebarIconsOnly, getSidebarPosition, onSidebarChange } from "../lib/sidebarMode";
import {
  getSidebarDragReorderEnabled,
  onSidebarDragReorderChange,
} from "../lib/sidebarOrder";
import { isFullscreen, toggleFullscreen, onFullscreenChange } from "../lib/fullscreen";
import Notification, { showToast } from "./Notification";
import BigPictureUI from "./BigPictureUI";
import WindowTitleBar from "./WindowTitleBar";
import AppBackgroundShell from "./AppBackgroundShell";
import Icon from "./ui/Icon";
import { GlassFloating, GlassSidebar, SidebarMenu } from "./ui";
import { usePlugins } from "../plugins/PluginProvider";
import AsciiLogo from "./AsciiLogo";

export default function Layout() {
  const { t } = useTranslation();
  const location = useLocation();
  const animEnabled = useAnimation();
  const { pages: pluginPages } = usePlugins();
  const { cssVars } = useActiveTheme();
  const globalStyle = useGlobalThemeStyle();
  const { appearance, backgroundUrl, textVars } = useAppearance();
  const mergedGlobalStyle = appearance.follow_background_text
    ? { ...globalStyle, ...textVars } as React.CSSProperties
    : globalStyle;
  const mergedPageStyle = appearance.follow_background_text
    ? { ...(cssVars as React.CSSProperties), ...textVars } as React.CSSProperties
    : (cssVars as React.CSSProperties);
  const [dragOver, setDragOver] = useState(false);
  const [iconsOnly, setIconsOnly] = useState(getSidebarIconsOnly);
  const [sidebarPosition, setSidebarPosition] = useState(getSidebarPosition);
  const [sidebarDragReorderEnabled, setSidebarDragReorderEnabled] = useState(getSidebarDragReorderEnabled());
  const [fullscreen, setFullscreen] = useState(isFullscreen());
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    return onSidebarChange(() => {
      setIconsOnly(getSidebarIconsOnly());
      setSidebarPosition(getSidebarPosition());
    });
  }, []);

  useEffect(() => {
    return onSidebarDragReorderChange(() => setSidebarDragReorderEnabled(getSidebarDragReorderEnabled()));
  }, []);

  useEffect(() => {
    return onFullscreenChange(setFullscreen);
  }, []);

  // F11 keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F11") { e.preventDefault(); toggleFullscreen(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    getCurrentWindow().onDragDropEvent(async (event: any) => {
      if (disposed) return;
      if (event.payload.type === "enter" || event.payload.type === "over") {
        setDragOver(true);
      } else if (event.payload.type === "leave") {
        setDragOver(false);
      } else if (event.payload.type === "drop") {
        setDragOver(false);
        const paths: string[] = event.payload.paths || [];
        for (const p of paths) {
          // Only dropped game folders are meant to reach add_game. Plugin
          // packages (.zip) are handled by the plugin page, so skip them here
          // to avoid adding a bogus "game" (and a stray success toast).
          if (/\.zip$/i.test(p)) continue;
          // Derive game name from folder name
          const parts = p.replace(/\\/g, "/").split("/");
          const name = parts[parts.length - 1] || p;
          try {
            await invoke("add_game", { name, savePath: p });
            showToast("success", t("notification.gameAdded", { name }));
          } catch (e: any) {
            showToast("error", String(e));
          }
        }
      }
    }).then((fn) => {
      // Resolve after cleanup (StrictMode double-mount): unregister at once.
      if (disposed) fn();
      else unlisten = fn;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  // ── Sidebar nav button style (animotion 左侧栏菜单/style1.tsx) ──
  const sidebarTextClass = appearance.follow_background_text
    ? "text-foreground/80"
    : "text-gray-600 dark:text-slate-400";
  const sidebarIconClass = appearance.follow_background_text
    ? "text-foreground/70"
    : "text-gray-500 dark:text-slate-400";
  const sidebarTitleClass = appearance.follow_background_text
    ? "text-foreground"
    : "text-gray-700 dark:text-foreground";
  const sidebarSectionClass = appearance.follow_background_text
    ? "text-muted-foreground"
    : "text-gray-400 dark:text-muted-foreground";

  const horizontalSidebar = sidebarPosition === "top" || sidebarPosition === "bottom";
  const pluginRoute = location.pathname.startsWith("/plugin/");
  const effectiveIconsOnly = iconsOnly || horizontalSidebar;
  const navBtnClass = ({ isActive }: { isActive: boolean }) =>
    `app-glass-nav-item flex items-center ${effectiveIconsOnly ? "h-10 w-10 justify-center p-0" : "gap-2 p-3 py-2.5"} rounded-[var(--radius)] text-sm font-semibold transition-all ease-linear ${
      isActive
        ? "bg-primary text-primary-foreground shadow-md"
        : `${sidebarTextClass} hover:bg-primary/10 hover:shadow-inner`
    }`;


  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    el.scrollTop = 0;
  }, [location.pathname]);

  // ── Big Picture mode: full-screen overlay ──
  if (fullscreen) return <BigPictureUI />;

  const contentClass = [
    "relative z-[1] flex flex-1 min-h-0",
    sidebarPosition === "right"
      ? "flex-row-reverse"
      : "flex-row",
  ].join(" ");
  const sidebarClass = [
    "w-fit shrink-0 py-2 shadow-md shadow-primary/10 dark:shadow-none flex flex-col overflow-hidden",
    sidebarPosition === "right"
      ? "pl-1.5 pr-3.5 dark:border-l dark:border-border rounded-l-md"
      : "pl-1.5 pr-3.5 dark:border-r dark:border-border rounded-r-md",
  ].join(" ");
  const horizontalNavClass = [
    "pointer-events-none absolute left-0 right-0 z-20 h-16 px-3 py-2 flex items-center justify-center overflow-visible",
    sidebarPosition === "bottom" ? "bottom-0" : "top-0",
  ].join(" ");
  const logoClass = horizontalSidebar
    ? "mr-2 flex h-10 w-8 flex-none items-center justify-center"
    : `px-1 py-1 mb-2 ${effectiveIconsOnly ? "flex justify-center px-0" : ""}`;

  return (
    <div className="app-shell flex flex-col h-screen overflow-hidden relative">
      <AppBackgroundShell
        backgroundUrl={backgroundUrl}
        autoDarken={appearance.auto_darken}
        backgroundBlur={appearance.background_blur}
      />

      <WindowTitleBar />

      <div className={contentClass}>
        {horizontalSidebar ? (
          null
        ) : (
          <GlassSidebar className={sidebarClass} style={mergedGlobalStyle}>
            <div className={logoClass}>
              <AsciiLogo className={`mx-auto text-[5px] text-center ${sidebarTitleClass} ${effectiveIconsOnly ? "hidden" : ""}`} />
              {effectiveIconsOnly && <span className="text-lg font-bold text-primary select-none">E</span>}
            </div>
            <SidebarMenu
              iconsOnly={effectiveIconsOnly}
              orientation="vertical"
              horizontalPlacement="top"
              libraryLabel={t("steam.libraryPageTitle")}
              playtimeLabel={t("nav.playtime")}
              screenshotsLabel={t("nav.screenshots")}
              gamesLabel={t("nav.games")}
              steamHubLabel={t("steam.navLabel")}
              settingsLabel={t("nav.settings")}
              fullscreenLabel={"Fullscreen"}
              sectionGames={t("nav.gamesLabel") || "Games"}
              sectionSteam={t("steam.navLabel")}
              sectionSystem={t("nav.systemLabel") || "System"}
              fullscreen={fullscreen}
              dragReorderEnabled={sidebarDragReorderEnabled}
              onToggleFullscreen={toggleFullscreen}
              navBtnClass={navBtnClass}
              iconClass={sidebarIconClass}
              sectionClass={sidebarSectionClass}
              pluginItems={pluginPages.map((p) => ({
                key: `${p.pluginId}/${p.path}`,
                to: `/plugin/${p.pluginId}/${p.path}`,
                title: p.title,
                icon: p.icon,
              }))}
              pluginLabel={t("plugins.navLabel", { defaultValue: "Plugins" })}
            />
          </GlassSidebar>
        )}
        <main
          ref={mainRef}
          className={[
            "relative app-scrollbar app-page-surface flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden p-6",
            horizontalSidebar ? "[&>*]:mx-auto" : "",
            pluginRoute ? "app-plugin-page" : "",
            pluginRoute && sidebarPosition === "top" ? "app-plugin-page-top-nav pt-6" : sidebarPosition === "top" ? "pt-24" : "",
            pluginRoute && sidebarPosition === "bottom" ? "app-plugin-page-bottom-nav pb-6" : sidebarPosition === "bottom" ? "pb-24" : "",
            sidebarPosition === "right" ? "[&>*]:ml-auto [&>*]:mr-0" : "",
            animEnabled ? "animate-fade-slide-up" : "",
          ].join(" ").trim()}
          style={mergedPageStyle}
        >
          <Outlet />
        </main>
        {horizontalSidebar && (
          <aside className={horizontalNavClass}>
            <SidebarMenu
              iconsOnly={effectiveIconsOnly}
              orientation="horizontal"
              horizontalPlacement={sidebarPosition === "bottom" ? "bottom" : "top"}
              libraryLabel={t("steam.libraryPageTitle")}
              playtimeLabel={t("nav.playtime")}
              screenshotsLabel={t("nav.screenshots")}
              gamesLabel={t("nav.games")}
              steamHubLabel={t("steam.navLabel")}
              settingsLabel={t("nav.settings")}
              fullscreenLabel={"Fullscreen"}
              sectionGames={t("nav.gamesLabel") || "Games"}
              sectionSteam={t("steam.navLabel")}
              sectionSystem={t("nav.systemLabel") || "System"}
              fullscreen={fullscreen}
              dragReorderEnabled={sidebarDragReorderEnabled}
              onToggleFullscreen={toggleFullscreen}
              navBtnClass={navBtnClass}
              iconClass={sidebarIconClass}
              sectionClass={sidebarSectionClass}
              pluginItems={pluginPages.map((p) => ({
                key: `${p.pluginId}/${p.path}`,
                to: `/plugin/${p.pluginId}/${p.path}`,
                title: p.title,
                icon: p.icon,
              }))}
              pluginLabel={t("plugins.navLabel", { defaultValue: "Plugins" })}
            />
          </aside>
        )}
      </div>
      <Notification />

      {/* Drag-drop overlay */}
      {dragOver && (
        <div className="absolute inset-0 bg-primary/10 border-2 border-primary border-dashed z-50 flex items-center justify-center pointer-events-none">
          <GlassFloating className="rounded-xl px-6 py-4 shadow-lg text-sm font-medium">
            {t("addGame.savePath")}
          </GlassFloating>
        </div>
      )}
    </div>
  );
}
