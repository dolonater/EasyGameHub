import React, { useEffect, useState } from "sdk";
import type { BiliPgcCard, BiliVideoCard } from "../types";
import { errorMessage, getState } from "../runtime";
import { PgcCard } from "./PgcCard";
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

/** PGC 榜 season_type：1=番剧 2=电影 3=纪录片 4=国创 5=电视剧 7=综艺 */
const PGC_TYPES: Array<{ type: number; name: string }> = [
  { type: 1, name: "番剧" },
  { type: 4, name: "国创" },
  { type: 2, name: "电影" },
  { type: 5, name: "电视剧" },
  { type: 3, name: "纪录片" },
  { type: 7, name: "综艺" },
];

type RankTab = "video" | "pgc";

export function RankingPanel() {
  const [tab, setTab] = useState<RankTab>("video");
  const [rid, setRid] = useState(0);
  const [videos, setVideos] = useState<BiliVideoCard[]>([]);
  const [pgcType, setPgcType] = useState(1);
  const [pgcVideos, setPgcVideos] = useState<BiliPgcCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (tab !== "video") return;
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
          setError(errorMessage(reason));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tab, rid]);

  useEffect(() => {
    if (tab !== "pgc") return;
    let cancelled = false;
    setLoading(true);
    setError("");
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.season
      .pgcRank({ seasonType: pgcType })
      .then((data) => {
        if (!cancelled) {
          setPgcVideos(data);
          setLoading(false);
        }
      })
      .catch((reason: Error) => {
        if (!cancelled) {
          setError(errorMessage(reason));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tab, pgcType]);

  return (
    <section className="bili-rank-panel">
      <div className="bili-rank-tabs">
        <button
          type="button"
          className={tab === "video" ? "bili-rank-rid bili-rank-rid-active" : "bili-rank-rid"}
          onClick={() => setTab("video")}
        >
          视频榜
        </button>
        <button
          type="button"
          className={tab === "pgc" ? "bili-rank-rid bili-rank-rid-active" : "bili-rank-rid"}
          onClick={() => setTab("pgc")}
        >
          PGC 榜
        </button>
      </div>
      {tab === "video" ? (
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
      ) : (
        <div className="bili-rank-rids">
          {PGC_TYPES.map((item) => (
            <button
              key={item.type}
              type="button"
              className={pgcType === item.type ? "bili-rank-rid bili-rank-rid-active" : "bili-rank-rid"}
              onClick={() => setPgcType(item.type)}
            >
              {item.name}
            </button>
          ))}
        </div>
      )}
      {error ? <div className="bili-state bili-state-error">{error}</div> : null}
      {!error && loading ? <div className="bili-state">正在加载排行榜</div> : null}
      {!error && !loading && tab === "video" && videos.length === 0 ? (
        <div className="bili-state">暂无榜单数据</div>
      ) : null}
      {!error && !loading && tab === "pgc" && pgcVideos.length === 0 ? (
        <div className="bili-state">暂无榜单数据</div>
      ) : null}
      {!error && tab === "video" && videos.length > 0 ? (
        <div className="bili-video-grid">
          {videos.map((video) => (
            <VideoCard key={`${video.bvid}-${video.cid || video.aid}`} video={video} />
          ))}
        </div>
      ) : null}
      {!error && tab === "pgc" && pgcVideos.length > 0 ? (
        <div className="bili-pgc-track bili-pgc-track-wrap">
          {pgcVideos.map((card) => (
            <PgcCard key={`${card.seasonId}-${card.seasonType}`} card={card} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
