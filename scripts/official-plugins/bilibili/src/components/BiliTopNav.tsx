import React, { Button, Icon, TextField, useEffect, useState } from "sdk";
import { navigateNav, openNotifications, openSearch } from "../navigation";
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
  const [searchValue, setSearchValue] = useState("");

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

  function submitSearch() {
    const keywords = searchValue.trim();
    setSearchValue("");
    openSearch(keywords || undefined);
  }

  return (
    <header className="bili-top-nav app-surface app-glass-titlebar">
      <button className="bili-brand" type="button" onClick={() => navigateNav({ name: "home" })}>
        <span className="bili-brand-mark">B</span>
        <span>
          <strong>{title}</strong>
          <small>{subtitle}</small>
        </span>
      </button>

      <form
        className="bili-top-search"
        role="search"
        onSubmit={(event: { preventDefault(): void }) => {
          event.preventDefault();
          submitSearch();
        }}
      >
        <TextField
          aria-label="搜索视频"
          className="bili-top-search-input"
          placeholder="搜索视频、UP 主、番剧"
          value={searchValue}
          onChange={(event: any) => setSearchValue(event.currentTarget.value)}
        />
        <Button aria-label="搜索" size="sm" type="submit">
          <Icon name="search" size={15} />
        </Button>
      </form>

      <div className="bili-top-actions">
        {actions}
        <Button
          aria-label="通知"
          className="bili-notify-button"
          variant="ghost"
          size="sm"
          type="button"
          onClick={openNotifications}
        >
          <Icon className="bili-notify-glyph" name="bell" size={15} />
          {loggedIn && unread > 0 ? (
            <span className="bili-nav-badge">{unread > 99 ? "99+" : unread}</span>
          ) : null}
        </Button>
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
