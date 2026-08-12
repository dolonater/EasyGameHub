import React, { useEffect, useRef, useState } from "sdk";
import type { BiliReplyFeedEntry } from "../types";
import { errorMessage, getState } from "../runtime";
import { openDynDetail, openWatch } from "../navigation";
import { BiliImage } from "../components/BiliImage";

type NotifyFilter = "all" | "reply" | "at";

const filters: Array<{ id: NotifyFilter; label: string }> = [
  { id: "all", label: "全部" },
  { id: "reply", label: "回复" },
  { id: "at", label: "@我" },
];

/** 通知流：reply_feed 分页 + 类型筛选 + 点击跳转对应视频/动态。 */
export function NotificationsPage() {
  const [entries, setEntries] = useState<BiliReplyFeedEntry[]>([]);
  const [filter, setFilter] = useState<NotifyFilter>("all");
  const [cursorId, setCursorId] = useState<number | null>(null);
  const [isEnd, setIsEnd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestSeqRef = useRef(0);

  useEffect(() => {
    const seq = requestSeqRef.current + 1;
    requestSeqRef.current = seq;
    setLoading(true);
    setError("");
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.message
      .replyFeed({})
      .then((page) => {
        if (requestSeqRef.current !== seq) return;
        setEntries(page.entries);
        setCursorId(page.cursorId ?? null);
        setIsEnd(page.isEnd);
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
    if (loading || isEnd || cursorId === null) return;
    setLoading(true);
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.message
      .replyFeed({ startId: cursorId })
      .then((page) => {
        setEntries((previous) => {
          const seen = new Set(previous.map((entry: BiliReplyFeedEntry) => entry.id));
          return [...previous, ...page.entries.filter((entry: BiliReplyFeedEntry) => !seen.has(entry.id))];
        });
        setCursorId(page.cursorId ?? null);
        setIsEnd(page.isEnd);
      })
      .catch((reason: Error) => setError(errorMessage(reason)))
      .finally(() => setLoading(false));
  }

  function visibleEntries() {
    if (filter === "all") return entries;
    const target = filter === "reply" ? "reply" : "at";
    return entries.filter((entry) => entry.replyType.includes(target));
  }

  function openEntry(entry: BiliReplyFeedEntry) {
    const uri = entry.uri || "";
    const videoMatch = uri.match(/video\/(BV[\w]+)/);
    if (videoMatch) {
      openWatch({ name: "watch", bvid: videoMatch[1] });
      return;
    }
    const dynMatch = uri.match(/(?:opus|dynamic)\/(\d+)/);
    if (dynMatch) {
      openDynDetail(dynMatch[1]);
      return;
    }
  }

  if (loading && entries.length === 0) return <div className="bili-state">正在加载通知</div>;
  if (error && entries.length === 0) return <div className="bili-state bili-state-error">{error}</div>;

  return (
    <section className="bili-notifications">
      <div className="bili-notify-filters">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`bili-notify-filter ${filter === item.id ? "bili-notify-filter-active" : ""}`}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {visibleEntries().length === 0 && !loading ? <div className="bili-state">暂无通知</div> : null}
      {visibleEntries().map((entry) => (
        <button className="bili-notify-entry" key={entry.id} type="button" onClick={() => openEntry(entry)}>
          <BiliImage className="bili-dynamic-avatar bili-dynamic-avatar-sm" src={entry.userFace} alt={entry.userName} />
          <span className="bili-notify-entry-body">
            <strong>
              {entry.userName}
              {entry.replyType.includes("at") ? <span className="bili-notify-tag">@我</span> : null}
            </strong>
            <span className="bili-notify-entry-desc">{entry.desc || entry.title}</span>
            <small>{formatTime(entry.replyTime)}</small>
          </span>
        </button>
      ))}
      {error ? <div className="bili-state bili-state-error">{error}</div> : null}
      {!isEnd ? (
        <button type="button" className="bili-dynamic-load-more" onClick={loadMore} disabled={loading}>
          {loading ? "正在加载" : "加载更多"}
        </button>
      ) : null}
    </section>
  );
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const pad = (value: number) => String(value).padStart(2, "0");
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (sameDay) return time;
  return `${date.getMonth() + 1}/${date.getDate()} ${time}`;
}
