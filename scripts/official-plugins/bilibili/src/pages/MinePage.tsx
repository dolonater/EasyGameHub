import React, { useEffect, useState } from "sdk";
import { BiliAppShell } from "../components/BiliAppShell";
import { AccountLibraryTabs } from "../components/AccountLibraryTabs";
import { LoginPanel } from "../components/LoginPanel";
import { getState, refreshLoginStatus, subscribe } from "../runtime";

export function MinePage() {
  const [runtimeState, setRuntimeState] = useState(getState);

  useEffect(() => {
    const unsubscribe = subscribe(() => setRuntimeState(getState()));
    void refreshLoginStatus().catch(() => undefined);
    return unsubscribe;
  }, []);

  const loggedIn = Boolean(runtimeState.loginInfo?.loggedIn);

  return (
    <BiliAppShell current="mine" subtitle={loggedIn ? runtimeState.loginInfo?.nickname || "账号中心" : "账号中心"}>
      <section className="bili-mine">
        <LoginPanel />
        {loggedIn ? <AccountLibraryTabs /> : null}
      </section>
    </BiliAppShell>
  );
}
