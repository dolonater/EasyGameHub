import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Icon from "../ui/Icon";
import TextField from "../ui/TextField";
import Button from "../ui/Button";
import TabButtons from "../ui/TabButtons";
import { showToast } from "../Notification";
import {
  getStickerCatalog,
  loadFriends,
  loadGroups,
  loadSessions,
  openChat,
  openGroupChat,
  pollChat,
  pollGroupMessages,
  refreshChat,
  refreshFriends,
  refreshGroupChat,
  refreshGroups,
  refreshSessions,
  sendChatMessage,
  sendGroupMessage,
  sendStickerMessage,
  stickerImageUrl,
  uploadChatImage,
  uploadGroupImage,
  type ChatGroupDto,
  type ChatMessageDto,
  type ChatSessionDto,
  type ChatThreadDto,
  type DeliveryState,
  type FriendDto,
  type GroupMessageDto,
  type GroupThreadDto,
  type OnlineState,
  type StickerDto,
} from "../../lib/steamSocial";
import type { SessionDto } from "../../lib/steamCommunity";

interface SocialPanelProps {
  session: SessionDto | null;
  embedded?: boolean;
}

/** A chat message with an optional UI-only id for tracking optimistic bubbles. */
type UiChatMessage = ChatMessageDto & { localId?: string };
/** A group message with an optional UI-only id for tracking optimistic bubbles. */
type UiGroupMessage = GroupMessageDto & { localId?: string };

/** Friend-thread identity: `timestamp:sender:body` (Web-API history has no ordinal). */
function dedupKey(m: ChatMessageDto): string {
  return `${m.timestamp}:${m.steamId}:${m.message}`;
}
/** Group-thread identity: `timestamp:ordinal:sender`. */
function groupDedupKey(m: GroupMessageDto): string {
  return `${m.timestamp}:${m.ordinal}:${m.senderSteamId}`;
}

/** Prefer `a` (server truth), then append `b`'s messages not already in `a`. */
function unionMessages(a: ChatMessageDto[], b: ChatMessageDto[]): ChatMessageDto[] {
  const seen = new Set(a.map(dedupKey));
  return [...a, ...b.filter((m) => !seen.has(dedupKey(m)))];
}

/** Group-thread variant of `unionMessages`. */
function unionGroupMessages(a: GroupMessageDto[], b: GroupMessageDto[]): GroupMessageDto[] {
  const seen = new Set(a.map(groupDedupKey));
  return [...a, ...b.filter((m) => !seen.has(groupDedupKey(m)))];
}

/** Online-state label + status dot color. */
const STATE_STYLES: Record<OnlineState, { labelKey: string; dot: string }> = {
  online: { labelKey: "socialOnline", dot: "bg-green-500" },
  busy: { labelKey: "socialBusy", dot: "bg-red-500" },
  away: { labelKey: "socialAway", dot: "bg-amber-500" },
  snooze: { labelKey: "socialSnooze", dot: "bg-slate-400" },
  lookingToTrade: { labelKey: "socialLookingTrade", dot: "bg-purple-500" },
  lookingToPlay: { labelKey: "socialLookingPlay", dot: "bg-blue-500" },
  offline: { labelKey: "socialOffline", dot: "bg-slate-300" },
};

/** Render a message body: `/sticker <name>` → sticker, `[img]url[/img]` → image, else text. */
function ChatMessageContent({ text }: { text: string }) {
  const trimmed = text.trim();
  const stickerMatch = /^\/sticker\s+(.+?)\s*$/.exec(trimmed);
  if (stickerMatch) {
    return (
      <img
        src={stickerImageUrl(stickerMatch[1])}
        alt={stickerMatch[1]}
        className="max-h-28 max-w-[160px] object-contain"
        loading="lazy"
      />
    );
  }
  const imgSrc = extractImgSrc(trimmed);
  if (imgSrc) {
    return (
      <img
        src={imgSrc}
        alt=""
        className="max-h-64 max-w-full rounded-lg object-contain"
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    );
  }
  return <>{text}</>;
}

/** Extract the display URL from a Steam image BBCode chat message. */
function extractImgSrc(text: string): string | null {
  // Rich form Steam's own clients emit for shared images:
  //   [img src=<url> thumbnail_src=<url> srcset="..." width=.. height=..]
  //     [url=<url>]url[/url][/img]
  const rich = /^\[img\b([^\]]*)\][\s\S]*\[\/img\]$/i.exec(text);
  if (rich) {
    const attrs = rich[1];
    // Prefer the scaled CDN thumbnail (`?imw=512...`) over the full-resolution
    // original for the in-bubble preview.
    const thumb = /thumbnail_src=([^\s\]]+)/i.exec(attrs);
    if (thumb) return thumb[1];
    const src = /\bsrc=([^\s\]]+)/i.exec(attrs);
    if (src) return src[1];
  }
  // Plain BBCode: [img]url[/img] or [img=WxH]url[/img]
  const plain = /^\[img[^\]]*\](https?:\/\/[^\[]+)\[\/img\]$/i.exec(text);
  return plain ? plain[1] : null;
}

/**
 * 社交 Tab: friend list + private chat (web-chat/CM) AND group chat rooms.
 * Both only work with an active Steam session.
 */
export default function SocialPanel({ session, embedded = false }: SocialPanelProps) {
  const { t } = useTranslation();
  const [socialMode, setSocialMode] = useState<"friends" | "groups">("friends");

  // Friends
  const [friends, setFriends] = useState<FriendDto[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [friendsStale, setFriendsStale] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSessionDto[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // Groups
  const [groups, setGroups] = useState<ChatGroupDto[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [groupsStale, setGroupsStale] = useState(false);
  const hasCachedGroups = useRef(false);
  const [selectedGroup, setSelectedGroup] = useState<ChatGroupDto | null>(null);
  const [groupMessages, setGroupMessages] = useState<UiGroupMessage[]>([]);
  const [groupHistoryError, setGroupHistoryError] = useState<string | null>(null);
  const [groupInput, setGroupInput] = useState("");
  const [groupSending, setGroupSending] = useState(false);

  // E4 图片 / 贴纸
  const [uploading, setUploading] = useState(false);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [stickers, setStickers] = useState<StickerDto[]>([]);
  const [stickersLoading, setStickersLoading] = useState(false);
  const stickersLoadedRef = useRef(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const hasCachedFriends = useRef(false);

  const listRef = useRef<HTMLDivElement>(null);
  const groupListRef = useRef<HTMLDivElement>(null);

  const selfId = session?.steamId ?? null;

  // Load friends: cached list first (instant), then a silent network refresh.
  // A failed refresh keeps the cache and flags it stale instead of blanking.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setFriendsLoading(true);
    setFriendsError(null);
    setFriendsStale(false);
    loadFriends()
      .then((list) => {
        if (cancelled) return;
        hasCachedFriends.current = list.length > 0;
        setFriends(list);
        setSelected((prev) => prev ?? list[0]?.steamId ?? null);
      })
      .catch(() => {
        // No cache — the refresh below is the source of truth.
      })
      .finally(() => {
        if (!cancelled) setFriendsLoading(false);
      });
    refreshFriends()
      .then((list) => {
        if (cancelled) return;
        hasCachedFriends.current = false;
        setFriends(list);
        setFriendsStale(false);
        setFriendsError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        if (hasCachedFriends.current) {
          // Cached list is on screen; refresh just failed → stale hint.
          setFriendsStale(true);
        } else {
          setFriendsError(msg);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  // Load groups: cached list first (instant), then a silent network refresh.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setGroupsLoading(true);
    setGroupsError(null);
    setGroupsStale(false);
    loadGroups()
      .then((list) => {
        if (cancelled) return;
        hasCachedGroups.current = list.length > 0;
        setGroups(list);
        setSelectedGroup((prev) => prev ?? list[0] ?? null);
      })
      .catch(() => {
        // No cache — the refresh below is the source of truth.
      })
      .finally(() => {
        if (!cancelled) setGroupsLoading(false);
      });
    refreshGroups()
      .then((list) => {
        if (cancelled) return;
        hasCachedGroups.current = false;
        setGroups(list);
        setGroupsStale(false);
        setGroupsError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        if (hasCachedGroups.current) setGroupsStale(true);
        else setGroupsError(msg);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  // Sessions: cached recent-conversation summaries first, then a derived
  // refresh (picks up unread increments made by the CM poll write-through).
  const refreshSessionsList = () => {
    refreshSessions()
      .then((list) => setSessions(list))
      .catch(() => {
        // Keep the cached list; the next poll tick retries.
      });
  };

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    loadSessions()
      .then((list) => {
        if (!cancelled) setSessions(list);
      })
      .catch(() => {});
    refreshSessionsList();
    return () => {
      cancelled = true;
    };
  }, [session]);

  // Re-derive sessions when new messages arrive (unread badges stay live).
  const sessionPreview = useMemo(() => {
    const m: Record<string, ChatSessionDto> = {};
    for (const s of sessions) m[s.partnerSteamId] = s;
    return m;
  }, [sessions]);

  // Open a friend thread: cached history first (instant), then a silent
  // refresh that merges server history with the cache.
  useEffect(() => {
    if (!session || !selected) return;
    let cancelled = false;
    openChat(selected)
      .then((t) => {
        if (cancelled) return;
        setMessages(unionMessages(t.messages, []));
        setHistoryError(null);
        // openChat clears the conversation's unread in the cache — re-derive
        // sessions so the badge clears immediately (not on the next page load).
        refreshSessionsList();
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      });
    refreshChat(selected)
      .then((t) => {
        if (cancelled) return;
        setMessages((prev) => unionMessages(t.messages, prev));
        setHistoryError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setHistoryError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [session, selected, refreshTick]);

  // Open a group channel: cached thread first (instant), then a silent refresh
  // that merges server history with the cache.
  useEffect(() => {
    if (!session || !selectedGroup) return;
    const chatId = selectedGroup.defaultChatId;
    if (!chatId) return;
    let cancelled = false;
    openGroupChat(selectedGroup.groupId, chatId)
      .then((t) => {
        if (cancelled) return;
        setGroupMessages(unionGroupMessages(t.messages, []));
        setGroupHistoryError(null);
      })
      .catch(() => {
        if (!cancelled) setGroupMessages([]);
      });
    refreshGroupChat(selectedGroup.groupId, chatId)
      .then((t) => {
        if (cancelled) return;
        setGroupMessages((prev) => unionGroupMessages(t.messages, prev));
        setGroupHistoryError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setGroupHistoryError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [session, selectedGroup, refreshTick]);

  // Poll the CM friend-message buffer.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const incoming = await pollChat(selected ?? undefined);
        if (cancelled) return;
        if (incoming.length) refreshSessionsList();
        if (incoming.length && selected) {
          setMessages((prev) => {
            const seen = new Set(prev.map(dedupKey));
            const fresh = incoming.filter((m) => m.steamId === selected && !seen.has(dedupKey(m)));
            return fresh.length ? [...prev, ...fresh] : prev;
          });
        }
      } catch {
        // Transient poll failure — keep the loop going.
      }
    };
    void tick();
    const timer = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [session, selected]);

  // Poll the CM group-message buffer.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const activeGroup =
          selectedGroup && selectedGroup.defaultChatId
            ? ([selectedGroup.groupId, selectedGroup.defaultChatId] as [string, string])
            : undefined;
        const incoming = await pollGroupMessages(activeGroup);
        if (!cancelled && incoming.length && selectedGroup) {
          setGroupMessages((prev) => {
            const seen = new Set(prev.map(groupDedupKey));
            const fresh = incoming.filter(
              (m) =>
                m.groupId === selectedGroup.groupId &&
                m.chatId === selectedGroup.defaultChatId &&
                !seen.has(groupDedupKey(m)),
            );
            return fresh.length ? [...prev, ...fresh] : prev;
          });
        }
      } catch {
        // ignore
      }
    };
    void tick();
    const timer = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [session, selectedGroup]);

  // Auto-scroll to the newest message.
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, socialMode]);
  useEffect(() => {
    if (groupListRef.current) groupListRef.current.scrollTop = groupListRef.current.scrollHeight;
  }, [groupMessages]);

  const selectedFriend = useMemo(
    () => friends.find((f) => f.steamId === selected) ?? null,
    [friends, selected],
  );

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !selected || !selfId) return;
    setInput("");
    const localId = `s${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setMessages((prev) => [
      ...prev,
      { steamId: selfId, timestamp: Math.floor(Date.now() / 1000), message: text, kind: "saytext", deliveryState: "pending", localId },
    ]);
    setSending(true);
    try {
      await sendChatMessage(selected, text);
      setMessages((prev) => prev.map((m) => (m.localId === localId ? { ...m, deliveryState: "sent" } : m)));
    } catch (e) {
      setMessages((prev) => prev.map((m) => (m.localId === localId ? { ...m, deliveryState: "failedRetryable" } : m)));
      showToast("error", e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  /** Re-send a failed message, reusing its bubble (matched by content). */
  const handleRetry = async (m: UiChatMessage) => {
    const text = m.message;
    if (!selected || !selfId) return;
    setMessages((prev) =>
      prev.map((x) =>
        x.steamId === selfId && x.message === text && x.deliveryState === "failedRetryable"
          ? { ...x, deliveryState: "pending" }
          : x,
      ),
    );
    setSending(true);
    try {
      await sendChatMessage(selected, text);
      setMessages((prev) =>
        prev.map((x) =>
          x.steamId === selfId && x.message === text && x.deliveryState === "pending"
            ? { ...x, deliveryState: "sent" }
            : x,
        ),
      );
    } catch (e) {
      setMessages((prev) =>
        prev.map((x) =>
          x.steamId === selfId && x.message === text && x.deliveryState === "pending"
            ? { ...x, deliveryState: "failedRetryable" }
            : x,
        ),
      );
      showToast("error", e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const handleGroupSend = async () => {
    const text = groupInput.trim();
    if (!text || !selectedGroup || !selfId) return;
    const chatId = selectedGroup.defaultChatId;
    if (!chatId) return;
    setGroupInput("");
    const localId = `g${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setGroupMessages((prev) => [
      ...prev,
      {
        groupId: selectedGroup.groupId,
        chatId,
        senderSteamId: selfId,
        timestamp: Math.floor(Date.now() / 1000),
        ordinal: 0,
        message: text,
        deliveryState: "pending",
        localId,
      },
    ]);
    setGroupSending(true);
    try {
      await sendGroupMessage(selectedGroup.groupId, chatId, text);
      setGroupMessages((prev) => prev.map((m) => (m.localId === localId ? { ...m, deliveryState: "sent" } : m)));
    } catch (e) {
      setGroupMessages((prev) => prev.map((m) => (m.localId === localId ? { ...m, deliveryState: "failedRetryable" } : m)));
      showToast("error", e instanceof Error ? e.message : String(e));
    } finally {
      setGroupSending(false);
    }
  };

  /** Re-send a failed group message, reusing its bubble (matched by content). */
  const handleGroupRetry = async (m: UiGroupMessage) => {
    const text = m.message;
    if (!selectedGroup || !selfId) return;
    const chatId = selectedGroup.defaultChatId;
    if (!chatId) return;
    setGroupMessages((prev) =>
      prev.map((x) =>
        x.senderSteamId === selfId && x.message === text && x.deliveryState === "failedRetryable"
          ? { ...x, deliveryState: "pending" }
          : x,
      ),
    );
    setGroupSending(true);
    try {
      await sendGroupMessage(selectedGroup.groupId, chatId, text);
      setGroupMessages((prev) =>
        prev.map((x) =>
          x.senderSteamId === selfId && x.message === text && x.deliveryState === "pending"
            ? { ...x, deliveryState: "sent" }
            : x,
        ),
      );
    } catch (e) {
      setGroupMessages((prev) =>
        prev.map((x) =>
          x.senderSteamId === selfId && x.message === text && x.deliveryState === "pending"
            ? { ...x, deliveryState: "failedRetryable" }
            : x,
        ),
      );
      showToast("error", e instanceof Error ? e.message : String(e));
    } finally {
      setGroupSending(false);
    }
  };

  // E4: toggle the sticker picker (loads the catalogue once; a failed load
  // leaves the flag unset so the next open retries).
  const toggleStickerPicker = () => {
    setStickerPickerOpen((open) => !open);
    if (stickersLoadedRef.current) return;
    setStickersLoading(true);
    getStickerCatalog()
      .then((list) => {
        stickersLoadedRef.current = true;
        setStickers(list);
      })
      .catch((e) => showToast("error", e instanceof Error ? e.message : String(e)))
      .finally(() => setStickersLoading(false));
  };

  // E4: pick a local image → upload to the active chat (friend or group).
  const handlePickImage = async () => {
    if (uploading) return;
    const { open } = await import("@tauri-apps/plugin-dialog");
    const file = await open({
      multiple: false,
      filters: [{ name: t("steam.socialImageFilter"), extensions: ["png", "jpg", "jpeg", "gif", "webp"] }],
    });
    if (!file || typeof file !== "string") return;
    setUploading(true);
    try {
      if (socialMode === "friends") {
        if (!selected) throw new Error(t("steam.socialEmptyFriends"));
        await uploadChatImage(file, selected);
      } else {
        const chatId = selectedGroup?.defaultChatId;
        if (!selectedGroup || !chatId) throw new Error(t("steam.socialGroupsEmpty"));
        await uploadGroupImage(file, selectedGroup.groupId, chatId);
      }
      showToast("success", t("steam.socialImageSent"));
      // Steam inserts the image server-side — re-fetch history to show it.
      setRefreshTick((x) => x + 1);
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  // E4: send a sticker to the active chat (friend or group).
  const handleSendSticker = async (name: string) => {
    if (!selfId) return;
    if (socialMode === "friends") {
      if (!selected) return;
      setMessages((prev) => [
        ...prev,
        { steamId: selfId, timestamp: Math.floor(Date.now() / 1000), message: `/sticker ${name}`, kind: "saytext" },
      ]);
      try {
        await sendStickerMessage(selected, name);
      } catch (e) {
        showToast("error", e instanceof Error ? e.message : String(e));
      }
    } else {
      const chatId = selectedGroup?.defaultChatId;
      if (!selectedGroup || !chatId) return;
      setGroupMessages((prev) => [
        ...prev,
        {
          groupId: selectedGroup.groupId,
          chatId,
          senderSteamId: selfId,
          timestamp: Math.floor(Date.now() / 1000),
          ordinal: 0,
          message: `/sticker ${name}`,
        },
      ]);
      try {
        await sendGroupMessage(selectedGroup.groupId, chatId, `/sticker ${name}`);
      } catch (e) {
        showToast("error", e instanceof Error ? e.message : String(e));
      }
    }
    setStickerPickerOpen(false);
  };

  if (!session) {
    return (
      <div className="app-surface app-glass-card rounded-[var(--radius)] border border-border/40 py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <Icon name="steamLogin" size={32} />
        <div className="text-sm">{t("steam.socialNoSession")}</div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${embedded ? "" : "max-w-3xl mx-auto"}`}>
      <div className="flex justify-center">
        <TabButtons
          name="social-mode"
          value={socialMode}
          size="sm"
          onChange={(v) => setSocialMode(v as "friends" | "groups")}
          options={[
            { value: "friends", label: t("steam.socialFriends") },
            { value: "groups", label: t("steam.socialGroups") },
          ]}
        />
      </div>

      {(stickerPickerOpen || uploading) && (
        <div className="app-surface app-glass-card rounded-[var(--radius)] border border-border/40 p-2">
          {uploading && (
            <div className="mb-2 text-xs text-muted-foreground">{t("steam.socialImageUploading")}</div>
          )}
          {stickerPickerOpen &&
            (stickersLoading ? (
              <div className="py-4 text-center text-xs text-muted-foreground">{t("common.loading")}</div>
            ) : stickers.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">{t("steam.socialNoStickers")}</div>
            ) : (
              <div className="grid max-h-40 grid-cols-6 gap-2 overflow-y-auto">
                {stickers.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => void handleSendSticker(s.name)}
                    className="rounded-lg p-1 transition-colors hover:bg-secondary/60"
                    title={s.name}
                  >
                    <img src={s.imageUrl} alt={s.name} className="h-10 w-10 object-contain" loading="lazy" />
                  </button>
                ))}
              </div>
            ))}
        </div>
      )}

      <div className="app-surface app-glass-card rounded-[var(--radius)] border border-border/40 p-3 flex gap-3" style={{ height: 500 }}>
        {socialMode === "friends" ? (
          <>
            {/* Friends list */}
            <div className="w-48 shrink-0 overflow-y-auto border-r border-border/40 pr-2">
              {friendsLoading && (
                <div className="py-6 text-center text-xs text-muted-foreground">{t("common.loading")}</div>
              )}
              {friendsError && !friendsLoading && (
                <div className="py-4 px-1 text-xs text-red-500">{t("steam.socialLoadFailed", { error: friendsError })}</div>
              )}
              {friendsStale && !friendsLoading && !friendsError && (
                <div className="py-1 px-1 text-[10px] text-amber-500">{t("steam.socialCacheStale")}</div>
              )}
              {!friendsLoading && !friendsError && friends.length === 0 && (
                <div className="py-6 text-center text-xs text-muted-foreground">{t("steam.socialEmptyFriends")}</div>
              )}
              {friends.map((f) => {
                const style = STATE_STYLES[f.onlineState] ?? STATE_STYLES.offline;
                const active = f.steamId === selected;
                return (
                  <button
                    key={f.steamId}
                    type="button"
                    onClick={() => setSelected(f.steamId)}
                    className={`relative mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                      active ? "bg-primary/15" : "hover:bg-secondary/50"
                    }`}
                  >
                    {f.avatarUrl ? (
                      <img src={f.avatarUrl} alt="" className="h-8 w-8 flex-none rounded-full" />
                    ) : (
                      <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-secondary/40 text-muted-foreground">
                        <Icon name="user" size={14} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{f.personaName || f.steamId.slice(-6)}</div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                        <span className="truncate">
                          {sessionPreview[f.steamId]?.lastMessage
                            ? sessionPreview[f.steamId]!.lastMessage
                            : f.inGameName
                              ? t("steam.socialInGame", { defaultValue: "游戏中" })
                              : t(style.labelKey, { defaultValue: style.labelKey })}
                        </span>
                      </div>
                    </div>
                    {sessionPreview[f.steamId]?.unreadCount ? (
                      <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                        {sessionPreview[f.steamId]!.unreadCount > 99 ? "99+" : sessionPreview[f.steamId]!.unreadCount}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Friend chat */}
            <div className="flex min-w-0 flex-1 flex-col">
              {selectedFriend ? (
                <>
                  <div className="mb-2 flex items-center gap-2 border-b border-border/40 pb-2">
                    <span className={`h-2 w-2 rounded-full ${STATE_STYLES[selectedFriend.onlineState]?.dot ?? "bg-slate-300"}`} />
                    <span className="truncate text-sm font-semibold">
                      {selectedFriend.personaName || selectedFriend.steamId}
                    </span>
                    {selectedFriend.inGameName && (
                      <span className="truncate text-[11px] text-primary">{t("steam.socialInGame", { defaultValue: "游戏中" })} {selectedFriend.inGameName}</span>
                    )}
                  </div>
                  <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                    {messages.length === 0 && historyError ? (
                      <div className="break-words px-2 py-8 text-center text-xs text-red-500">
                        {t("steam.socialLoadFailed", { error: historyError })}
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="py-8 text-center text-xs text-muted-foreground">{t("steam.socialChatEmpty")}</div>
                    ) : null}
                    {messages.map((m, i) => {
                      const self = selfId != null && m.steamId === selfId;
                      return (
                        <div key={dedupKey(m) + i} className={`flex ${self ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[75%] rounded-xl px-3 py-1.5 text-sm ${self ? "rounded-br-sm bg-primary/20 text-foreground" : "rounded-bl-sm bg-secondary/60 text-foreground"}`}>
                            <ChatMessageContent text={m.message} />
                            {self && m.deliveryState === "pending" && (
                              <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                                <span>{t("steam.socialSending")}</span>
                              </div>
                            )}
                            {self && m.deliveryState === "failedRetryable" && (
                              <div className="mt-0.5 flex items-center justify-end gap-1.5 text-[10px]">
                                <span className="text-red-500">{t("steam.socialFailed")}</span>
                                <button type="button" onClick={() => void handleRetry(m)} className="text-primary underline">
                                  {t("steam.socialRetry")}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handlePickImage()}
                      disabled={uploading}
                      title={t("steam.socialSendImage")}
                      className="flex-none px-2"
                    >
                      <Icon name="image" size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleStickerPicker}
                      title={t("steam.socialSticker")}
                      className="flex-none px-2"
                    >
                      <Icon name="starFilled" size={16} />
                    </Button>
                    <TextField
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void handleSend();
                        }
                      }}
                      placeholder={t("steam.socialChatPlaceholder")}
                      className="flex-1"
                      density="compact"
                    />
                    <Button variant="primary" size="sm" onClick={() => void handleSend()} disabled={sending || !input.trim()}>
                      {t("steam.socialSend")}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  {t("steam.socialEmptyFriends")}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Groups list */}
            <div className="w-48 shrink-0 overflow-y-auto border-r border-border/40 pr-2">
              {groupsLoading && (
                <div className="py-6 text-center text-xs text-muted-foreground">{t("common.loading")}</div>
              )}
              {groupsError && !groupsLoading && (
                <div className="py-4 px-1 text-xs text-red-500">{t("steam.socialLoadFailed", { error: groupsError })}</div>
              )}
              {groupsStale && !groupsLoading && !groupsError && (
                <div className="py-1 px-1 text-[10px] text-amber-500">{t("steam.socialCacheStale")}</div>
              )}
              {!groupsLoading && !groupsError && groups.length === 0 && (
                <div className="py-6 text-center text-xs text-muted-foreground">{t("steam.socialGroupsEmpty")}</div>
              )}
              {groups.map((g) => {
                const active = selectedGroup?.groupId === g.groupId;
                const room = g.rooms[0];
                return (
                  <button
                    key={g.groupId}
                    type="button"
                    onClick={() => setSelectedGroup(g)}
                    className={`mb-1 w-full rounded-lg px-2 py-1.5 text-left transition-colors ${active ? "bg-primary/15" : "hover:bg-secondary/50"}`}
                  >
                    <div className="truncate text-sm font-medium">{g.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {room?.lastMessage || (room ? room.name : "")}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Group chat */}
            <div className="flex min-w-0 flex-1 flex-col">
              {selectedGroup && selectedGroup.defaultChatId ? (
                <>
                  <div className="mb-2 flex items-center gap-2 border-b border-border/40 pb-2">
                    <Icon name="user" size={14} className="flex-none text-muted-foreground" />
                    <span className="truncate text-sm font-semibold">{selectedGroup.name}</span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {selectedGroup.rooms[0]?.name}
                    </span>
                  </div>
                  <div ref={groupListRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                    {groupMessages.length === 0 && groupHistoryError ? (
                      <div className="break-words px-2 py-8 text-center text-xs text-red-500">
                        {t("steam.socialLoadFailed", { error: groupHistoryError })}
                      </div>
                    ) : groupMessages.length === 0 ? (
                      <div className="py-8 text-center text-xs text-muted-foreground">{t("steam.socialChatEmpty")}</div>
                    ) : null}
                    {groupMessages.map((m, i) => {
                      const self = selfId != null && m.senderSteamId === selfId;
                      return (
                        <div key={groupDedupKey(m) + i} className={`flex ${self ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[75%] rounded-xl px-3 py-1.5 text-sm ${self ? "rounded-br-sm bg-primary/20 text-foreground" : "rounded-bl-sm bg-secondary/60 text-foreground"}`}>
                            {!self && (
                              <div className="mb-0.5 text-[10px] text-muted-foreground">
                                {m.senderSteamId === selfId ? "" : m.senderSteamId.slice(-6)}
                              </div>
                            )}
                            <ChatMessageContent text={m.message} />
                            {self && m.deliveryState === "pending" && (
                              <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                                <span>{t("steam.socialSending")}</span>
                              </div>
                            )}
                            {self && m.deliveryState === "failedRetryable" && (
                              <div className="mt-0.5 flex items-center justify-end gap-1.5 text-[10px]">
                                <span className="text-red-500">{t("steam.socialFailed")}</span>
                                <button type="button" onClick={() => void handleGroupRetry(m)} className="text-primary underline">
                                  {t("steam.socialRetry")}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handlePickImage()}
                      disabled={uploading}
                      title={t("steam.socialSendImage")}
                      className="flex-none px-2"
                    >
                      <Icon name="image" size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleStickerPicker}
                      title={t("steam.socialSticker")}
                      className="flex-none px-2"
                    >
                      <Icon name="starFilled" size={16} />
                    </Button>
                    <TextField
                      value={groupInput}
                      onChange={(e) => setGroupInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void handleGroupSend();
                        }
                      }}
                      placeholder={t("steam.socialChatPlaceholder")}
                      className="flex-1"
                      density="compact"
                    />
                    <Button variant="primary" size="sm" onClick={() => void handleGroupSend()} disabled={groupSending || !groupInput.trim()}>
                      {t("steam.socialSend")}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  {t("steam.socialGroupsEmpty")}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
