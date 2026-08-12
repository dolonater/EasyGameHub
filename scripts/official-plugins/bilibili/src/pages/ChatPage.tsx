import React, { Button, useCallback, useEffect, useRef, useState } from "sdk";
import type { BiliMessageItem } from "../types";
import { errorMessage, getState } from "../runtime";

interface ChatPageProps {
  uid: number;
}

const pollInterval = 30 * 1000;
const maxMessageLength = 2000;

/** 私信会话页：历史消息 cursor 分页 + 30s 轮询新消息 + 发送文字消息（失败保留输入）。 */
export function ChatPage({ uid }: ChatPageProps) {
  const [messages, setMessages] = useState<BiliMessageItem[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const myUidRef = useRef(0);

  useEffect(() => {
    const login = getState().loginInfo;
    myUidRef.current = Number(login?.userId ?? 0);
  }, []);

  const loadPage = useCallback(
    (firstLoad: boolean) => {
      if (loading) return;
      setLoading(true);
      setError("");
      const sdk = getState().sdk;
      if (!sdk) {
        setLoading(false);
        return;
      }
      sdk.bilibili.message
        .history({ talkerUid: uid, cursor: firstLoad ? undefined : (cursor ?? undefined) })
        .then((page) => {
          if (firstLoad) {
            setMessages(page.messages);
            setCursor(page.nextOffset ?? null);
            setHasMore(page.hasMore);
            scrollToBottom();
          } else {
            // 向上翻页：旧消息插到顶部
            setMessages((previous) => [...page.messages, ...previous]);
            setCursor(page.nextOffset ?? null);
            setHasMore(page.hasMore);
          }
        })
        .catch((reason: Error) => {
          if (firstLoad) setError(errorMessage(reason));
        })
        .finally(() => setLoading(false));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uid, cursor, loading],
  );

  useEffect(() => {
    loadPage(true);
    return () => {
      // 卸载时终止进行中的请求
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // 30s 轮询新消息
  useEffect(() => {
    const timer = setInterval(() => {
      const sdk = getState().sdk;
      if (!sdk) return;
      sdk.bilibili.message
        .history({ talkerUid: uid, cursor: 0 })
        .then((page) => {
          setMessages((previous) => {
            const seen = new Set(previous.map((msg: BiliMessageItem) => msg.msgId));
            const fresh = page.messages.filter((msg: BiliMessageItem) => !seen.has(msg.msgId));
            if (fresh.length === 0) return previous;
            return [...previous, ...fresh];
          });
        })
        .catch(() => undefined);
    }, pollInterval);
    return () => clearInterval(timer);
  }, [uid]);

  function scrollToBottom() {
    setTimeout(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }, 30);
  }

  function submit(event: Event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    const sdk = getState().sdk;
    if (!sdk) {
      setSending(false);
      return;
    }
    sdk.bilibili.message
      .send({ uid, content: text })
      .then((result) => {
        if (!result.ok) throw new Error(result.message || "发送失败");
        setMessages((previous) => [
          ...previous,
          {
            msgId: Date.now(),
            senderUid: myUidRef.current || -1,
            content: text,
            timestamp: Math.floor(Date.now() / 1000),
            msgType: 2,
          },
        ]);
        setDraft("");
        scrollToBottom();
      })
      .catch((reason: Error) => sdk.ui.notify(errorMessage(reason)))
      .finally(() => setSending(false));
  }

  const text = draft.trim();

  return (
    <section className="bili-chat">
      <div className="bili-chat-list" ref={listRef}>
        {hasMore ? (
          <button type="button" className="bili-chat-load-more" onClick={() => loadPage(false)} disabled={loading}>
            {loading ? "正在加载" : "加载更早消息"}
          </button>
        ) : null}
        {messages.length === 0 && loading ? <div className="bili-state">正在加载消息</div> : null}
        {error && messages.length === 0 ? <div className="bili-state bili-state-error">{error}</div> : null}
        {messages.map((msg) => {
          const mine = msg.senderUid === myUidRef.current || msg.senderUid <= 0;
          return (
            <div key={msg.msgId} className={`bili-chat-bubble ${mine ? "bili-chat-bubble-mine" : ""}`}>
              <div className="bili-chat-bubble-content">{msg.content}</div>
              <small>{formatTime(msg.timestamp)}</small>
            </div>
          );
        })}
      </div>
      <form className="bili-chat-input" onSubmit={submit}>
        <input
          type="text"
          className="bili-chat-input-field"
          value={draft}
          maxLength={maxMessageLength}
          placeholder="发一条消息…"
          onChange={(event: any) => setDraft(event.currentTarget.value.slice(0, maxMessageLength))}
        />
        <Button size="sm" type="submit" disabled={!text || sending}>
          {sending ? "发送中" : "发送"}
        </Button>
      </form>
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

