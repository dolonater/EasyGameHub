import React, { useEffect, useRef, useState } from "sdk";
import type { BiliMessageSession } from "../types";
import { errorMessage, getState } from "../runtime";
import { openChat } from "../navigation";
import { BiliImage } from "../components/BiliImage";

/** 私信会话列表：begin_ts 时间游标分页 + 未读角标，点击进入会话。 */
export function MessagesPage() {
  const [sessions, setSessions] = useState<BiliMessageSession[]>([]);
  const [beginTs, setBeginTs] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestSeqRef = useRef(0);

  useEffect(() => {
    const seq = requestSeqRef.current + 1;
    requestSeqRef.current = seq;
    setLoading(true);
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.message
      .sessions({})
      .then((page) => {
        if (requestSeqRef.current !== seq) return;
        setSessions(page.sessions);
        setBeginTs(page.nextOffset ? Number(page.nextOffset) : null);
        setHasMore(page.hasMore);
      })
      .catch((reason: Error) => {
        if (requestSeqRef.current === seq) setError(errorMessage(reason));
      })
      .finally(() => {
        if (requestSeqRef.current === seq) setLoading(false);
      });
    return () => {
      requestSeqRef.current += 1;
    };
  }, []);

  function loadMore() {
    if (loading || !hasMore || beginTs === null) return;
    setLoading(true);
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.message
      .sessions({ beginTs: beginTs })
      .then((page) => {
        setSessions((previous) => {
          const seen = new Set(previous.map((session: BiliMessageSession) => session.talkerId));
          return [...previous, ...page.sessions.filter((session: BiliMessageSession) => !seen.has(session.talkerId))];
        });
        setBeginTs(page.nextOffset ? Number(page.nextOffset) : null);
        setHasMore(page.hasMore);
      })
      .catch((reason: Error) => setError(errorMessage(reason)))
      .finally(() => setLoading(false));
  }

  if (loading && sessions.length === 0) return <div className="bili-state">正在加载会话</div>;
  if (error && sessions.length === 0) return <div className="bili-state bili-state-error">{error}</div>;

  return (
    <section className="bili-messages">
      {sessions.length === 0 && !loading ? <div className="bili-state">暂无私信会话</div> : null}
      {sessions.map((session) => (
        <button
          className="bili-message-session"
          key={session.talkerId}
          type="button"
          onClick={() => openChat(session.talkerId)}
        >
          <span className="bili-message-session-avatar">
            {session.face ? (
              <BiliImage className="bili-dynamic-avatar" src={session.face} alt={session.name} />
            ) : (
              <span className="bili-profile-avatar bili-profile-avatar-empty">
                {session.name ? session.name.slice(0, 1) : String(session.talkerId).slice(-2)}
              </span>
            )}
          </span>
          <span className="bili-message-session-body">
            <strong>{session.name || `UID ${session.talkerId}`}</strong>
            <small>{session.lastMsg?.content || "暂无消息"}</small>
          </span>
          {session.unreadCount > 0 ? (
            <span className="bili-message-badge">{session.unreadCount > 99 ? "99+" : session.unreadCount}</span>
          ) : null}
        </button>
      ))}
      {error ? <div className="bili-state bili-state-error">{error}</div> : null}
      {hasMore ? (
        <button type="button" className="bili-dynamic-load-more" onClick={loadMore} disabled={loading}>
          {loading ? "正在加载" : "加载更多"}
        </button>
      ) : null}
    </section>
  );
}
