import React, { Button, useEffect, useState } from "sdk";
import { AccountCard } from "../components/AccountCard";
import { AccountLibraryTabs } from "../components/AccountLibraryTabs";
import { DynamicPublishDialog } from "../components/DynamicPublishDialog";
import { LoginPanel } from "../components/LoginPanel";
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
      {loggedIn ? (
        <div className="bili-mine-publish">
          <Button size="sm" type="button" onClick={() => setPublishOpen(true)}>
            发布动态
          </Button>
        </div>
      ) : null}
      {loggedIn ? <AccountLibraryTabs /> : null}
      <DynamicPublishDialog open={publishOpen} onClose={() => setPublishOpen(false)} />
    </section>
  );
}
