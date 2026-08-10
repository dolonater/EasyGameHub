import { createElement, useMemo } from "react";
import { BrowserRouter, Navigate, useRoutes } from "react-router-dom";
import type { RouteObject } from "react-router-dom";
import { AnimationContext, useAnimationProvider } from "./hooks/useAnimation";
import { AppearanceProvider, GlobalAppearanceStyle } from "./hooks/useAppearance";
import { ThemeDataProvider, ThemeModeProvider, ActiveThemeProvider, GlobalThemeStyle } from "./hooks/useThemeData";
import { ScrollActivityProvider } from "./hooks/useScrollActivity";
import { AppDataProvider } from "./hooks/useAppData";
import { PluginProvider, usePlugins } from "./plugins/PluginProvider";
import PluginErrorBoundary from "./plugins/ErrorBoundary";
import { useSocialEvents } from "./hooks/useSocialEvents";
import Layout from "./components/Layout";
import GameList from "./pages/GameList";
import GameDetail from "./pages/GameDetail";
import GameProfile from "./pages/GameProfile";
import Screenshots from "./pages/Screenshots";
import Settings from "./pages/Settings";
import Playtime from "./pages/Playtime";
import AccountSwitch from "./pages/steam/AccountSwitch";
import Authenticator from "./pages/steam/Authenticator";
import DownloadManager from "./pages/steam/DownloadManager";
import SteamHub from "./pages/steam/SteamHub";
import Inventory from "./pages/steam/Inventory";
import Wizard from "./pages/Wizard";

function PluginPage({ pluginId, pagePath }: { pluginId: string; pagePath: string }) {
  const { pages } = usePlugins();
  const page = pages.find((p) => p.pluginId === pluginId && p.path === pagePath);
  if (!page) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "var(--muted-foreground)" }}>
        插件页面不可用（插件未启用或已被卸载）
      </div>
    );
  }
  return <PluginErrorBoundary pluginId={pluginId}>{createElement(page.render)}</PluginErrorBoundary>;
}

function AppRoutes() {
  const { pages } = usePlugins();

  const pluginRoutes: RouteObject[] = pages.map((p) => ({
    path: `/plugin/${p.pluginId}/${p.path}`,
    element: <PluginPage pluginId={p.pluginId} pagePath={p.path} />,
  }));

  const routes = useMemo<RouteObject[]>(
    () => [
      {
        element: <Layout />,
        children: [
          { path: "/", element: <Navigate to="/games" replace /> },
          { path: "/launcher", element: <Navigate to="/steam/inventory" replace /> },
          { path: "/playtime", element: <Playtime /> },
          { path: "/games", element: <GameList /> },
          { path: "/games/:id", element: <GameDetail /> },
          { path: "/profile/:id", element: <GameProfile /> },
          { path: "/screenshots", element: <Screenshots /> },
          { path: "/settings", element: <Settings /> },
          { path: "/steam", element: <SteamHub /> },
          { path: "/steam/accounts", element: <AccountSwitch /> },
          { path: "/steam/inventory", element: <Inventory /> },
          { path: "/steam/authenticator", element: <Authenticator /> },
          { path: "/steam/download", element: <DownloadManager /> },
          ...pluginRoutes,
        ],
      },
      { path: "/wizard", element: <Wizard /> },
    ],
    [pluginRoutes]
  );

  return (
    <ActiveThemeProvider>
      <GlobalThemeStyle />
      <GlobalAppearanceStyle />
      {useRoutes(routes)}
    </ActiveThemeProvider>
  );
}

function App() {
  const animEnabled = useAnimationProvider();
  // App-level social event listener: lives for the whole session so chat
  // messages keep flowing (and unread keeps counting) on any page.
  useSocialEvents();
  return (
    <AnimationContext.Provider value={animEnabled}>
      <ThemeModeProvider>
        <ThemeDataProvider>
          <AppearanceProvider>
              <AppDataProvider>
                <PluginProvider>
                  <ScrollActivityProvider />
                  <BrowserRouter>
                    <AppRoutes />
                  </BrowserRouter>
                </PluginProvider>
              </AppDataProvider>
          </AppearanceProvider>
        </ThemeDataProvider>
      </ThemeModeProvider>
    </AnimationContext.Provider>
  );
}

export default App;
