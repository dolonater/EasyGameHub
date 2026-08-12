import React, { Button, useEffect, useRef, useState } from "sdk";
import type { BiliDynamicCard, BiliUserSpace, BiliVideoCard } from "../types";
import { errorMessage, getState } from "../runtime";
import { BiliImage } from "../components/BiliImage";
import { DynamicCard } from "../components/DynamicCard";
import { VideoCard } from "../components/VideoCard";

interface SpacePageProps {
  mid: number;
}

type SpaceTab = "videos" | "dynamics";

export function SpacePage({ mid }: SpacePageProps) {
  const [space, setSpace] = useState<BiliUserSpace | null>(null);
  const [videos, setVideos] = useState<BiliVideoCard[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [videosLoading, setVideosLoading] = useState(false);
  const [error, setError] = useState("");
  const [followBusy, setFollowBusy] = useState(false);
  const [tab, setTab] = useState<SpaceTab>("videos");
  const [dynamics, setDynamics] = useState<BiliDynamicCard[]>([]);
  const [dynOffset, setDynOffset] = useState("");
  const [dynHasMore, setDynHasMore] = useState(false);
  const [dynLoading, setDynLoading] = useState(false);
  const [topBusy, setTopBusy] = useState("");
  const dynSeqRef = useRef(0);

  const currentUid = Number(getState().loginInfo?.userId ?? 0);
  const isSelf = currentUid > 0 && currentUid === mid;

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

  useEffect(() => {
    if (tab !== "dynamics") return;
    const seq = dynSeqRef.current + 1;
    dynSeqRef.current = seq;
    setDynLoading(true);
    setError("");
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.dynamic
      .all({ hostMid: mid })
      .then((data) => {
        if (dynSeqRef.current !== seq) return;
        setDynamics(data.cards);
        setDynOffset(data.offset);
        setDynHasMore(data.hasMore);
      })
      .catch((reason: Error) => {
        if (dynSeqRef.current === seq) setError(errorMessage(reason));
      })
      .finally(() => {
        if (dynSeqRef.current === seq) setDynLoading(false);
      });
    return () => {
      dynSeqRef.current += 1;
    };
  }, [tab, mid]);

  function loadMoreDynamics() {
    if (dynLoading || !dynHasMore || !dynOffset) return;
    setDynLoading(true);
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.dynamic
      .all({ offset: dynOffset, hostMid: mid })
      .then((data) => {
        setDynamics((previous) => {
          const seen = new Set(previous.map((card) => card.dynId));
          return [...previous, ...data.cards.filter((card) => !seen.has(card.dynId))];
        });
        setDynOffset(data.offset);
        setDynHasMore(data.hasMore);
      })
      .catch((reason: Error) => setError(errorMessage(reason)))
      .finally(() => setDynLoading(false));
  }

  function handleLike(card: BiliDynamicCard, liked: boolean) {
    const previous = card;
    setDynamics((current) =>
      current.map((item) =>
        item.dynId === card.dynId
          ? { ...item, liked, likeCount: Math.max(0, item.likeCount + (liked ? 1 : -1)) }
          : item,
      ),
    );
    const sdk = getState().sdk;
    if (!sdk) return Promise.resolve();
    return sdk.bilibili.dynamic
      .like({ dynId: card.dynId, like: liked })
      .then((result) => {
        if (!result.ok) throw new Error(result.message || "点赞失败");
      })
      .catch((reason: Error) => {
        setDynamics((current) => current.map((item) => (item.dynId === card.dynId ? previous : item)));
        setError(errorMessage(reason));
      });
  }

  function toggleTop(card: BiliDynamicCard) {
    if (topBusy) return;
    setTopBusy(card.dynId);
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.dynamic
      .top({ dynId: card.dynId, top: !card.isTop })
      .then((result) => {
        if (!result.ok) throw new Error(result.message || "置顶失败");
        setDynamics((current) =>
          current.map((item) => (item.dynId === card.dynId ? { ...item, isTop: !card.isTop } : item)),
        );
        sdk.ui.notify(card.isTop ? "已取消置顶" : "已置顶");
      })
      .catch((reason: Error) => {
        setError(errorMessage(reason));
      })
      .finally(() => setTopBusy(""));
  }

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
  if (error && !space) return <div className="bili-state bili-state-error">{error}</div>;
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

      <div className="bili-space-tabs">
        <button
          type="button"
          className={`bili-space-tab ${tab === "videos" ? "bili-space-tab-active" : ""}`}
          onClick={() => setTab("videos")}
        >
          投稿
        </button>
        <button
          type="button"
          className={`bili-space-tab ${tab === "dynamics" ? "bili-space-tab-active" : ""}`}
          onClick={() => setTab("dynamics")}
        >
          动态
        </button>
      </div>

      {tab === "videos" ? (
        <>
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
        </>
      ) : (
        <div className="bili-dynamic-page">
          {error ? <div className="bili-state bili-state-error">{error}</div> : null}
          {dynLoading && dynamics.length === 0 ? <div className="bili-state">正在加载动态</div> : null}
          {dynamics.map((card) => (
            <div className="bili-dynamic-card-wrap" key={card.dynId}>
              <DynamicCard card={card} onLike={handleLike} />
              {isSelf ? (
                <button
                  type="button"
                  className="bili-dynamic-top-button"
                  disabled={topBusy === card.dynId}
                  onClick={() => toggleTop(card)}
                >
                  {card.isTop ? "取消置顶" : "置顶"}
                </button>
              ) : null}
            </div>
          ))}
          {dynamics.length === 0 && !dynLoading ? <div className="bili-state">暂无动态</div> : null}
          {dynHasMore ? (
            <button type="button" className="bili-dynamic-load-more" onClick={loadMoreDynamics} disabled={dynLoading}>
              {dynLoading ? "正在加载" : "加载更多"}
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}

function formatCount(value: number): string {
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)} 亿`;
  if (value >= 10000) return `${(value / 10000).toFixed(1)} 万`;
  return String(value);
}
