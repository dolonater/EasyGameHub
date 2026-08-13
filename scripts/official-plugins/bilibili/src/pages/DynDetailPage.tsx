import React, { useEffect, useRef, useState } from "sdk";
import type { BiliDynamicCard, BiliDynamicForwardEntry, BiliVideoDetail } from "../types";
import { CommentPanel } from "../components/CommentPanel";
import { DynamicCard } from "../components/DynamicCard";
import { BiliImage } from "../components/BiliImage";
import { ImagePreview } from "../components/ImagePreview";
import { openArticle } from "../navigation";
import { errorMessage, getState } from "../runtime";

interface DynDetailPageProps {
  dynId: string;
}

/** 动态详情视图：正文全文 + 图片大图浏览 + 点赞/转发数 + 转发列表（懒加载）+ 评论区（type=17）。 */
export function DynDetailPage({ dynId }: DynDetailPageProps) {
  const [card, setCard] = useState<BiliDynamicCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forwards, setForwards] = useState<BiliDynamicForwardEntry[]>([]);
  const [forwardsOffset, setForwardsOffset] = useState("");
  const [forwardsLoading, setForwardsLoading] = useState(false);
  const [forwardsHasMore, setForwardsHasMore] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    const seq = requestSeqRef.current + 1;
    requestSeqRef.current = seq;
    setLoading(true);
    setError("");
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.dynamic
      .detail({ dynId })
      .then((data) => {
        if (requestSeqRef.current !== seq) return;
        setCard(data);
        // 转发动态已内嵌原文时不重复拉转发列表；其余动态懒加载转发列表
        if (!data.forward) loadForwards("", true);
      })
      .catch((reason: Error) => {
        if (requestSeqRef.current !== seq) return;
        setError(errorMessage(reason));
      })
      .finally(() => {
        if (requestSeqRef.current === seq) setLoading(false);
      });
    return () => {
      requestSeqRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dynId]);

  function loadForwards(offset: string, reset: boolean) {
    if (forwardsLoading) return;
    setForwardsLoading(true);
    const sdk = getState().sdk;
    if (!sdk) {
      setForwardsLoading(false);
      return;
    }
    sdk.bilibili.dynamic
      .forwards({ dynId, offset: offset || undefined })
      .then((page) => {
        if (reset) setForwards(page.entries);
        else setForwards((previous) => [...previous, ...page.entries]);
        setForwardsOffset(page.offset);
        setForwardsHasMore(page.hasMore);
      })
      .catch((reason: Error) => setError(errorMessage(reason)))
      .finally(() => setForwardsLoading(false));
  }

  function handleLike(target: BiliDynamicCard, liked: boolean) {
    const previous = card;
    if (!card) return Promise.resolve();
    setCard({ ...card, liked, likeCount: Math.max(0, card.likeCount + (liked ? 1 : -1)) });
    const sdk = getState().sdk;
    if (!sdk) return Promise.resolve();
    return sdk.bilibili.dynamic
      .like({ dynId: target.dynId, like: liked })
      .then((result) => {
        if (!result.ok) throw new Error(result.message || "点赞失败");
      })
      .catch((reason: Error) => {
        if (previous) setCard(previous);
        sdk.ui.notify(errorMessage(reason));
      });
  }

  if (loading) return <div className="bili-state">正在加载动态</div>;
  if (error && !card) return <div className="bili-state bili-state-error">{error}</div>;
  if (!card) return <div className="bili-state">动态不存在或已删除</div>;

  const images = card.images;

  return (
    <section className="bili-dyn-detail">
      <div className="bili-dyn-detail-card">
        <DynamicCard card={card} onLike={handleLike} onOpenVideo={() => undefined} hideImages />
        {card.cardType === "article" && card.articleId ? (
          <button type="button" className="bili-dyn-article-read" onClick={() => openArticle(card.articleId)}>
            阅读全文（CV{card.articleId}）
          </button>
        ) : null}
        {images.length > 0 ? (
          <div className="bili-dyn-detail-images">
            {images.map((src, index) => (
              <button
                className="bili-dyn-detail-image-wrap"
                key={`${src}-${index}`}
                type="button"
                onClick={() => setPreviewIndex(index)}
              >
                <BiliImage className="bili-dyn-detail-image" src={src} loading="lazy" />
              </button>
            ))}
          </div>
        ) : null}
        {card.forward ? (
          <div className="bili-dyn-detail-forward">
            <div className="bili-dyn-detail-section-title">转发的动态</div>
            <DynamicCard card={card.forward} onLike={() => Promise.resolve()} onOpenVideo={() => undefined} />
          </div>
        ) : null}
      </div>

      {forwardsHasMore || forwards.length > 0 ? (
        <div className="bili-dyn-detail-section-title">转发列表</div>
      ) : null}
      {forwards.length > 0 ? (
        <div className="bili-dyn-forwards">
          {forwards.map((entry) => (
            <div className="bili-dyn-forward-entry" key={entry.dynId}>
              <BiliImage className="bili-dynamic-avatar bili-dynamic-avatar-sm" src={entry.face} alt={entry.name} />
              <div className="bili-dyn-forward-entry-body">
                <strong>{entry.name}</strong>
                <small>{entry.pubTime}</small>
                <p>{entry.content}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {forwardsHasMore ? (
        <button
          type="button"
          className="bili-dynamic-load-more"
          onClick={() => loadForwards(forwardsOffset, false)}
          disabled={forwardsLoading}
        >
          {forwardsLoading ? "正在加载" : "加载更多转发"}
        </button>
      ) : null}

      <div className="bili-dyn-detail-section-title">评论</div>
      <CommentPanel
        detail={emptyDetail}
        loggedIn={Boolean(getState().loginInfo?.loggedIn)}
        sdk={getState().sdk}
        oid={card.commentId || dynId}
        type={card.commentType || 17}
      />

      {previewIndex !== null ? (
        <ImagePreview
          images={images}
          index={previewIndex}
          onClose={() => setPreviewIndex(null)}
          onIndexChange={setPreviewIndex}
        />
      ) : null}
    </section>
  );
}

/** CommentPanel 需要 BiliVideoDetail 结构，动态场景字段全空（oid/type 由 props 覆盖） */
const emptyDetail: BiliVideoDetail = {
  aid: 0,
  bvid: "",
  cid: 0,
  title: "",
  cover: "",
  description: "",
  duration: 0,
  owner: { mid: 0, name: "", face: "" },
  stats: { viewCount: 0, danmakuCount: 0, replyCount: 0, favoriteCount: 0, coinCount: 0, shareCount: 0, likeCount: 0 },
  pages: [],
  publishedAt: 0,
};
