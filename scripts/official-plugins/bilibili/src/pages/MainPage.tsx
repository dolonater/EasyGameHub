import React, { Button, Icon, useEffect, useState } from "sdk";
import { BiliAppShell } from "../components/BiliAppShell";
import { ArticlePage } from "./ArticlePage";
import { BangumiPage } from "./BangumiPage";
import { ChatPage } from "./ChatPage";
import { DynamicPage } from "./DynamicPage";
import { HomePage } from "./HomePage";
import { FavoritesPage } from "./FavoritesPage";
import { HistoryPage } from "./HistoryPage";
import { LiveHomePage } from "./LiveHomePage";
import { LivePage } from "./LivePage";
import { MinePage } from "./MinePage";
import { NotificationsPage } from "./NotificationsPage";
import { PgcListPage } from "./PgcListPage";
import { SeasonPage } from "./SeasonPage";
import { SearchPage } from "./SearchPage";
import { SettingsPage } from "./SettingsPage";
import { SpacePage } from "./SpacePage";
import { WatchLaterPage } from "./WatchLaterPage";
import { WatchPage } from "./WatchPage";
import { DynDetailPage } from "./DynDetailPage";
import { clearViewScroll, getNavView, getViewScroll, goBackNav, subscribeNav, type BiliNavView } from "../navigation";
import { getState, subscribe } from "../runtime";

/**
 * 单页容器：唯一的注册页面。home/mine 常驻挂载、用 display 隐藏/显示，保住
 * 首页 feed（已加载分页、搜索词、滚动）与我的页内容；watch 按需挂载，离开即
 * 卸载（停止播放、上报进度），对齐现有播放页生命周期。
 */
export function MainPage() {
  const [view, setView] = useState<BiliNavView>(getNavView);
  const [runtimeState, setRuntimeState] = useState(getState);

  useEffect(() => subscribeNav(setView), []);
  useEffect(() => subscribe(() => setRuntimeState(getState())), []);

  // 插件页挂载时清掉上次会话残留的滚动位置（视图仍由 memory 恢复）
  useEffect(() => {
    clearViewScroll();
    return clearViewScroll;
  }, []);

  // 视图切换后恢复该视图记录的滚动位置（离开时的位置由 navigation 记录）
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const el = document.querySelector(".app-page-surface");
      if (el) el.scrollTop = getViewScroll(view.name);
    });
    return () => cancelAnimationFrame(frame);
  }, [view.name]);

  const loginInfo = runtimeState.loginInfo;
  const loggedIn = Boolean(loginInfo?.loggedIn);

  const title =
    view.name === "watch" ? "播放" : view.name === "space" ? "UP 主页" : view.name === "season" ? "番剧详情"       : view.name === "live" ? "直播间" : view.name === "liveHome" ? "直播" : view.name === "history" ? "历史记录" : view.name === "watchLater" ? "稍后再看" : view.name === "favorites" ? "收藏夹" : view.name === "bangumi" ? "追番" : view.name === "pgcList" ? (view.title || "全部") : view.name === "settings" ? "设置" : view.name === "search" ? "搜索" : view.name === "dynDetail" ? "动态详情" : view.name === "article" ? "专栏" : view.name === "chat" ? "会话" : view.name === "notifications" ? "通知" : "Bilibili";
  const subtitle =
    view.name === "watch"
      ? view.bvid || (view.aid ? `av${view.aid}` : "播放")
      : view.name === "mine"
        ? loggedIn && loginInfo?.nickname
          ? loginInfo.nickname
          : "账号中心"
        : "EasyGameHub";

  const actions =
    view.name === "watch" || view.name === "space" || view.name === "season" || view.name === "live" || view.name === "liveHome" || view.name === "history" || view.name === "watchLater" || view.name === "favorites" || view.name === "bangumi" || view.name === "pgcList" || view.name === "dynDetail" || view.name === "article" || view.name === "chat" || view.name === "notifications" || view.name === "search" ? (
      <Button aria-label="返回" variant="outline" size="sm" type="button" onClick={goBackNav}>
        <Icon name="skipBackFilled" size={15} />
      </Button>
    ) : undefined;

  return (
    <BiliAppShell current={view.name} title={title} subtitle={subtitle} actions={actions}>
      <div className={view.name === "home" ? "" : "bili-hidden"}>
        <HomePage />
      </div>
      <div className={view.name === "dynamic" ? "" : "bili-hidden"}>
        <DynamicPage />
      </div>
      <div className={view.name === "mine" ? "" : "bili-hidden"}>
        <MinePage />
      </div>
      {view.name === "watch" ? <WatchPage key={watchKey(view)} target={view} /> : null}
      {view.name === "space" ? <SpacePage key={`space-${view.mid}`} mid={view.mid} /> : null}
      {view.name === "season" ? <SeasonPage key={`season-${view.seasonId}`} seasonId={view.seasonId} /> : null}
      {view.name === "pgcList" ? <PgcListPage key={`pgc-${view.seasonType}-${view.title ?? ""}`} seasonType={view.seasonType} /> : null}
      {view.name === "live" ? <LivePage key={`live-${view.roomId}`} roomId={view.roomId} /> : null}
      {view.name === "liveHome" ? <LiveHomePage /> : null}
      {view.name === "history" ? <HistoryPage /> : null}
      {view.name === "watchLater" ? <WatchLaterPage /> : null}
      {view.name === "favorites" ? <FavoritesPage /> : null}
      {view.name === "bangumi" ? <BangumiPage /> : null}
      {view.name === "settings" ? <SettingsPage /> : null}
      {view.name === "search" ? <SearchPage keyword={view.keyword ?? ""} /> : null}
      {view.name === "dynDetail" ? <DynDetailPage key={view.dynId} dynId={view.dynId} /> : null}
      {view.name === "article" ? <ArticlePage key={`article-${view.articleId}`} articleId={view.articleId} /> : null}
      {view.name === "chat" ? <ChatPage key={`chat-${view.uid}`} uid={view.uid} /> : null}
      {view.name === "notifications" ? <NotificationsPage /> : null}
    </BiliAppShell>
  );
}

/** P0 视图占位：space/season/live/settings/dynDetail/article 由 P1-P8 逐个填充 */
function PlaceholderPage({ label }: { label: string }) {
  return (
    <div className="bili-placeholder-page">
      <div className="bili-placeholder-label">{label}</div>
      <div className="bili-placeholder-hint">功能开发中</div>
    </div>
  );
}

/** 不同视频用不同 key，确保连点相关推荐时播放页整体重挂载而不是复用旧状态 */
function watchKey(view: BiliNavView) {
  if (view.name !== "watch") return "";
  if (view.seasonId) return `watch-season-${view.seasonId}-${view.epId ?? ""}-${view.cid ?? ""}`;
  return `watch-${view.bvid ?? ""}-${view.aid ?? ""}-${view.cid ?? ""}`;
}
