import React from "sdk";
import type { BiliVideoCard } from "../types";
import { VideoCard } from "./VideoCard";

interface HomeFeedProps {
  loading: boolean;
  error: string;
  videos: BiliVideoCard[];
  /** 搜索 Tab 但还没有已提交关键词：显示引导空态（可自定义内容） */
  searchGuide: boolean;
  /** 搜索空态的自定义内容（热搜/历史面板）；缺省显示引导文案 */
  searchEmpty?: unknown;
  /** 追番/影视/直播占位提示（P2/P6 填充后移除） */
  comingSoon?: boolean;
}

export function HomeFeed({ loading, error, videos, searchGuide, searchEmpty, comingSoon }: HomeFeedProps) {
  return (
    <section className="bili-feed-panel">
      {comingSoon ? (
        <div className="bili-state">功能开发中，敬请期待</div>
      ) : searchGuide ? (
        searchEmpty ?? <div className="bili-state">输入关键词开始搜索</div>
      ) : (
        <>
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

