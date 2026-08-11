import React from "sdk";
import type { BiliVideoCard } from "../types";
import { VideoCard } from "./VideoCard";
import { HomeFeedTabs } from "./HomeFeedTabs";

interface HomeFeedProps {
  mode: "recommend" | "popular" | "search";
  loading: boolean;
  error: string;
  videos: BiliVideoCard[];
  onRecommend(): void;
  onPopular(): void;
}

export function HomeFeed({ mode, loading, error, videos, onRecommend, onPopular }: HomeFeedProps) {
  return (
    <section className="bili-feed-panel">
      <div className="bili-feed-heading">
        <HomeFeedTabs mode={mode} loading={loading} onRecommend={onRecommend} onPopular={onPopular} />
        <span>{loading ? "加载中" : `${videos.length} 条`}</span>
      </div>
      {mode === "search" ? <div className="bili-feed-context">搜索结果</div> : null}
      {error ? <div className="bili-state bili-state-error">{error}</div> : null}
      {!error && loading ? <div className="bili-state">正在加载视频</div> : null}
      {!error && !loading && videos.length === 0 ? <div className="bili-state">暂无视频</div> : null}
      {!error && videos.length > 0 ? (
        <div className="bili-video-grid">
          {videos.map((video) => (
            <VideoCard key={`${video.bvid}-${video.cid || video.aid}`} video={video} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
