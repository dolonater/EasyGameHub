import React, { useEffect, useState } from "sdk";
import { errorMessage, getState } from "../runtime";
import type { BiliVideoCard } from "../types";
import { VideoCard } from "./VideoCard";

interface RelatedPanelProps {
  bvid?: string;
  aid?: number;
}

/**
 * 播放页右侧"相关推荐"。独立取 sdk.bilibili.video.related，失败只显示空态，不阻塞播放页。
 */
export function RelatedPanel({ bvid, aid }: RelatedPanelProps) {
  const [items, setItems] = useState<BiliVideoCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const sdk = getState().sdk;
    if (!sdk || (!bvid && !aid)) return;
    setLoading(true);
    setError("");
    sdk.bilibili.video
      .related({ bvid, aid })
      .then((next) => {
        if (active) setItems(next);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [aid, bvid]);

  if (error || (!loading && items.length === 0)) {
    return (
      <section className="bili-sidebar-section">
        <div className="bili-section-title">
          <strong>相关推荐</strong>
          <small>暂无</small>
        </div>
        <span className="bili-feed-context">暂无可推荐视频</span>
      </section>
    );
  }

  return (
    <section className="bili-sidebar-section">
      <div className="bili-section-title">
        <strong>相关推荐</strong>
        <small>{items.length} 条</small>
      </div>
      <div className="bili-related-list">
        {items.map((video) => (
          <VideoCard key={`${video.bvid}-${video.cid || video.aid}`} video={video} />
        ))}
      </div>
    </section>
  );
}
