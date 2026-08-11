import React, { Button, useEffect, useState } from "sdk";
import type { BiliSeasonDetail } from "../types";
import { errorMessage, getState } from "../runtime";
import { openWatch } from "../navigation";
import { BiliImage } from "../components/BiliImage";

interface SeasonPageProps {
  seasonId: number;
}

export function SeasonPage({ seasonId }: SeasonPageProps) {
  const [detail, setDetail] = useState<BiliSeasonDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.season
      .detail({ seasonId })
      .then((data) => {
        if (!cancelled) {
          setDetail(data);
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
  }, [seasonId]);

  function toggleFollow() {
    if (!detail) return;
    setFollowBusy(true);
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.season
      .follow({ seasonId: detail.seasonId, follow: !detail.isFollowed })
      .then(() => {
        setDetail({ ...detail, isFollowed: !detail.isFollowed });
      })
      .catch((reason: Error) => {
        setError(errorMessage(reason));
      })
      .finally(() => {
        setFollowBusy(false);
      });
  }

  if (loading) return <div className="bili-state">正在加载番剧详情</div>;
  if (error) return <div className="bili-state bili-state-error">{error}</div>;
  if (!detail) return <div className="bili-state">暂无番剧信息</div>;

  return (
    <section className="bili-season-page">
      <div className="bili-season-header">
        <BiliImage className="bili-season-cover" src={detail.cover} alt={detail.title} />
        <div className="bili-season-info">
          <div className="bili-season-title">{detail.title}</div>
          <div className="bili-season-meta">
            {detail.score != null ? <span>评分 {detail.score.score.toFixed(1)}（{detail.score.count} 人）</span> : null}
            {detail.newEp ? <span>最新：{detail.newEp}</span> : null}
            <span>共 {detail.total} 集</span>
          </div>
          {detail.evaluate ? <div className="bili-season-evaluate">{detail.evaluate}</div> : null}
          <div>
            <Button variant="outline" size="sm" type="button" onClick={toggleFollow} disabled={followBusy}>
              {detail.isFollowed ? "已追番" : "追番"}
            </Button>
          </div>
        </div>
      </div>

      <div className="bili-season-section-title">选集</div>
      <div className="bili-season-episodes">
        {detail.episodes.map((episode) => (
          <button
            key={episode.epId}
            type="button"
            className="bili-season-episode"
            onClick={() =>
              openWatch({
                name: "watch",
                type: "season",
                bvid: episode.bvid,
                aid: episode.aid,
                cid: episode.cid,
                seasonId: detail.seasonId,
                epId: episode.epId,
              })
            }
          >
            <span className="bili-season-episode-title">{episode.longTitle || episode.title || `ep${episode.epId}`}</span>
            <span className="bili-season-episode-duration">{formatDuration(episode.duration)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const hour = Math.floor(safe / 3600);
  const minute = Math.floor((safe % 3600) / 60);
  const second = safe % 60;
  if (hour > 0) return `${hour}:${pad(minute)}:${pad(second)}`;
  return `${minute}:${pad(second)}`;
}

function pad(value: number) {
  return value.toString().padStart(2, "0");
}
