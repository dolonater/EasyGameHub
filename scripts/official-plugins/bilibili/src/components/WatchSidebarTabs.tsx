import React, { useState } from "sdk";
import type { BiliVideoInteractionState, BiliVideoPage } from "../types";
import { RelatedPanel } from "./RelatedPanel";
import { VideoOwnerRow } from "./VideoOwnerRow";

interface WatchSidebarTabsProps {
  pages: BiliVideoPage[];
  selectedPageCid: number | undefined;
  onSelectPage(page: BiliVideoPage): void;
  bvid?: string;
  aid?: number;
  loggedIn: boolean;
  interactionState: BiliVideoInteractionState | null;
  followBusy: boolean;
  onFollowOwner(): void;
  onOpenSpace(): void;
  /** 分P/选集区块标题（番剧显示"选集"） */
  pagesLabel?: string;
  /** 隐藏 UP 行（番剧无 UP） */
  hideOwner?: boolean;
}

/**
 * 播放页右侧内容栏：UP 信息行 + 分P/选集列表 + 相关推荐，堆叠区块。
 * 宽窗口常驻展示；窄窗口（断点内）收起为可展开面板，不常驻占宽。
 */
export function WatchSidebarTabs({
  pages,
  selectedPageCid,
  onSelectPage,
  bvid,
  aid,
  loggedIn,
  interactionState,
  followBusy,
  onFollowOwner,
  onOpenSpace,
  pagesLabel,
  hideOwner,
}: WatchSidebarTabsProps) {
  const [open, setOpen] = useState(false);

  return (
    <aside className={`bili-watch-side ${open ? "bili-watch-side-open" : ""}`}>
      <button className="bili-watch-side-toggle" type="button" onClick={() => setOpen((value) => !value)}>
        <span>{hideOwner ? `${pagesLabel ?? "选集"} · 相关推荐` : `UP · ${pagesLabel ?? "分P"} · 相关推荐`}</span>
        <small>{open ? "收起" : "展开"}</small>
      </button>
      <div className="bili-watch-side-content">
        {!hideOwner ? (
          <VideoOwnerRow
            busy={followBusy}
            loggedIn={loggedIn}
            state={interactionState}
            onFollow={onFollowOwner}
            onOpenSpace={onOpenSpace}
          />
        ) : null}
        <section className="bili-sidebar-section">
          <div className="bili-section-title">
            <strong>{pagesLabel ?? "分 P"}</strong>
            <small>{pages.length} 个</small>
          </div>
          <div className="bili-page-list">
            {pages.map((page) => (
              <button
                className={`bili-page-item ${selectedPageCid === page.cid ? "bili-page-item-active" : ""}`}
                key={page.cid}
                type="button"
                onClick={() => onSelectPage(page)}
              >
                <span>
                  {page.page}. {page.title || `CID ${page.cid}`}
                </span>
                <small>{formatDuration(page.duration)}</small>
              </button>
            ))}
          </div>
        </section>
        <RelatedPanel bvid={bvid} aid={aid} />
      </div>
    </aside>
  );

  function openOwnerSpace() {
    const mid = interactionState?.owner.mid;
    if (!mid) return;
    window.open(`https://space.bilibili.com/${mid}`, "_blank");
  }
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const hour = Math.floor(safe / 3600);
  const minute = Math.floor((safe % 3600) / 60);
  const second = safe % 60;
  if (hour > 0) return `${hour}:${pad(minute)}:${pad(second)}`;
  return `${minute}:${pad(second)}`;
}

function pad(value: number) {
  return value.toString().padStart(2, "0");
}
