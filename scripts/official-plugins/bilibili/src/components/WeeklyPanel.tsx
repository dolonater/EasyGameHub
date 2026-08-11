import React, { useEffect, useState } from "sdk";
import type { BiliVideoCard, BiliWeeklySeries } from "../types";
import { getState } from "../runtime";
import { VideoCard } from "./VideoCard";

export function WeeklyPanel() {
  const [series, setSeries] = useState<BiliWeeklySeries[]>([]);
  const [number, setNumber] = useState<number | null>(null);
  const [videos, setVideos] = useState<BiliVideoCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.ranking
      .weeks()
      .then((data) => {
        if (!cancelled) {
          setSeries(data);
          setNumber((previous) => previous ?? data[0]?.number ?? null);
        }
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (number == null) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.ranking
      .weekDetail(number)
      .then((data) => {
        if (!cancelled) {
          setVideos(data);
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
  }, [number]);

  return (
    <section className="bili-rank-panel">
      <div className="bili-rank-rids">
        {series.map((item) => (
          <button
            key={item.number}
            type="button"
            className={number === item.number ? "bili-rank-rid bili-rank-rid-active" : "bili-rank-rid"}
            onClick={() => setNumber(item.number)}
          >
            {item.name || `第 ${item.number} 期`}
          </button>
        ))}
      </div>
      {error ? <div className="bili-state bili-state-error">{error}</div> : null}
      {!error && loading ? <div className="bili-state">正在加载每周必看</div> : null}
      {!error && !loading && videos.length === 0 && number != null ? (
        <div className="bili-state">暂无视频</div>
      ) : null}
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
