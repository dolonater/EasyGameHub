import React, { Button, useEffect, useState } from "sdk";

type WatchTab = "pages" | "quality" | "danmaku" | "comments" | "more";

interface WatchSidebarTabsProps {
  defaultTab: WatchTab;
  focusMoreNonce?: number;
  pagesCount: number;
  commentsPanel: any;
  pagesPanel: any;
  qualityPanel: any;
  danmakuPanel: any;
  morePanel: any;
}

const tabs: Array<{ id: WatchTab; label: string }> = [
  { id: "pages", label: "分P" },
  { id: "quality", label: "清晰度" },
  { id: "danmaku", label: "弹幕" },
  { id: "comments", label: "评论" },
  { id: "more", label: "更多" },
];

export function WatchSidebarTabs({
  defaultTab,
  focusMoreNonce,
  pagesCount,
  commentsPanel,
  pagesPanel,
  qualityPanel,
  danmakuPanel,
  morePanel,
}: WatchSidebarTabsProps) {
  const [active, setActive] = useState<WatchTab>(defaultTab);

  useEffect(() => {
    setActive(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (focusMoreNonce) setActive("more");
  }, [focusMoreNonce]);

  return (
    <aside className="bili-watch-side">
      <div className="bili-watch-tabs" role="tablist" aria-label="播放辅助功能">
        {tabs.map((tab) => (
          <Button
            aria-selected={active === tab.id}
            className={active === tab.id ? "bili-watch-tab bili-watch-tab-active" : "bili-watch-tab"}
            variant="ghost"
            size="sm"
            key={tab.id}
            role="tab"
            type="button"
            onClick={() => setActive(tab.id)}
          >
            <span>{tab.label}</span>
            {tab.id === "pages" && pagesCount > 1 ? <small>{pagesCount}</small> : null}
          </Button>
        ))}
      </div>
      <div className="bili-watch-tab-panel" role="tabpanel">
        {active === "pages" ? pagesPanel : null}
        {active === "quality" ? qualityPanel : null}
        {active === "danmaku" ? danmakuPanel : null}
        {active === "comments" ? commentsPanel : null}
        {active === "more" ? morePanel : null}
      </div>
    </aside>
  );
}
