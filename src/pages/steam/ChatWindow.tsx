import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import Icon from "../../components/ui/Icon";
import { showToast } from "../../components/Notification";
import ChatThreadView from "../../components/steam/ChatThreadView";
import { useChatThread } from "../../hooks/useChatThread";
import { registerActiveThread } from "../../lib/socialEvents";
import {
  chatDedupKey,
  groupDedupKey,
  unionMessages,
  unionGroupMessages,
  type UiChatMessage,
  type UiGroupMessage,
} from "../../lib/chatThread";
import {
  getChatWindowParams,
  getFriendProfile,
  getStickerCatalog,
  openChat,
  openGroupChat,
  pollThread,
  refreshChat,
  refreshGroupChat,
  sendChatMessage,
  sendGroupMessage,
  sendStickerMessage,
  uploadChatImage,
  uploadGroupImage,
  type ChatWindowParamsDto,
  type FriendDto,
  type StickerDto,
} from "../../lib/steamSocial";
import type { SessionDto } from "../../lib/steamCommunity";

/** Online-state dot color for the header (friend chats). */
const FRIEND_DOT: Record<string, string> = {
  online: "bg-green-500",
  busy: "bg-red-500",
  away: "bg-amber-500",
  snooze: "bg-slate-400",
  lookingToTrade: "bg-purple-500",
  lookingToPlay: "bg-blue-500",
  offline: "bg-slate-300",
};

/** Online-state i18n label key (falls back to "online"). */
const FRIEND_LABEL: Record<string, string> = {
  online: "socialOnline",
  busy: "socialBusy",
  away: "socialAway",
  snooze: "socialSnooze",
  lookingToTrade: "socialLookingTrade",
  lookingToPlay: "socialLookingPlay",
  offline: "socialOffline",
};

/**
 * The `/chat` route — a Steam-style popup chat window. Loaded in its own OS
 * window, it shows ONE thread (friend or group) driven by the shared
 * `useChatThread` state machine + `ChatThreadView`.
 *
 * It registers itself as the active thread so the backend poller and the main
 * window suppress unread for the open conversation, and clears on unmount AND
 * on OS-window close (the webview is destroyed on close, so React cleanup alone
 * is not reliable). The thread identity + display info arrive from the backend
 * static table via `get_chat_window_params` (not the URL).
 */
export default function ChatWindow() {
  const { t } = useTranslation();
  // undefined = params loading, null = no params for this window.
  const [params, setParams] = useState<ChatWindowParamsDto | null | undefined>(undefined);
  const [session, setSession] = useState<SessionDto | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  // E4 图片 / 贴纸
  const [uploading, setUploading] = useState(false);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [stickers, setStickers] = useState<StickerDto[]>([]);
  const [stickersLoading, setStickersLoading] = useState(false);
  const stickersLoadedRef = useRef(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    getChatWindowParams()
      .then(setParams)
      .catch(() => setParams(null));
    invoke<SessionDto | null>("get_active_session")
      .then(setSession)
      .finally(() => setSessionLoaded(true));
  }, []);

  // Live friend persona (status dot + in-game) for the header — best-effort.
  const [friendProfile, setFriendProfile] = useState<FriendDto | null>(null);
  useEffect(() => {
    if (params?.kind !== "friend" || !params.id) return;
    let cancelled = false;
    getFriendProfile(params.id)
      .then((p) => {
        if (!cancelled) setFriendProfile(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [params?.kind, params?.id]);

  const selfId = session?.steamId ?? null;
  const isFriend = params?.kind === "friend";
  const friendId = isFriend ? (params?.id ?? null) : null;
  const groupInfo = useMemo(
    () =>
      params?.kind === "group" && params.id && params.chatId
        ? ([params.id, params.chatId] as [string, string])
        : null,
    [params?.kind, params?.id, params?.chatId],
  );

  // Friend thread (active only when this is a friend window).
  const friendChat = useChatThread<UiChatMessage>({
    active: !!session && !!friendId,
    selfId,
    scrollKey: `f:${friendId ?? ""}`,
    refreshKey: refreshTick,
    open: () => openChat(friendId as string),
    refresh: (olderThan) => refreshChat(friendId as string, olderThan),
    send: (text) => sendChatMessage(friendId as string, text),
    buildOptimistic: (text, localId) => ({
      steamId: selfId as string,
      timestamp: Math.floor(Date.now() / 1000),
      message: text,
      kind: "saytext",
      deliveryState: "pending",
      localId,
    }),
    isSelf: (m) => m.steamId === selfId,
    isThreadMessage: (m) => m.steamId === friendId || m.steamId === selfId,
    merge: unionMessages,
    dedup: chatDedupKey,
    eventName: "social:chat",
    matchIncoming: (m) => m.steamId === friendId,
  });

  // Group thread (active only when this is a group window).
  const groupChat = useChatThread<UiGroupMessage>({
    active: !!session && !!groupInfo,
    selfId,
    scrollKey: `g:${groupInfo?.[0] ?? ""}:${groupInfo?.[1] ?? ""}`,
    refreshKey: refreshTick,
    open: () => openGroupChat(groupInfo![0], groupInfo![1]),
    refresh: (olderThan) => refreshGroupChat(groupInfo![0], groupInfo![1], olderThan),
    send: (text) => sendGroupMessage(groupInfo![0], groupInfo![1], text),
    buildOptimistic: (text, localId) => ({
      groupId: groupInfo![0],
      chatId: groupInfo![1],
      senderSteamId: selfId as string,
      timestamp: Math.floor(Date.now() / 1000),
      ordinal: 0,
      message: text,
      deliveryState: "pending",
      localId,
    }),
    isSelf: (m) => m.senderSteamId === selfId,
    isThreadMessage: (m) => m.groupId === groupInfo?.[0] && m.chatId === groupInfo?.[1],
    merge: unionGroupMessages,
    dedup: groupDedupKey,
    eventName: "social:group",
    matchIncoming: (m) => m.groupId === groupInfo?.[0] && m.chatId === groupInfo?.[1],
  });

  // Register as the active thread. `registerActiveThread` invokes the backend
  // `set_active_thread`, which both stores the process-wide ACTIVE_THREAD (the
  // poller suppresses cache unread for it) AND broadcasts `social:active-thread`
  // to all windows (so the main window's store mirrors it). Clear on unmount and
  // on OS-window close.
  useEffect(() => {
    if (!params || !session) return;
    const clear = () => registerActiveThread({});
    if (isFriend && friendId) {
      registerActiveThread({ partner: friendId });
    } else if (groupInfo) {
      registerActiveThread({ group: [groupInfo[0], groupInfo[1]] });
    }
    const unlisten = getCurrentWebviewWindow().onCloseRequested(clear);
    return () => {
      clear();
      unlisten.then((fn) => fn());
    };
  }, [params, session, isFriend, friendId, groupInfo]);

  // Live-message fallback: poll the cache every few seconds. The background
  // poller writes incoming messages there, so this is reliable even when
  // cross-window event delivery to this sub-window is unavailable. The merge
  // dedups, so the event listener and this poll never double-append.
  const friendSet = friendChat.setMessages;
  const groupSet = groupChat.setMessages;
  useEffect(() => {
    if (!session) return;
    const timer = setInterval(() => {
      void (async () => {
        try {
          const list = await pollThread(
            isFriend ? "friend" : "group",
            isFriend ? (friendId ?? "") : (groupInfo?.[0] ?? ""),
            isFriend ? null : groupInfo?.[1],
          );
          if (isFriend && friendId) {
            friendSet((prev) =>
              unionMessages(list as UiChatMessage[], prev, selfId ?? undefined) as UiChatMessage[],
            );
          } else if (groupInfo) {
            groupSet((prev) =>
              unionGroupMessages(list as UiGroupMessage[], prev, selfId ?? undefined) as UiGroupMessage[],
            );
          }
        } catch {
          // transient — the next poll retries
        }
      })();
    }, 4000);
    return () => clearInterval(timer);
  }, [session, isFriend, friendId, groupInfo, selfId, friendSet, groupSet]);

  // E4: toggle the sticker picker (loads the catalogue once).
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
      if (isFriend) {
        if (!friendId) throw new Error(t("steam.socialEmptyFriends"));
        await uploadChatImage(file, friendId);
      } else {
        if (!groupInfo) throw new Error(t("steam.socialGroupsEmpty"));
        await uploadGroupImage(file, groupInfo[0], groupInfo[1]);
      }
      showToast("success", t("steam.socialImageSent"));
      // Steam inserts the image server-side — re-run the open cycle to show it.
      setRefreshTick((x) => x + 1);
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  // E4: send a sticker to the active chat.
  const handleSendSticker = async (name: string) => {
    if (!selfId) return;
    if (isFriend) {
      if (!friendId) return;
      friendChat.setMessages((prev) => [
        ...prev,
        { steamId: selfId, timestamp: Math.floor(Date.now() / 1000), message: `/sticker ${name}`, kind: "saytext" },
      ]);
      try {
        await sendStickerMessage(friendId, name);
      } catch (e) {
        showToast("error", e instanceof Error ? e.message : String(e));
      }
    } else {
      if (!groupInfo) return;
      groupChat.setMessages((prev) => [
        ...prev,
        {
          groupId: groupInfo[0],
          chatId: groupInfo[1],
          senderSteamId: selfId,
          timestamp: Math.floor(Date.now() / 1000),
          ordinal: 0,
          message: `/sticker ${name}`,
        },
      ]);
      try {
        await sendGroupMessage(groupInfo[0], groupInfo[1], `/sticker ${name}`);
      } catch (e) {
        showToast("error", e instanceof Error ? e.message : String(e));
      }
    }
    setStickerPickerOpen(false);
  };

  if (!sessionLoaded || params === undefined) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }
  if (!session) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 text-muted-foreground">
        <Icon name="steamLogin" size={32} />
        <div className="text-sm">{t("steam.socialNoSession")}</div>
      </div>
    );
  }
  if (params === null) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        {t("steam.socialChatEmpty")}
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col p-3">
      {/* Header: avatar + name + (friend) status + profile link */}
      <div className="mb-2 flex items-center gap-2 border-b border-border/40 pb-2">
        {params.avatar ? (
          <img src={params.avatar} alt="" className="h-8 w-8 flex-none rounded-full" />
        ) : (
          <Icon name="user" size={16} className="flex-none text-muted-foreground" />
        )}
        <span className="truncate text-sm font-semibold">{params.name}</span>
        {isFriend && friendProfile && (
          <span className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
            <span className={`h-2 w-2 flex-none rounded-full ${FRIEND_DOT[friendProfile.onlineState] ?? "bg-slate-300"}`} />
            <span className="truncate">
              {friendProfile.inGameName
                ? `${t("steam.socialInGame", { defaultValue: "游戏中" })} ${friendProfile.inGameName}`
                : t(FRIEND_LABEL[friendProfile.onlineState] ?? "socialOnline", { defaultValue: "" })}
            </span>
          </span>
        )}
        {isFriend && (
          <button
            type="button"
            onClick={() => void invoke("open_url", { url: `https://steamcommunity.com/profiles/${params.id}` })}
            className="ml-auto flex-none text-xs text-primary underline"
          >
            {t("steam.openProfile")}
          </button>
        )}
      </div>

      {(stickerPickerOpen || uploading) && (
        <div className="mb-2 rounded-[var(--radius)] border border-border/40 p-2">
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

      <div className="flex min-h-0 flex-1 flex-col">
        {isFriend ? (
          <ChatThreadView
            api={friendChat}
            avatarOf={(m) => (friendChat.isSelf(m) ? null : (params.avatar ?? null))}
            sameSender={(a, b) => a.steamId === b.steamId}
            emptyKey="steam.socialChatEmpty"
            onPickImage={() => void handlePickImage()}
            onToggleSticker={toggleStickerPicker}
            uploading={uploading}
            imageTitle={t("steam.socialSendImage")}
            stickerTitle={t("steam.socialSticker")}
            placeholder={t("steam.socialChatPlaceholder")}
            sendLabel={t("steam.socialSend")}
          />
        ) : groupInfo ? (
          <ChatThreadView
            api={groupChat}
            showSender
            senderLabel={(m) => m.senderSteamId.slice(-6)}
            sameSender={(a, b) => a.senderSteamId === b.senderSteamId}
            emptyKey="steam.socialChatEmpty"
            onPickImage={() => void handlePickImage()}
            onToggleSticker={toggleStickerPicker}
            uploading={uploading}
            imageTitle={t("steam.socialSendImage")}
            stickerTitle={t("steam.socialSticker")}
            placeholder={t("steam.socialChatPlaceholder")}
            sendLabel={t("steam.socialSend")}
          />
        ) : null}
      </div>
    </div>
  );
}
