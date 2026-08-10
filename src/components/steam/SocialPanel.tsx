import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import Icon from "../ui/Icon";
import TextField from "../ui/TextField";
import TabButtons from "../ui/TabButtons";
import {
  loadFriends,
  loadGroups,
  refreshFriends,
  refreshGroups,
  type ChatGroupDto,
  type FriendDto,
  type OnlineState,
} from "../../lib/steamSocial";
import { useSocialState } from "../../lib/socialEvents";
import { useCachedList } from "../../hooks/useCachedList";
import type { SessionDto } from "../../lib/steamCommunity";

interface SocialPanelProps {
  session: SessionDto | null;
  embedded?: boolean;
}

/** Online-state label + status dot/ring color. */
const STATE_STYLES: Record<OnlineState, { labelKey: string; dot: string; ring: string }> = {
  online: { labelKey: "socialOnline", dot: "bg-green-500", ring: "ring-green-500" },
  busy: { labelKey: "socialBusy", dot: "bg-red-500", ring: "ring-red-500" },
  away: { labelKey: "socialAway", dot: "bg-amber-500", ring: "ring-amber-500" },
  snooze: { labelKey: "socialSnooze", dot: "bg-slate-400", ring: "ring-slate-400" },
  lookingToTrade: { labelKey: "socialLookingTrade", dot: "bg-purple-500", ring: "ring-purple-500" },
  lookingToPlay: { labelKey: "socialLookingPlay", dot: "bg-blue-500", ring: "ring-blue-500" },
  offline: { labelKey: "socialOffline", dot: "bg-slate-300", ring: "ring-slate-300" },
};

/**
 * 社交 Tab: friend / group lists. Chat itself lives in a separate OS window
 * (Steam-style): clicking a row calls `open_chat_window`, which opens (or
 * focuses) the `/chat` sub-window for that thread. Unread/preview data comes
 * from the `socialEvents` store, fed by the background poller + chat windows.
 */
export default function SocialPanel({ session, embedded = false }: SocialPanelProps) {
  const { t } = useTranslation();
  const [socialMode, setSocialMode] = useState<"friends" | "groups">("friends");

  // Last-clicked thread (row highlight only — the chat itself is in a window).
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
    loading: groupsLoading,
    stale: groupsStale,
    staleError: groupsStaleError,
    error: groupsError,
  } = groupsState;

  // Live unread + previews come from the module store (`socialEvents`), seeded
  // by SteamHub on mount and incremented by live events / chat windows.
  const social = useSocialState();

  // S2: list search + grouping + recent-conversation sort.
  const [query, setQuery] = useState("");

  // Friends split into 游戏中 / 在线 / 离线 sections; within each, sort by the
  // most recent conversation (falling back to name when there is none).
  const friendSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = friends.filter(
      (f) => !q || (f.personaName ?? f.steamId.slice(-6)).toLowerCase().includes(q),
    );
    const sortByRecent = (arr: FriendDto[]) =>
      [...arr].sort((a, b) => {
        const ta = social.friendPreviews[a.steamId]?.lastTimestamp ?? 0;
        const tb = social.friendPreviews[b.steamId]?.lastTimestamp ?? 0;
        if (tb !== ta) return tb - ta;
        return (a.personaName ?? a.steamId).localeCompare(b.personaName ?? b.steamId);
      });
    return [
      {
        key: "inGame",
        labelKey: "socialGroupInGame",
        list: sortByRecent(filtered.filter((f) => f.inGameName)),
      },
      {
        key: "online",
        labelKey: "socialGroupOnline",
        list: sortByRecent(filtered.filter((f) => !f.inGameName && f.onlineState !== "offline")),
      },
      {
        key: "offline",
        labelKey: "socialGroupOffline",
        list: sortByRecent(filtered.filter((f) => f.onlineState === "offline")),
      },
    ].filter((s) => s.list.length > 0);
  }, [friends, query, social.friendPreviews]);

  // Groups sorted by the most recent conversation (default room's preview).
  const sortedGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = groups.filter((g) => !q || g.name.toLowerCase().includes(q));
    return [...filtered].sort((a, b) => {
      const roomOf = (g: ChatGroupDto) =>
        g.rooms.find((r) => r.chatId === g.defaultChatId) ?? g.rooms[0];
      const roomA = roomOf(a);
      const roomB = roomOf(b);
      const tsOf = (g: ChatGroupDto, room: { chatId: string; lastMessageTimestamp: number }) =>
        social.groupPreviews[`${g.groupId}:${room.chatId}`]?.lastTimestamp ??
        room.lastMessageTimestamp ??
        0;
      return tsOf(b, roomB!) - tsOf(a, roomA!);
    });
  }, [groups, query, social.groupPreviews]);

  /** A loading skeleton row (avatar circle + two lines). */
  const skeletonRow = (key: number) => (
    <div key={key} className="flex items-center gap-3 px-3 py-2">
      <div className="h-10 w-10 flex-none animate-pulse rounded-full bg-secondary/40" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-24 animate-pulse rounded bg-secondary/40" />
        <div className="h-2 w-40 animate-pulse rounded bg-secondary/30" />
      </div>
    </div>
  );

  /** Open (or focus) the friend's chat sub-window. */
  const openFriendChat = (f: FriendDto) => {
    setSelected(f.steamId);
    void invoke("open_chat_window", {
      kind: "friend",
      id: f.steamId,
      name: f.personaName || f.steamId.slice(-6),
      avatar: f.avatarUrl,
    }).catch((e) => showError(e));
  };

  /** Open (or focus) the group channel's chat sub-window. */
  const openGroupChat = (g: ChatGroupDto) => {
    setSelectedGroup(g);
    if (!g.defaultChatId) return;
    void invoke("open_chat_window", {
      kind: "group",
      id: g.groupId,
      chatId: g.defaultChatId,
      name: g.name,
    }).catch((e) => showError(e));
  };

  function showError(e: unknown) {
    // best-effort: opening a window is non-critical, surface silently via console
    console.error("open_chat_window failed", e);
  }

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

      <div className="app-surface app-glass-card rounded-[var(--radius)] border border-border/40 p-3">
        {socialMode === "friends" ? (
          <div className="flex flex-col gap-1">
            <TextField
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("steam.socialSearchFriends")}
              className="mb-1 w-full"
              density="compact"
            />
            {friendsLoading &&
              [0, 1, 2, 3].map((i) => skeletonRow(i))}
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
            {!friendsLoading && !friendsError && friendSections.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Icon name={query ? "search" : "user"} size={28} />
                <div className="text-xs">
                  {query ? t("steam.socialNoResults") : t("steam.socialEmptyFriends")}
                </div>
              </div>
            )}
            {friendSections.map((section) => (
              <Fragment key={section.key}>
                <div className="mt-1 px-1 text-[11px] font-semibold text-muted-foreground">
                  {t(`steam.${section.labelKey}`)}
                </div>
                {section.list.map((f) => {
                  const style = STATE_STYLES[f.onlineState] ?? STATE_STYLES.offline;
                  const active = f.steamId === selected;
                  return (
                    <button
                      key={f.steamId}
                      type="button"
                      onClick={() => openFriendChat(f)}
                      className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                        active ? "bg-primary/15" : "hover:bg-secondary/50"
                      }`}
                    >
                      {f.avatarUrl ? (
                        <img
                          src={f.avatarUrl}
                          alt=""
                          className={`h-10 w-10 flex-none rounded-full ring-2 ${style.ring}`}
                        />
                      ) : (
                        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-secondary/40 text-muted-foreground">
                          <Icon name="user" size={16} />
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
                        <span className="flex h-5 min-w-5 flex-none items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-medium text-white">
                          {social.friendUnread[f.steamId]! > 99 ? "99+" : social.friendUnread[f.steamId]}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </Fragment>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <TextField
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("steam.socialSearchGroups")}
              className="mb-1 w-full"
              density="compact"
            />
            {groupsLoading &&
              [0, 1, 2, 3].map((i) => skeletonRow(i))}
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
            {!groupsLoading && !groupsError && sortedGroups.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Icon name={query ? "search" : "steamAccounts"} size={28} />
                <div className="text-xs">
                  {query ? t("steam.socialNoResults") : t("steam.socialGroupsEmpty")}
                </div>
              </div>
            )}
            {sortedGroups.map((g) => {
              const active = selectedGroup?.groupId === g.groupId;
              // The UI opens `defaultChatId` — preview/badge must follow it,
              // not blindly `rooms[0]` (the default chat may not be first).
              const room = g.rooms.find((r) => r.chatId === g.defaultChatId) ?? g.rooms[0];
              const roomKey = room ? `${g.groupId}:${room.chatId}` : "";
              // Live store value wins; fall back to the backend-augmented
              // room summary before the store has been seeded for this room.
              const unread = room ? (social.groupUnread[roomKey] ?? room.unreadCount) : 0;
              return (
                <button
                  key={g.groupId}
                  type="button"
                  onClick={() => openGroupChat(g)}
                  className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                    active ? "bg-primary/15" : "hover:bg-secondary/50"
                  }`}
                >
                  <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-secondary/40 text-muted-foreground">
                    <Icon name="user" size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{g.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {social.groupPreviews[roomKey]?.lastMessage ??
                        (room?.lastMessage || (room ? room.name : ""))}
                    </div>
                  </div>
                  {unread > 0 ? (
                    <span className="flex h-5 min-w-5 flex-none items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-medium text-white">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
