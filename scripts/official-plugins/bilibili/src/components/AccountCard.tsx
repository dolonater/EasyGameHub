import React, { Button, useEffect, useState } from "sdk";
import { getState, logout } from "../runtime";
import type { BiliLoginInfo } from "../types";
import { BiliImage } from "./BiliImage";

interface AccountCardProps {
  loginInfo: BiliLoginInfo | null;
}

interface AccountStats {
  folders: number;
  toView: number;
  collected: number;
}

/**
 * 我的页顶部账号信息卡：头像 / 昵称 / UID / 可拼统计 / 退出登录。
 * 统计从现有 SDK 调用拼出（收藏夹数、稍后再看数、收藏视频总数），
 * 取数失败隐藏统计行，不做空卡。
 */
export function AccountCard({ loginInfo }: AccountCardProps) {
  const [stats, setStats] = useState<AccountStats | null>(null);

  useEffect(() => {
    let active = true;
    const sdk = getState().sdk;
    if (!sdk || !loginInfo?.loggedIn) return;
    Promise.all([sdk.bilibili.library.favoriteFolders(), sdk.bilibili.library.toViewList()])
      .then(([folders, toView]) => {
        if (active) {
          setStats({
            folders: folders.length,
            toView: toView.length,
            collected: folders.reduce((sum, folder) => sum + (folder.mediaCount || 0), 0),
          });
        }
      })
      .catch(() => {
        if (active) setStats(null);
      });
    return () => {
      active = false;
    };
  }, [loginInfo?.loggedIn]);

  return (
    <section className="bili-account-card">
      <div className="bili-account-card-main">
        <BiliImage className="bili-account-card-avatar" src={loginInfo?.avatar || ""} alt={loginInfo?.nickname || "头像"} />
        <span className="bili-account-card-id">
          <strong>{loginInfo?.nickname || "Bilibili 用户"}</strong>
          <small>UID {loginInfo?.userId || "-"}</small>
        </span>
      </div>

      {stats ? (
        <div className="bili-account-card-stats">
          <AccountStat label="收藏夹" value={stats.folders} />
          <AccountStat label="稍后再看" value={stats.toView} />
          <AccountStat label="收藏视频" value={stats.collected} />
        </div>
      ) : null}

      <Button variant="outline" size="sm" type="button" onClick={() => void logout()}>
        退出登录
      </Button>
    </section>
  );
}

function AccountStat({ label, value }: { label: string; value: number }) {
  return (
    <span className="bili-account-card-stat">
      <strong>{value}</strong>
      <small>{label}</small>
    </span>
  );
}
