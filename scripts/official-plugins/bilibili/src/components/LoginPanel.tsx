import React, { Button, useEffect, useState } from "sdk";
import {
  getState,
  logout,
  refreshLoginStatus,
  startQrLogin,
  stopQrLogin,
  subscribe,
} from "../runtime";
import { BiliImage } from "./BiliImage";

export function LoginPanel() {
  const [state, setState] = useState(getState);

  useEffect(() => {
    const unsubscribe = subscribe(() => setState(getState()));
    void refreshLoginStatus();
    return unsubscribe;
  }, []);

  const account = state.loginInfo;
  const loggedIn = Boolean(account?.loggedIn);

  return (
    <section className="bili-login-panel">
      <div className="bili-login-heading">
        <span>
          <strong>账号</strong>
          <small>{loggedIn ? "已登录" : account?.loginExpired ? "登录过期" : "未登录"}</small>
        </span>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => void refreshLoginStatus()}
          disabled={state.loginPolling}
        >
          刷新
        </Button>
      </div>

      {loggedIn && account ? (
        <div className="bili-account">
          <BiliImage src={account.avatar} className="bili-avatar" />
          <span className="bili-account-main">
            <strong>{account.nickname || "Bilibili 用户"}</strong>
            <small>UID {account.userId || "-"}</small>
          </span>
          <Button size="sm" type="button" onClick={() => void logout()}>
            退出登录
          </Button>
        </div>
      ) : (
        <div className="bili-login-flow">
          {state.loginQr ? (
            <img className="bili-qr" src={state.loginQr.qrImage} alt="Bilibili 登录二维码" />
          ) : (
            <div className="bili-qr-placeholder">二维码</div>
          )}
          <div className="bili-login-actions">
            {state.loginPolling ? (
              <Button size="sm" type="button" onClick={() => stopQrLogin()}>
                取消登录
              </Button>
            ) : (
              <Button size="sm" type="button" onClick={() => void startQrLogin()}>
                生成二维码
              </Button>
            )}
          </div>
        </div>
      )}

      {state.loginError ? <p className="bili-status">{state.loginError}</p> : null}
    </section>
  );
}
