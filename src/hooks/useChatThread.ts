import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { listen } from "@tauri-apps/api/event";
import { showToast } from "../components/Notification";

/** Minimal shape the chat state machine needs from a message. */
export interface ChatThreadMessage {
  timestamp: number;
  message: string;
  deliveryState?: string;
  localId?: string;
}

/** What `open` / `refresh` resolve to (mirrors the backend thread DTOs). */
export interface ThreadLoadResult<T> {
  messages: T[];
  moreAvailable: boolean;
}

export interface UseChatThreadOptions<T extends ChatThreadMessage> {
  /** The thread is selected and its mode is active (effects run only then). */
  active: boolean;
  selfId: string | null;
  /** Changes when the thread identity changes (re-runs the open cycle + scroll memory). */
  scrollKey: string;
  /** Extra deps that re-run the open cycle (e.g. image-upload refresh tick). */
  refreshKey?: number;
  /** Cached-open the thread → messages + moreAvailable. */
  open: () => Promise<ThreadLoadResult<T>>;
  /** Network refresh, optionally paging backward past `olderThan`. */
  refresh: (olderThan?: number) => Promise<ThreadLoadResult<T>>;
  /** Send one message; throws on failure. */
  send: (text: string) => Promise<unknown>;
  /** Build the optimistic bubble for a send (must carry `localId`, deliveryState "pending"). */
  buildOptimistic: (text: string, localId: string) => T;
  /** Is this message ours (retry matching / bubble alignment)? */
  isSelf: (m: T) => boolean;
  /** Does this message belong to the current thread (any sender)? */
  isThreadMessage: (m: T) => boolean;
  /** Merge two arrays (dedupe + chronological order). */
  merge: (a: T[], b: T[]) => T[];
  /** Identity key for dedup. */
  dedup: (m: T) => string;
  /** Live event name ("social:chat" | "social:group"). */
  eventName: string;
  /** Filter an incoming live message to this thread. */
  matchIncoming: (m: T) => boolean;
  /** Side effect after the cached thread opens (clear unread, reload list). */
  onOpened?: () => void;
}

export interface ChatThreadApi<T extends ChatThreadMessage> {
  listRef: RefObject<HTMLDivElement>;
  messages: T[];
  setMessages: React.Dispatch<React.SetStateAction<T[]>>;
  moreAvailable: boolean;
  loadingOlder: boolean;
  historyError: string | null;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  sending: boolean;
  send: () => void;
  retry: (m: T) => void;
  loadOlder: () => void;
  handleScroll: () => void;
  dedup: (m: T) => string;
  isSelf: (m: T) => boolean;
}

/**
 * The per-thread chat state machine shared by the friends and group chat panes:
 * messages + optimistic send/retry (pending → sent/failedRetryable), live-event
 * append, scroll-to-top "load older" with view anchoring, and the pre-paint
 * scroll authority (restore saved position / follow near-bottom / anchor after
 * prepending). The presentational `ChatThreadView` renders the returned api.
 */
export function useChatThread<T extends ChatThreadMessage>(
  opts: UseChatThreadOptions<T>,
): ChatThreadApi<T> {
  const {
    active,
    selfId,
    scrollKey,
    refreshKey = 0,
    open,
    refresh,
    send,
    buildOptimistic,
    isSelf,
    isThreadMessage,
    merge,
    dedup,
    eventName,
    matchIncoming,
    onOpened,
  } = opts;

  const listRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<T[]>([]);
  const [moreAvailable, setMoreAvailable] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // Scroll settlement state.
  const lastThreadKeyRef = useRef("");
  const savedScrollRef = useRef<Record<string, { top: number; height: number }>>({});
  const pendingAnchorRef = useRef<{ height: number; top: number } | null>(null);
  const activeScrollKeyRef = useRef("");

  // Open cycle: cached thread first (instant), then a silent network refresh
  // that merges server history with the cache.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setMoreAvailable(false);
    setLoadingOlder(false);
    open()
      .then((t) => {
        if (cancelled) return;
        setMessages(t.messages);
        setHistoryError(null);
        onOpened?.();
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      });
    refresh()
      .then((t) => {
        if (cancelled) return;
        setMessages((prev) => merge(t.messages, prev));
        setHistoryError(null);
        setMoreAvailable(t.moreAvailable);
      })
      .catch((e) => {
        if (cancelled) return;
        setHistoryError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, scrollKey, refreshKey]);

  // Live incoming for this thread (replaces the old 3s polling).
  useEffect(() => {
    if (!active) return;
    const unlisten = listen<T[]>(eventName, (event) => {
      const fresh = event.payload.filter(matchIncoming);
      if (!fresh.length) return;
      setMessages((prev) => {
        const seen = new Set(prev.map(dedup));
        const newOnes = fresh.filter((m) => !seen.has(dedup(m)));
        return newOnes.length ? [...prev, ...newOnes] : prev;
      });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, scrollKey]);

  // Load a page of older messages (scroll-to-top). Merges the fetched batch
  // into the thread and keeps the view anchored at the previous position.
  const loadOlder = async () => {
    const key = scrollKey;
    const el = listRef.current;
    if (!active || loadingOlder || !messages.length) return;
    const oldest = messages[0].timestamp;
    if (!oldest) return;
    const prevScrollHeight = el?.scrollHeight ?? 0;
    const prevScrollTop = el?.scrollTop ?? 0;
    setLoadingOlder(true);
    try {
      const t = await refresh(oldest);
      if (activeScrollKeyRef.current !== key) return; // user switched threads
      setMessages((prev) => merge(t.messages, prev));
      setMoreAvailable(t.moreAvailable);
      pendingAnchorRef.current = { height: prevScrollHeight, top: prevScrollTop };
    } catch {
      // keep the current list; the next scroll up retries
    } finally {
      if (activeScrollKeyRef.current === key) setLoadingOlder(false);
    }
  };

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    // Remember this thread's scroll position so re-opening it restores it.
    savedScrollRef.current[scrollKey] = { top: el.scrollTop, height: el.scrollHeight };
    if (loadingOlder || !moreAvailable) return;
    if (el.scrollTop <= 20) void loadOlder();
  };

  const markById = (localId: string, state: string) =>
    setMessages((prev) =>
      prev.map((m) => (m.localId === localId ? { ...m, deliveryState: state } : m)),
    );

  const markByBody = (body: string, fromState: string, toState: string) =>
    setMessages((prev) =>
      prev.map((m) =>
        isSelf(m) && m.message === body && m.deliveryState === fromState
          ? { ...m, deliveryState: toState }
          : m,
      ),
    );

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !selfId) return;
    setInput("");
    const localId = `m${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setMessages((prev) => [...prev, buildOptimistic(text, localId)]);
    setSending(true);
    try {
      await send(text);
      markById(localId, "sent");
    } catch (e) {
      markById(localId, "failedRetryable");
      showToast("error", e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  /** Re-send a failed message, reusing its bubble (matched by content). */
  const retryMessage = async (m: T) => {
    const text = m.message;
    if (!selfId) return;
    markByBody(text, "failedRetryable", "pending");
    setSending(true);
    try {
      await send(text);
      markByBody(text, "pending", "sent");
    } catch (e) {
      markByBody(text, "pending", "failedRetryable");
      showToast("error", e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  // Scroll authority (runs BEFORE paint, so re-opening a thread never flashes
  // from the top). A fresh thread restores its saved position (or lands at the
  // newest); the same thread follows new messages only when near the bottom; a
  // pending load-older anchor is consumed first.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    activeScrollKeyRef.current = scrollKey;
    // A stale array (thread switch in progress, old thread still in state) must
    // not settle the new thread's scroll.
    const stale = messages.length > 0 && !messages.every(isThreadMessage);
    if (!stale && messages.length > 0 && scrollKey !== lastThreadKeyRef.current) {
      lastThreadKeyRef.current = scrollKey;
      const saved = savedScrollRef.current[scrollKey];
      if (saved && saved.height > 0 && el.scrollHeight > 0) {
        el.scrollTop = (saved.top / saved.height) * el.scrollHeight;
      } else {
        el.scrollTop = el.scrollHeight;
      }
      return;
    }
    if (pendingAnchorRef.current) {
      const a = pendingAnchorRef.current;
      pendingAnchorRef.current = null;
      el.scrollTop = el.scrollHeight - a.height + a.top;
      return;
    }
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, scrollKey]);

  return {
    listRef,
    messages,
    setMessages,
    moreAvailable,
    loadingOlder,
    historyError,
    input,
    setInput,
    sending,
    send: () => void sendMessage(),
    retry: (m) => void retryMessage(m),
    loadOlder: () => void loadOlder(),
    handleScroll,
    dedup,
    isSelf,
  };
}
