import React, { Button, useEffect, useState } from "sdk";
import { BiliAppShell } from "../components/BiliAppShell";
import { HomePage } from "./HomePage";
import { MinePage } from "./MinePage";
import { WatchPage } from "./WatchPage";
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

  const title = view.name === "watch" ? "播放" : "Bilibili";
  const subtitle =
    view.name === "watch"
      ? view.bvid || (view.aid ? `av${view.aid}` : "播放")
      : view.name === "mine"
        ? loggedIn && loginInfo?.nickname
          ? loginInfo.nickname
          : "账号中心"
        : "EasyGameHub";

  const actions =
    view.name === "home" ? (
      <a className="bili-link-button" href="https://www.bilibili.com" target="_blank" rel="noreferrer">
        打开 B 站
      </a>
    ) : view.name === "watch" ? (
      <Button variant="outline" size="sm" type="button" onClick={goBackNav}>
        返回
      </Button>
    ) : undefined;

  return (
    <BiliAppShell current={view.name} title={title} subtitle={subtitle} actions={actions}>
      <div className={view.name === "home" ? "" : "bili-hidden"}>
        <HomePage />
      </div>
      <div className={view.name === "mine" ? "" : "bili-hidden"}>
        <MinePage />
      </div>
      {view.name === "watch" ? <WatchPage key={watchKey(view)} target={view} /> : null}
    </BiliAppShell>
  );
}

/** 不同视频用不同 key，确保连点相关推荐时播放页整体重挂载而不是复用旧状态 */
function watchKey(view: BiliNavView) {
  return view.name === "watch" ? `watch-${view.bvid ?? ""}-${view.aid ?? ""}-${view.cid ?? ""}` : "";
}
