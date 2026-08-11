import React from "sdk";
import { usePagedFeed } from "../hooks/usePagedFeed";
import { getState } from "../runtime";
import { VideoCard } from "./VideoCard";

const HOT_ROW_SIZE = 8;

/**
 * 首页顶部"热门精选"横向滚动行。
 * 独立取 popularVideos 第一页前 N 个，不依赖热门 Tab 实例；
 * 独立加载失败只隐藏该行，不阻塞主网格。
 */
export function HotRow() {
  const feed = usePagedFeed(
    (page, refresh) => {
      const sdk = getState().sdk;
      if (!sdk) return Promise.reject(new Error("Bilibili 插件尚未初始化"));
      return sdk.bilibili.home.popularVideos(page, refresh);
    },
    { key: "hotrow" },
  );

  if (feed.error || feed.items.length === 0) return null;

  return (
    <section className="bili-hot-row">
      <div className="bili-section-title">
        <strong>热门精选</strong>
        <small>热门视频 Top {Math.min(HOT_ROW_SIZE, feed.items.length)}</small>
      </div>
      <div className="bili-hot-track">
        {feed.items.slice(0, HOT_ROW_SIZE).map((video) => (
          <VideoCard key={`${video.bvid}-${video.cid || video.aid}`} video={video} />
        ))}
      </div>
    </section>
  );
}
