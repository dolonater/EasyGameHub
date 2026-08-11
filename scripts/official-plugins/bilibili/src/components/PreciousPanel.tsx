import React, { useEffect, useState } from "sdk";
import type { BiliVideoCard } from "../types";
import { getState } from "../runtime";
import { VideoCard } from "./VideoCard";

export function PreciousPanel() {
  const [title, setTitle] = useState("");
  const [explain, setExplain] = useState("");
  const [videos, setVideos] = useState<BiliVideoCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.ranking
      .precious()
      .then((data) => {
        if (!cancelled) {
          setTitle(data.title);
          setExplain(data.explain);
          setVideos(data.videos);
          setLoading(false);
        }
      })
      .catch((reason: Error) => {
        if (!cancelled) {
          setError(reason.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="bili-rank-panel">
      {title ? (
        <div className="bili-precious-head">
          <div className="bili-precious-title">{title}</div>
          {explain ? <div className="bili-precious-explain">{explain}</div> : null}
        </div>
      ) : null}
      {error ? <div className="bili-state bili-state-error">{error}</div> : null}
      {!error && loading ? <div className="bili-state">正在加载入站必刷</div> : null}
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
