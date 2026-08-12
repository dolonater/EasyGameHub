import React, { Button, Icon, useEffect, useState } from "sdk";
import { AccountCard } from "../components/AccountCard";
import { DynamicPublishDialog } from "../components/DynamicPublishDialog";
import { LoginPanel } from "../components/LoginPanel";
import { openBangumi, openFavorites, openHistory, openWatchLater } from "../navigation";
import { getState, refreshLoginStatus, subscribe } from "../runtime";

/**
 * 我的页（P9 阶段 2）：个人概览——资料卡 + 常用入口卡片区。
 * 设置/通知/私信入口分别由侧边栏与顶栏铃铛承接；账号内容已拆为独立侧边栏页。
 */
export function MinePage() {
  const [runtimeState, setRuntimeState] = useState(getState);
  const [publishOpen, setPublishOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribe(() => setRuntimeState(getState()));
    void refreshLoginStatus().catch(() => undefined);
    return unsubscribe;
  }, []);

  const loggedIn = Boolean(runtimeState.loginInfo?.loggedIn);

  return (
    <section className="bili-mine">
      {loggedIn ? <AccountCard loginInfo={runtimeState.loginInfo} /> : <LoginPanel />}
      <div className="bili-mine-entries">
        <MineEntry icon="playtime" label="历史记录" onClick={openHistory} />
        <MineEntry icon="bookmarkFilled" label="收藏夹" onClick={openFavorites} />
        <MineEntry icon="playlistFilled" label="稍后再看" onClick={openWatchLater} />
        <MineEntry icon="starFilled" label="追番" onClick={openBangumi} />
        {loggedIn ? <MineEntry icon="edit" label="发布动态" onClick={() => setPublishOpen(true)} /> : null}
      </div>
      <DynamicPublishDialog open={publishOpen} onClose={() => setPublishOpen(false)} />
    </section>
  );
}

function MineEntry({ icon, label, onClick }: { icon: string; label: string; onClick(): void }) {
  return (
    <button className="bili-mine-entry" type="button" onClick={onClick}>
      <span className="bili-mine-entry-glyph">
        <Icon name={icon as any} size={18} />
      </span>
      <span className="bili-mine-entry-label">{label}</span>
    </button>
  );
}
