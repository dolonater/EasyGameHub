import React, { Button, useEffect, useState } from "sdk";
import { AccountCard } from "../components/AccountCard";
import { AccountLibraryTabs } from "../components/AccountLibraryTabs";
import { DynamicPublishDialog } from "../components/DynamicPublishDialog";
import { LoginPanel } from "../components/LoginPanel";
import { openMessages, openNotifications, openSettings } from "../navigation";
import { getState, refreshLoginStatus, subscribe } from "../runtime";

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
      <div className="bili-mine-actions">
        <Button variant="outline" size="sm" type="button" onClick={openSettings}>
          设置
        </Button>
        {loggedIn ? (
          <>
            <Button size="sm" type="button" onClick={() => setPublishOpen(true)}>
              发布动态
            </Button>
            <Button variant="outline" size="sm" type="button" onClick={openMessages}>
              私信
            </Button>
            <Button variant="outline" size="sm" type="button" onClick={openNotifications}>
              通知
            </Button>
          </>
        ) : null}
      </div>
      {loggedIn ? <AccountLibraryTabs /> : null}
      <DynamicPublishDialog open={publishOpen} onClose={() => setPublishOpen(false)} />
    </section>
  );
}
