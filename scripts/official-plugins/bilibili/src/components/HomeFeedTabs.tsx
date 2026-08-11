import React, { Button } from "sdk";

interface HomeFeedTabsProps {
  mode: "recommend" | "popular" | "search";
  loading: boolean;
  onRecommend(): void;
  onPopular(): void;
}

export function HomeFeedTabs({ mode, loading, onRecommend, onPopular }: HomeFeedTabsProps) {
  return (
    <div className="bili-feed-tabs" role="tablist" aria-label="首页内容">
      <Button
        aria-selected={mode === "recommend"}
        className={mode === "recommend" ? "bili-feed-tab bili-feed-tab-active" : "bili-feed-tab"}
        variant="ghost"
        size="sm"
        role="tab"
        type="button"
        onClick={onRecommend}
        disabled={loading}
      >
        推荐
      </Button>
      <Button
        aria-selected={mode === "popular"}
        className={mode === "popular" ? "bili-feed-tab bili-feed-tab-active" : "bili-feed-tab"}
        variant="ghost"
        size="sm"
        role="tab"
        type="button"
        onClick={onPopular}
        disabled={loading}
      >
        热门
      </Button>
    </div>
  );
}
