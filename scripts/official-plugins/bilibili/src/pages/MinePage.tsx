import React, { Button, useEffect, useState } from "sdk";
import { AccountCard } from "../components/AccountCard";
import { DynamicPublishDialog } from "../components/DynamicPublishDialog";
import { LoginPanel } from "../components/LoginPanel";
import {
  openBangumi,
  openFavorites,
  openHistory,
  openMessages,
  openNotifications,
  openSettings,
  openWatchLater,
} from "../navigation";
import { getState, refreshLoginStatus, subscribe } from "../runtime";

/** 我的页（P9 阶段 2）：个人概览——资料卡 + 常用入口卡片区（账号内容已拆为独立侧边栏页）。 */
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
        <MineEntry glyph="历" label="历史记录" onClick={openHistory} />
        <MineEntry glyph="藏" label="收藏夹" onClick={openFavorites} />
        <MineEntry glyph="看" label="稍后再看" onClick={openWatchLater} />
        <MineEntry glyph="番" label="追番" onClick={openBangumi} />
        <MineEntry glyph="设" label="设置" onClick={openSettings} />
        {loggedIn ? (
          <>
            <MineEntry glyph="发" label="发布动态" onClick={() => setPublishOpen(true)} />
            <MineEntry glyph="私" label="私信" onClick={openMessages} />
            <MineEntry glyph="铃" label="通知" onClick={openNotifications} />
          </>
        ) : null}
      </div>
      <DynamicPublishDialog open={publishOpen} onClose={() => setPublishOpen(false)} />
    </section>
  );
}

function MineEntry({ glyph, label, onClick }: { glyph: string; label: string; onClick(): void }) {
  return (
    <button className="bili-mine-entry" type="button" onClick={onClick}>
      <span className="bili-mine-entry-glyph">{glyph}</span>
      <span className="bili-mine-entry-label">{label}</span>
    </button>
  );
}
