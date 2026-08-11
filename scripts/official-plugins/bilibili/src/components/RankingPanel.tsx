import React, { useEffect, useState } from "sdk";
import type { BiliVideoCard } from "../types";
import { getState } from "../runtime";
import { VideoCard } from "./VideoCard";

/** 常用分区 rid：全站 + 各主分区（数值即 /x/web-interface/ranking/v2 的 rid） */
const RIDS: Array<{ rid: number; name: string }> = [
  { rid: 0, name: "全站" },
  { rid: 1, name: "动画" },
  { rid: 3, name: "音乐" },
  { rid: 129, name: "舞蹈" },
  { rid: 4, name: "游戏" },
  { rid: 36, name: "知识" },
  { rid: 188, name: "科技" },
  { rid: 234, name: "运动" },
  { rid: 223, name: "汽车" },
  { rid: 160, name: "生活" },
  { rid: 211, name: "美食" },
  { rid: 217, name: "动物圈" },
  { rid: 119, name: "鬼畜" },
  { rid: 155, name: "时尚" },
  { rid: 5, name: "娱乐" },
  { rid: 181, name: "影视" },
];

export function RankingPanel() {
  const [rid, setRid] = useState(0);
  const [videos, setVideos] = useState<BiliVideoCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.ranking
      .videos(rid)
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
  }, [rid]);

  return (
    <section className="bili-rank-panel">
      <div className="bili-rank-rids">
        {RIDS.map((item) => (
          <button
            key={item.rid}
            type="button"
            className={rid === item.rid ? "bili-rank-rid bili-rank-rid-active" : "bili-rank-rid"}
            onClick={() => setRid(item.rid)}
          >
            {item.name}
          </button>
        ))}
      </div>
      {error ? <div className="bili-state bili-state-error">{error}</div> : null}
      {!error && loading ? <div className="bili-state">正在加载排行榜</div> : null}
      {!error && !loading && videos.length === 0 ? <div className="bili-state">暂无榜单数据</div> : null}
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
