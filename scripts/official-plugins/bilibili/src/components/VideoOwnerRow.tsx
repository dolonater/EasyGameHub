import React, { Button } from "sdk";
import type { BiliVideoInteractionState } from "../types";

interface VideoOwnerRowProps {
  busy: boolean;
  loggedIn: boolean;
  state: BiliVideoInteractionState | null;
  onFollow(): void;
  onOpenSpace(): void;
}

export function VideoOwnerRow({ busy, loggedIn, state, onFollow, onOpenSpace }: VideoOwnerRowProps) {
  const owner = state?.owner;

  return (
    <div className="bili-owner-row">
      <button className="bili-owner-main" disabled={!owner} type="button" onClick={onOpenSpace}>
        {owner?.avatar ? <img alt="" className="bili-owner-avatar" src={owner.avatar} /> : <span className="bili-owner-avatar" />}
        <span>
          <strong>{owner?.name || "未知 UP 主"}</strong>
          <small>{owner ? `${formatCount(owner.followerCount)} 粉丝` : "互动状态加载中"}</small>
        </span>
      </button>
      <Button disabled={!loggedIn || !owner || busy} size="sm" type="button" onClick={onFollow}>
        {owner?.following ? "已关注" : "关注"}
      </Button>
    </div>
  );
}

function formatCount(value: number) {
  if (value >= 100000000) return `${trim(value / 100000000)}亿`;
  if (value >= 10000) return `${trim(value / 10000)}万`;
  return String(Math.max(0, Math.floor(value || 0)));
}

function trim(value: number) {
  return value.toFixed(value >= 10 ? 0 : 1).replace(/\.0$/, "");
}
