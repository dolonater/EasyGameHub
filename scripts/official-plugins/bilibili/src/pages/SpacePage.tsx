import React, { Button, useEffect, useState } from "sdk";
import type { BiliUserSpace, BiliVideoCard } from "../types";
import { errorMessage, getState } from "../runtime";
import { BiliImage } from "../components/BiliImage";
import { VideoCard } from "../components/VideoCard";

interface SpacePageProps {
  mid: number;
}

export function SpacePage({ mid }: SpacePageProps) {
  const [space, setSpace] = useState<BiliUserSpace | null>(null);
  const [videos, setVideos] = useState<BiliVideoCard[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [videosLoading, setVideosLoading] = useState(false);
  const [error, setError] = useState("");
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.user
      .space({ mid })
      .then((data) => {
        if (!cancelled) {
          setSpace(data);
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
  }, [mid]);

  useEffect(() => {
    let cancelled = false;
    setVideosLoading(true);
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.user
      .videos({ mid, page })
      .then((data) => {
        if (!cancelled) {
          setVideos((previous) => (page === 1 ? data : [...previous, ...data]));
          setVideosLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setVideosLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mid, page]);

  function toggleFollow() {
    if (!space) return;
    setFollowBusy(true);
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.user
      .follow({ mid, follow: !space.isFollowed })
      .then(() => {
        setSpace({ ...space, isFollowed: !space.isFollowed });
      })
      .catch((reason: Error) => {
        setError(errorMessage(reason));
      })
      .finally(() => {
        setFollowBusy(false);
      });
  }

  if (loading) return <div className="bili-state">正在加载 UP 主页</div>;
  if (error) return <div className="bili-state bili-state-error">{error}</div>;
  if (!space) return <div className="bili-state">暂无 UP 信息</div>;

  return (
    <section className="bili-space">
      <div className="bili-space-card">
        <BiliImage className="bili-space-avatar" src={space.face} alt={space.name} />
        <div className="bili-space-info">
          <div className="bili-space-name">
            {space.name}
            <span className="bili-space-level">Lv.{space.level}</span>
            {space.liveRoom && space.liveRoom.liveStatus === 1 ? (
              <span className="bili-space-live">直播中</span>
            ) : null}
          </div>
          <div className="bili-space-sign">{space.sign || "这个人很懒，什么都没写"}</div>
          <div className="bili-space-stats">
            <span>视频 {space.archiveCount}</span>
            <span>播放 {formatCount(space.view)}</span>
            <span>粉丝 {formatCount(space.fans)}</span>
            <span>获赞 {formatCount(space.likes)}</span>
          </div>
        </div>
        <Button variant="outline" size="sm" type="button" onClick={toggleFollow} disabled={followBusy}>
          {space.isFollowed ? "已关注" : "关注"}
        </Button>
      </div>

      <div className="bili-space-section-title">投稿视频</div>
      {videos.length === 0 && videosLoading ? <div className="bili-state">正在加载视频</div> : null}
      {videos.length > 0 ? (
        <>
          <div className="bili-video-grid">
            {videos.map((video) => (
              <VideoCard key={`${video.bvid}-${video.aid}`} video={video} />
            ))}
          </div>
          {videosLoading ? (
            <div className="bili-state">正在加载更多</div>
          ) : (
            <button type="button" className="bili-space-load-more" onClick={() => setPage((previous) => previous + 1)}>
              加载更多
            </button>
          )}
        </>
      ) : null}
    </section>
  );
}

function formatCount(value: number): string {
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)} 亿`;
  if (value >= 10000) return `${(value / 10000).toFixed(1)} 万`;
  return String(value);
}
