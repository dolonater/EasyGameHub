import React, { Button, useEffect, useState } from "sdk";
import { navigateNav } from "../navigation";
import { getState, refreshLoginStatus, subscribe } from "../runtime";
import { BiliImage } from "./BiliImage";

export type BiliTopNavPage = "home" | "dynamic" | "mine" | "watch";

interface BiliTopNavProps {
  current: string;
  title?: string;
  subtitle?: string;
  actions?: any;
}

export function BiliTopNav({ current, title = "Bilibili", subtitle = "EasyGameHub", actions }: BiliTopNavProps) {
  const [runtimeState, setRuntimeState] = useState(getState);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribe(() => setRuntimeState(getState()));
    void refreshLoginStatus().catch(() => undefined);
    return unsubscribe;
  }, []);

  // 未读角标：30s 轮询（仅登录态）
  useEffect(() => {
    const sdk = getState().sdk;
    if (!sdk) return;
    let cancelled = false;
    const refresh = () => {
      sdk.bilibili.message
        .unread()
        .then((data) => {
          if (!cancelled) setUnread(data.reply + data.at + data.privateMsg + data.sysMsg);
        })
        .catch(() => undefined);
    };
    refresh();
    const timer = setInterval(refresh, 30 * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [Boolean(runtimeState.loginInfo?.loggedIn)]);

  const loginInfo = runtimeState.loginInfo;
  const loggedIn = Boolean(loginInfo?.loggedIn);

  return (
    <header className="bili-top-nav">
      <button className="bili-brand" type="button" onClick={() => navigateNav({ name: "home" })}>
        <span className="bili-brand-mark">B</span>
        <span>
          <strong>{title}</strong>
          <small>{subtitle}</small>
        </span>
      </button>

      <nav className="bili-nav-tabs" aria-label="Bilibili 插件导航">
        <Button
          aria-current={current === "home" ? "page" : undefined}
          className={current === "home" ? "bili-nav-tab bili-nav-tab-active" : "bili-nav-tab"}
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => navigateNav({ name: "home" })}
        >
          首页
        </Button>
        <Button
          aria-current={current === "dynamic" ? "page" : undefined}
          className={current === "dynamic" ? "bili-nav-tab bili-nav-tab-active" : "bili-nav-tab"}
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => navigateNav({ name: "dynamic" })}
        >
          动态
        </Button>
        <Button
          aria-current={current === "mine" ? "page" : undefined}
          className={current === "mine" ? "bili-nav-tab bili-nav-tab-active" : "bili-nav-tab"}
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => navigateNav({ name: "mine" })}
        >
          我的
        </Button>
        {loggedIn && unread > 0 ? <span className="bili-nav-badge">{unread > 99 ? "99+" : unread}</span> : null}
      </nav>

      <div className="bili-top-actions">
        {actions}
        <Button className="bili-profile-button" variant="ghost" size="sm" type="button" onClick={() => navigateNav({ name: "mine" })}>
          {loggedIn && loginInfo?.avatar ? (
            <BiliImage className="bili-profile-avatar" src={loginInfo.avatar} alt={loginInfo.nickname} />
          ) : (
            <span className="bili-profile-avatar bili-profile-avatar-empty">登</span>
          )}
          <span>{loggedIn ? loginInfo?.nickname || "已登录" : "登录"}</span>
        </Button>
      </div>
    </header>
  );
}
