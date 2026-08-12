import React from "sdk";
import { openDynDetail, openWatch } from "../navigation";
import type { BiliDynamicCard, BiliDynamicLive, BiliDynamicVideo } from "../types";
import { BiliImage } from "./BiliImage";

interface DynamicCardProps {
  card: BiliDynamicCard;
  /** 点赞开关回调（乐观更新由父级处理），返回 Promise 用于回滚 */
  onLike(card: BiliDynamicCard, liked: boolean): Promise<void> | void;
  /** 视频卡片点击（默认 openWatch，空间场景可覆盖为占位） */
  onOpenVideo?(card: BiliDynamicCard): void;
  /** 隐藏卡片内图片（详情页用大图网格替代，避免重复显示） */
  hideImages?: boolean;
}

export function DynamicCard({ card, onLike, onOpenVideo, hideImages }: DynamicCardProps) {
  const [liking, setLiking] = React.useState(false);

  function openCard() {
    // 无 dyn_id 的卡片（部分转发原文等）不可跳详情
    if (!card.dynId && card.cardType !== "video") return;
    if (card.cardType === "video") {
      if (onOpenVideo) {
        onOpenVideo(card);
      } else if (card.video?.bvid) {
        openWatch({ name: "watch", bvid: card.video.bvid, aid: card.video.aid || undefined, cid: 0 });
      }
      return;
    }
    openDynDetail(card.dynId);
  }

  function toggleLike(event: any) {
    event.stopPropagation();
    if (liking) return;
    setLiking(true);
    Promise.resolve(onLike(card, !card.liked)).finally(() => setLiking(false));
  }

  return (
    <article className="bili-dynamic-card" onClick={openCard}>
      <header className="bili-dynamic-head">
        <BiliImage className="bili-dynamic-avatar" src={card.face} alt={card.name} />
        <div className="bili-dynamic-meta">
          <strong>{card.name}</strong>
          <small>{card.pubTime}</small>
        </div>
        {card.isTop ? <span className="bili-dynamic-top-badge">置顶</span> : null}
      </header>

      {card.content ? <p className="bili-dynamic-text">{card.content}</p> : null}

      {card.cardType === "video" && card.video ? <VideoBody video={card.video} /> : null}
      {card.cardType === "image" && card.images.length > 0 && !hideImages ? (
        <ImageBody images={card.images} />
      ) : null}
      {card.cardType === "live" && card.live ? <LiveBody live={card.live} /> : null}
      {card.cardType === "forward" && card.forward ? <ForwardBody card={card.forward} /> : null}

      <footer className="bili-dynamic-stats">
        <button className="bili-dynamic-stat" type="button" onClick={toggleLike} disabled={liking}>
          {card.liked ? "已赞" : "点赞"} {card.likeCount > 0 ? formatCount(card.likeCount) : ""}
        </button>
        <span className="bili-dynamic-stat">{card.commentCount > 0 ? `${formatCount(card.commentCount)} 评论` : "评论"}</span>
        <span className="bili-dynamic-stat">{card.forwardCount > 0 ? `${formatCount(card.forwardCount)} 转发` : "转发"}</span>
      </footer>
    </article>
  );
}

function VideoBody({ video }: { video: BiliDynamicVideo }) {
  return (
    <div className="bili-dynamic-video">
      {video.cover ? <BiliImage className="bili-dynamic-video-cover" src={video.cover} loading="lazy" /> : null}
      <div className="bili-dynamic-video-info">
        <strong title={video.title}>{video.title || "视频"}</strong>
        <small>{video.durationText}</small>
        {video.play > 0 ? <small>{formatCount(video.play)} 播放</small> : null}
      </div>
    </div>
  );
}

function ImageBody({ images }: { images: string[] }) {
  return (
    <div className={`bili-dynamic-images bili-dynamic-images-${Math.min(images.length, 3)}`}>
      {images.slice(0, 9).map((src, index) => (
        <BiliImage key={`${src}-${index}`} className="bili-dynamic-image" src={src} loading="lazy" />
      ))}
    </div>
  );
}

function LiveBody({ live }: { live: BiliDynamicLive }) {
  return (
    <div className="bili-dynamic-live">
      {live.cover ? <BiliImage className="bili-dynamic-live-cover" src={live.cover} loading="lazy" /> : null}
      <div className="bili-dynamic-live-info">
        <span className="bili-dynamic-live-badge">直播中</span>
        <strong title={live.title}>{live.title || "直播中"}</strong>
        <small>{live.areaName}</small>
      </div>
    </div>
  );
}

function ForwardBody({ card }: { card: BiliDynamicCard }) {
  return (
    <div className="bili-dynamic-forward">
      <div className="bili-dynamic-forward-head">
        <BiliImage className="bili-dynamic-avatar bili-dynamic-avatar-sm" src={card.face} alt={card.name} />
        <strong>{card.name}</strong>
      </div>
      {card.content ? <p className="bili-dynamic-forward-text">{card.content}</p> : null}
      {card.cardType === "video" && card.video ? <VideoBody video={card.video} /> : null}
      {card.cardType === "image" && card.images.length > 0 ? <ImageBody images={card.images} /> : null}
    </div>
  );
}

function formatCount(value: number): string {
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)} 亿`;
  if (value >= 10000) return `${(value / 10000).toFixed(1)} 万`;
  return String(value);
}
