import React, { useEffect, useRef, useState } from "sdk";
import type { BiliDynamicCard } from "../types";
import { DynamicCard } from "../components/DynamicCard";
import { errorMessage, getState, subscribe } from "../runtime";

/**
 * 关注动态流：offset 游标分页（B 站动态 feed 非页码分页，不复用 usePagedFeed）。
 * 点赞乐观更新失败回滚；动态发布成功后重载首屏（订阅 runtime.dynamicPublished）。
 */
export function DynamicPage() {
  const [cards, setCards] = useState<BiliDynamicCard[]>([]);
  const [offset, setOffset] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [publishedVersion, setPublishedVersion] = useState(getState().dynamicPublished);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    const unsubscribe = subscribe(() => {
      const version = getState().dynamicPublished;
      if (version !== publishedVersion) {
        setPublishedVersion(version);
        reload();
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publishedVersion]);

  useEffect(() => {
    const seq = requestSeqRef.current + 1;
    requestSeqRef.current = seq;
    setLoading(true);
    setError("");
    const sdk = getState().sdk;
    if (!sdk) {
      setLoading(false);
      return;
    }
    sdk.bilibili.dynamic
      .all({})
      .then((page) => {
        if (requestSeqRef.current !== seq) return;
        setCards(page.cards);
        setOffset(page.offset);
        setHasMore(page.hasMore);
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
  }, []);

  function reload() {
    const seq = requestSeqRef.current + 1;
    requestSeqRef.current = seq;
    setLoading(true);
    setError("");
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.dynamic
      .all({})
      .then((page) => {
        if (requestSeqRef.current !== seq) return;
        setCards(page.cards);
        setOffset(page.offset);
        setHasMore(page.hasMore);
      })
      .catch((reason: Error) => {
        if (requestSeqRef.current === seq) setError(errorMessage(reason));
      })
      .finally(() => {
        if (requestSeqRef.current === seq) setLoading(false);
      });
  }

  function loadMore() {
    if (loadingMore || !hasMore || !offset) return;
    setLoadingMore(true);
    const sdk = getState().sdk;
    if (!sdk) {
      setLoadingMore(false);
      return;
    }
    sdk.bilibili.dynamic
      .all({ offset })
      .then((page) => {
        setCards((previous) => {
          const seen = new Set(previous.map((card) => card.dynId));
          return [...previous, ...page.cards.filter((card) => !seen.has(card.dynId))];
        });
        setOffset(page.offset);
        setHasMore(page.hasMore);
      })
      .catch((reason: Error) => setError(errorMessage(reason)))
      .finally(() => setLoadingMore(false));
  }

  function handleLike(card: BiliDynamicCard, liked: boolean) {
    const previous = card;
    setCards((current) =>
      current.map((item) =>
        item.dynId === card.dynId
          ? { ...item, liked, likeCount: Math.max(0, item.likeCount + (liked ? 1 : -1)) }
          : item,
      ),
    );
    const sdk = getState().sdk;
    if (!sdk) {
      rollback(card, previous);
      return Promise.reject(new Error("sdk 未就绪"));
    }
    return sdk.bilibili.dynamic
      .like({ dynId: card.dynId, like: liked })
      .then((result) => {
        if (!result.ok) throw new Error(result.message || "点赞失败");
      })
      .catch((reason: Error) => {
        rollback(card, previous);
        setError(errorMessage(reason));
      });
  }

  function rollback(card: BiliDynamicCard, previous: BiliDynamicCard) {
    setCards((current) =>
      current.map((item) => (item.dynId === card.dynId ? previous : item)),
    );
  }

  if (loading && cards.length === 0) return <div className="bili-state">正在加载动态</div>;
  if (error && cards.length === 0) return <div className="bili-state bili-state-error">{error}</div>;

  return (
    <section className="bili-dynamic-page">
      {cards.map((card) => (
        <DynamicCard key={card.dynId} card={card} onLike={handleLike} />
      ))}
      {cards.length === 0 && !loading ? (
        <div className="bili-state">暂无动态，关注一些 UP 主吧</div>
      ) : null}
      {error ? <div className="bili-state bili-state-error">{error}</div> : null}
      {hasMore ? (
        <button type="button" className="bili-dynamic-load-more" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? "正在加载" : "加载更多"}
        </button>
      ) : null}
    </section>
  );
}
