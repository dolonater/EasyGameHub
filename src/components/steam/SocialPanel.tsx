import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Icon from "../ui/Icon";
import TabButtons from "../ui/TabButtons";
import { showToast } from "../Notification";
import {
  getStickerCatalog,
  loadFriends,
  loadGroups,
  openChat,
  openGroupChat,
  refreshChat,
  refreshFriends,
  refreshGroupChat,
  refreshGroups,
  sendChatMessage,
  sendGroupMessage,
  sendStickerMessage,
  uploadChatImage,
  uploadGroupImage,
  type ChatGroupDto,
  type ChatMessageDto,
  type FriendDto,
  type GroupMessageDto,
  type OnlineState,
  type StickerDto,
} from "../../lib/steamSocial";
import {
  clearFriendUnread,
  clearGroupUnread,
  registerActiveThread,
  useSocialState,
} from "../../lib/socialEvents";
import { useCachedList } from "../../hooks/useCachedList";
import { useChatThread } from "../../hooks/useChatThread";
import ChatThreadView from "./ChatThreadView";
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

/**
 * Prefer `a` (server truth), then append `b`'s messages not already in `a`.
 * Our own sends are additionally deduplicated by body: the optimistic bubble
 * (local timestamp) and the confirmed server copy (server timestamp) are the
 * same message even when the second boundary crossed, so the bubble is dropped
 * in favour of the server copy.
 */
function unionMessages(a: ChatMessageDto[], b: ChatMessageDto[], selfId?: string): ChatMessageDto[] {
  const seen = new Set(a.map(dedupKey));
  const selfBodies = new Set(
    selfId ? a.filter((m) => m.steamId === selfId).map((m) => m.message) : [],
  );
  return [
    ...a,
    ...b.filter((m) => {
      if (seen.has(dedupKey(m))) return false;
      if (selfId && m.steamId === selfId && selfBodies.has(m.message)) return false;
      return true;
    }),
  ];
}

/** Group-thread variant of `unionMessages`. */
function unionGroupMessages(
  a: GroupMessageDto[],
  b: GroupMessageDto[],
  selfId?: string,
): GroupMessageDto[] {
  const seen = new Set(a.map(groupDedupKey));
  const selfBodies = new Set(
    selfId ? a.filter((m) => m.senderSteamId === selfId).map((m) => m.message) : [],
  );
  return [
    ...a,
    ...b.filter((m) => {
      if (seen.has(groupDedupKey(m))) return false;
      if (selfId && m.senderSteamId === selfId && selfBodies.has(m.message)) return false;
      return true;
    }),
  ];
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

/**
 * 社交 Tab: friend list + private chat (web-chat/CM) AND group chat rooms.
 * Both only work with an active Steam session.
 */
export default function SocialPanel({ session, embedded = false }: SocialPanelProps) {
  const { t } = useTranslation();
  const [socialMode, setSocialMode] = useState<"friends" | "groups">("friends");

  // Thread selection (persists across mode toggles).
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<ChatGroupDto | null>(null);

  // Friends list: cached first (instant), then a silent network refresh.
  const friendsState = useCachedList<FriendDto>({
    enabled: !!session,
    load: loadFriends,
    refresh: refreshFriends,
    onCache: (list) => setSelected((prev) => prev ?? list[0]?.steamId ?? null),
  });
  const {
    list: friends,
    setList: setFriends,
    loading: friendsLoading,
    stale: friendsStale,
    staleError: friendsStaleError,
    error: friendsError,
  } = friendsState;

  // Groups list: same cache-first pattern.
  const groupsState = useCachedList<ChatGroupDto>({
    enabled: !!session,
    load: loadGroups,
    refresh: refreshGroups,
    onCache: (list) => setSelectedGroup((prev) => prev ?? list[0] ?? null),
  });
  const {
    list: groups,
    setList: setGroups,
    loading: groupsLoading,
    stale: groupsStale,
    staleError: groupsStaleError,
    error: groupsError,
  } = groupsState;

  // E4 图片 / 贴纸
  const [uploading, setUploading] = useState(false);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [stickers, setStickers] = useState<StickerDto[]>([]);
  const [stickersLoading, setStickersLoading] = useState(false);
  const stickersLoadedRef = useRef(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const selfId = session?.steamId ?? null;

  // Live unread + previews come from the module store (`socialEvents`), seeded
  // by SteamHub on mount and incremented by live events — no O(friends)
  // recompute per message (P1-8).
  const social = useSocialState();

  // Friend private-chat thread: messages, optimistic send/retry, live append,
  // scroll-to-top load-older and the pre-paint scroll authority all live in
  // `useChatThread`. Runs only in friends mode with a selected friend.
  const friendChat = useChatThread<UiChatMessage>({
    active: !!session && socialMode === "friends" && !!selected,
    selfId,
    scrollKey: `f:${selected ?? ""}`,
    refreshKey: refreshTick,
    open: () => openChat(selected as string),
    refresh: (olderThan) => refreshChat(selected as string, olderThan),
    send: (text) => sendChatMessage(selected as string, text),
    buildOptimistic: (text, localId) => ({
      steamId: selfId as string,
      timestamp: Math.floor(Date.now() / 1000),
      message: text,
      kind: "saytext",
      deliveryState: "pending",
      localId,
    }),
    isSelf: (m) => m.steamId === selfId,
    isThreadMessage: (m) => m.steamId === selected || m.steamId === selfId,
    merge: unionMessages,
    dedup: dedupKey,
    eventName: "social:chat",
    matchIncoming: (m) => m.steamId === selected,
    onOpened: () => clearFriendUnread(selected as string),
  });

  // Group-channel thread: the same state machine driven by group commands.
  const groupChat = useChatThread<UiGroupMessage>({
    active: !!session && socialMode === "groups" && !!selectedGroup?.defaultChatId,
    selfId,
    scrollKey: `g:${selectedGroup?.groupId ?? ""}:${selectedGroup?.defaultChatId ?? ""}`,
    refreshKey: refreshTick,
    open: () => openGroupChat(selectedGroup!.groupId, selectedGroup!.defaultChatId!),
    refresh: (olderThan) =>
      refreshGroupChat(selectedGroup!.groupId, selectedGroup!.defaultChatId!, olderThan),
    send: (text) => sendGroupMessage(selectedGroup!.groupId, selectedGroup!.defaultChatId!, text),
    buildOptimistic: (text, localId) => ({
      groupId: selectedGroup!.groupId,
      chatId: selectedGroup!.defaultChatId!,
      senderSteamId: selfId as string,
      timestamp: Math.floor(Date.now() / 1000),
      ordinal: 0,
      message: text,
      deliveryState: "pending",
      localId,
    }),
    isSelf: (m) => m.senderSteamId === selfId,
    isThreadMessage: (m) =>
      m.groupId === selectedGroup?.groupId && m.chatId === selectedGroup?.defaultChatId,
    merge: unionGroupMessages,
    dedup: groupDedupKey,
    eventName: "social:group",
    matchIncoming: (m) =>
      m.groupId === selectedGroup?.groupId && m.chatId === selectedGroup?.defaultChatId,
    onOpened: () => {
      clearGroupUnread(selectedGroup!.groupId, selectedGroup!.defaultChatId!);
      loadGroups()
        .then((list) => setGroups(list))
        .catch(() => {});
    },
  });

  // Report the open thread so the store and the backend poller suppress its
  // unread. Clearing on unmount leaves the app open to counting again.
  useEffect(() => {
    if (!session) {
      registerActiveThread({});
      return;
    }
    if (socialMode === "friends") {
      registerActiveThread({ partner: selected ?? null });
    } else {
      registerActiveThread({
        group: selectedGroup?.defaultChatId
          ? [selectedGroup.groupId, selectedGroup.defaultChatId]
          : null,
      });
    }
    return () => registerActiveThread({});
  }, [session, socialMode, selected, selectedGroup]);

  const selectedFriend = useMemo(
    () => friends.find((f) => f.steamId === selected) ?? null,
    [friends, selected],
  );

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
      friendChat.setMessages((prev) => [
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
      groupChat.setMessages((prev) => [
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
                <div className="py-1 px-1 text-[10px] text-amber-500">
                  {t("steam.socialCacheStale")}
                  {friendsStaleError && (
                    <span className="block break-all text-[9px] opacity-75">{friendsStaleError}</span>
                  )}
                </div>
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
                          {social.friendPreviews[f.steamId]?.lastMessage
                            ? social.friendPreviews[f.steamId]!.lastMessage
                            : f.inGameName
                              ? t("steam.socialInGame", { defaultValue: "游戏中" })
                              : t(style.labelKey, { defaultValue: style.labelKey })}
                        </span>
                      </div>
                    </div>
                    {social.friendUnread[f.steamId] ? (
                      <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                        {social.friendUnread[f.steamId]! > 99 ? "99+" : social.friendUnread[f.steamId]}
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
                  <ChatThreadView
                    api={friendChat}
                    emptyKey="steam.socialChatEmpty"
                    onPickImage={() => void handlePickImage()}
                    onToggleSticker={toggleStickerPicker}
                    uploading={uploading}
                    imageTitle={t("steam.socialSendImage")}
                    stickerTitle={t("steam.socialSticker")}
                    placeholder={t("steam.socialChatPlaceholder")}
                    sendLabel={t("steam.socialSend")}
                  />
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
                <div className="py-1 px-1 text-[10px] text-amber-500">
                  {t("steam.socialCacheStale")}
                  {groupsStaleError && (
                    <span className="block break-all text-[9px] opacity-75">{groupsStaleError}</span>
                  )}
                </div>
              )}
              {!groupsLoading && !groupsError && groups.length === 0 && (
                <div className="py-6 text-center text-xs text-muted-foreground">{t("steam.socialGroupsEmpty")}</div>
              )}
              {groups.map((g) => {
                const active = selectedGroup?.groupId === g.groupId;
                // The UI opens `defaultChatId` — preview/badge must follow it,
                // not blindly `rooms[0]` (the default chat may not be first).
                const room =
                  g.rooms.find((r) => r.chatId === g.defaultChatId) ?? g.rooms[0];
                const roomKey = room ? `${g.groupId}:${room.chatId}` : "";
                // Live store value wins; fall back to the backend-augmented
                // room summary before the store has been seeded for this room.
                const unread = room
                  ? (social.groupUnread[roomKey] ?? room.unreadCount)
                  : 0;
                return (
                  <button
                    key={g.groupId}
                    type="button"
                    onClick={() => setSelectedGroup(g)}
                    className={`relative mb-1 w-full rounded-lg px-2 py-1.5 text-left transition-colors ${active ? "bg-primary/15" : "hover:bg-secondary/50"}`}
                  >
                    <div className="truncate text-sm font-medium">{g.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {social.groupPreviews[roomKey]?.lastMessage ??
                        (room?.lastMessage || (room ? room.name : ""))}
                    </div>
                    {unread > 0 ? (
                      <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    ) : null}
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
                  <ChatThreadView
                    api={groupChat}
                    showSender
                    senderLabel={(m) => m.senderSteamId.slice(-6)}
                    emptyKey="steam.socialChatEmpty"
                    onPickImage={() => void handlePickImage()}
                    onToggleSticker={toggleStickerPicker}
                    uploading={uploading}
                    imageTitle={t("steam.socialSendImage")}
                    stickerTitle={t("steam.socialSticker")}
                    placeholder={t("steam.socialChatPlaceholder")}
                    sendLabel={t("steam.socialSend")}
                  />
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
