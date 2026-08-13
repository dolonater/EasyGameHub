import React, { useState } from "sdk";
import { openArticle, openDynDetail, openLive, openWatch } from "../navigation";
import { getState } from "../runtime";
import type { BiliDynamicCard, BiliDynamicLive, BiliDynamicVideo } from "../types";
import { BiliImage } from "./BiliImage";
import { ImagePreview } from "./ImagePreview";

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
  const [liking, setLiking] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  function openCard() {
    // 无 dyn_id 的卡片（部分转发原文等）不可跳详情
    if (!card.dynId && card.cardType !== "video" && card.cardType !== "live" && card.cardType !== "article") return;
    if (card.cardType === "video") {
      if (onOpenVideo) {
        onOpenVideo(card);
      } else if (card.video?.bvid) {
        openWatch({ name: "watch", bvid: card.video.bvid, aid: card.video.aid || undefined, cid: 0 });
      }
      return;
    }
    // 直播卡片直接进直播间（P6）
    if (card.cardType === "live" && card.live?.roomId) {
      openLive(card.live.roomId);
      return;
    }
    // 专栏动态直接进专栏阅读页（P8）；无 cvid 时先查动态详情拿 cvid
    if (card.cardType === "article") {
      if (card.articleId) {
        openArticle(card.articleId);
        return;
      }
      const sdk = getState().sdk;
      if (sdk && card.dynId) {
        sdk.bilibili.dynamic
          .detail({ dynId: card.dynId })
          .then((detailCard) => {
            if (detailCard.articleId) openArticle(detailCard.articleId);
            else openDynDetail(card.dynId);
          })
          .catch(() => openDynDetail(card.dynId));
        return;
      }
      openDynDetail(card.dynId);
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
        <ImageBody images={card.images} onPreview={setPreviewIndex} />
      ) : null}
      {card.cardType === "live" && card.live ? <LiveBody live={card.live} /> : null}
      {card.cardType === "article" ? <ArticleBody card={card} /> : null}
      {card.cardType === "forward" && card.forward ? <ForwardBody card={card.forward} /> : null}

      {previewIndex !== null ? (
        <ImagePreview
          images={card.images}
          index={previewIndex}
          onClose={() => setPreviewIndex(null)}
          onIndexChange={setPreviewIndex}
        />
      ) : null}

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

function ImageBody({ images, onPreview }: { images: string[]; onPreview(index: number): void }) {
  return (
    <div className={`bili-dynamic-images bili-dynamic-images-${Math.min(images.length, 3)}`}>
      {images.slice(0, 9).map((src, index) => (
        <button
          className="bili-dynamic-image-wrap"
          key={`${src}-${index}`}
          type="button"
          onClick={(event: any) => {
            event.stopPropagation();
            onPreview(index);
          }}
        >
          <BiliImage className="bili-dynamic-image" src={src} loading="lazy" />
        </button>
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
      {card.cardType === "article" ? <ArticleBody card={card} /> : null}
    </div>
  );
}

/** 专栏动态卡片体（P8）：标题 + 摘要 + 封面 + "阅读全文"徽标，点击进专栏阅读页 */
function ArticleBody({ card }: { card: BiliDynamicCard }) {
  return (
    <div className="bili-dynamic-article">
      {card.images.length > 0 ? (
        <div className="bili-dynamic-article-cover">
          <BiliImage src={card.images[0]} loading="lazy" alt="" />
        </div>
      ) : null}
      <div className="bili-dynamic-article-info">
        <span className="bili-dynamic-article-badge">专栏</span>
        <strong title={card.title || card.content}>{card.title || card.content || "专栏文章"}</strong>
        {card.content && card.title ? <small className="bili-dynamic-article-desc">{card.content}</small> : null}
        {card.articleId ? <small>CV{card.articleId} · 点击阅读全文</small> : null}
      </div>
    </div>
  );
}

function formatCount(value: number): string {
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)} 亿`;
  if (value >= 10000) return `${(value / 10000).toFixed(1)} 万`;
  return String(value);
}
