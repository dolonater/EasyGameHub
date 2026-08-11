import React from "sdk";
import type { BiliVideoCard } from "../types";
import { VideoCard } from "./VideoCard";
import { HomeFeedTabs } from "./HomeFeedTabs";
import { HotRow } from "./HotRow";

interface HomeFeedProps {
  mode: "recommend" | "popular" | "search";
  loading: boolean;
  error: string;
  videos: BiliVideoCard[];
  /** 搜索 Tab 但还没有已提交关键词：显示引导空态 */
  searchGuide: boolean;
  onRecommend(): void;
  onPopular(): void;
  onSearch(): void;
}

export function HomeFeed({
  mode,
  loading,
  error,
  videos,
  searchGuide,
  onRecommend,
  onPopular,
  onSearch,
}: HomeFeedProps) {
  return (
    <section className="bili-feed-panel">
      <div className="bili-feed-heading">
        <HomeFeedTabs
          mode={mode}
          loading={loading}
          onRecommend={onRecommend}
          onPopular={onPopular}
          onSearch={onSearch}
        />
        <span>{loading ? "加载中" : `${videos.length} 条`}</span>
      </div>

      <HotRow />

      {searchGuide ? (
        <div className="bili-state">输入关键词开始搜索</div>
      ) : (
        <>
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
        </>
      )}
    </section>
  );
}
