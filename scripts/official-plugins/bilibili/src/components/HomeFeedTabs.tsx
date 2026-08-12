import React, { Button } from "sdk";

export type HomeMode = "recommend" | "popular" | "bangumi" | "cinema" | "live";

interface HomeFeedTabsProps {
  mode: HomeMode;
  loading: boolean;
  onRecommend(): void;
  onPopular(): void;
  onBangumi(): void;
  onCinema(): void;
  onLive(): void;
}

const TABS: Array<{ key: HomeMode; label: string; available: boolean }> = [
  { key: "recommend", label: "推荐", available: true },
  { key: "popular", label: "热门", available: true },
  { key: "bangumi", label: "追番", available: true },
  { key: "cinema", label: "影视", available: true },
  { key: "live", label: "直播", available: true },
];

export function HomeFeedTabs({ mode, loading, onRecommend, onPopular, onBangumi, onCinema, onLive }: HomeFeedTabsProps) {
  const handlers: Record<string, () => void> = {
    recommend: onRecommend,
    popular: onPopular,
    bangumi: onBangumi,
    cinema: onCinema,
    live: onLive,
  };
  return (
    <div className="bili-feed-tabs" role="tablist" aria-label="首页内容">
      {TABS.map((tab) => (
        <Button
          key={tab.key}
          aria-selected={mode === tab.key}
          className={mode === tab.key ? "bili-feed-tab bili-feed-tab-active" : "bili-feed-tab"}
          variant="ghost"
          size="sm"
          role="tab"
          type="button"
          onClick={handlers[tab.key]}
          disabled={loading || !tab.available}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  );
}
