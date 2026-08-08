import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Icon from "../ui/Icon";
import TextField from "../ui/TextField";
import Button from "../ui/Button";
import TabButtons from "../ui/TabButtons";
import { showToast } from "../Notification";
import {
  getChatGroups,
  getChatHistory,
  getFriends,
  getGroupHistory,
  pollChat,
  pollGroupMessages,
  sendChatMessage,
  sendGroupMessage,
  type ChatGroupDto,
  type ChatMessageDto,
  type FriendDto,
  type GroupMessageDto,
  type OnlineState,
} from "../../lib/steamSocial";
import type { SessionDto } from "../../lib/steamCommunity";

interface SocialPanelProps {
  session: SessionDto | null;
  embedded?: boolean;
}

function dedupKey(m: ChatMessageDto): string {
  return `${m.timestamp}:${m.steamId}:${m.message}`;
}
function groupDedupKey(m: GroupMessageDto): string {
  return `${m.timestamp}:${m.senderSteamId}:${m.message}`;
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

  // Friends
  const [friends, setFriends] = useState<FriendDto[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // Groups
  const [groups, setGroups] = useState<ChatGroupDto[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<ChatGroupDto | null>(null);
  const [groupMessages, setGroupMessages] = useState<GroupMessageDto[]>([]);
  const [groupHistoryError, setGroupHistoryError] = useState<string | null>(null);
  const [groupInput, setGroupInput] = useState("");
  const [groupSending, setGroupSending] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const groupListRef = useRef<HTMLDivElement>(null);

  const selfId = session?.steamId ?? null;

  // Load friends once per session.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setFriendsLoading(true);
    setFriendsError(null);
    getFriends()
      .then((list) => {
        if (!cancelled) {
          setFriends(list);
          setSelected((prev) => prev ?? list[0]?.steamId ?? null);
        }
      })
      .catch((e) => {
        if (!cancelled) setFriendsError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setFriendsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  // Load groups once per session.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setGroupsLoading(true);
    setGroupsError(null);
    getChatGroups()
      .then((list) => {
        if (!cancelled) {
          setGroups(list);
          setSelectedGroup((prev) => prev ?? list[0] ?? null);
        }
      })
      .catch((e) => {
        if (!cancelled) setGroupsError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setGroupsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  // Load friend chat history when a friend is selected.
  useEffect(() => {
    if (!session || !selected) return;
    let cancelled = false;
    getChatHistory(selected, 50)
      .then((history) => {
        if (!cancelled) {
          setMessages(history);
          setHistoryError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setMessages([]);
          setHistoryError(e instanceof Error ? e.message : String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session, selected]);

  // Load group chat history when a group is selected.
  useEffect(() => {
    if (!session || !selectedGroup) return;
    const chatId = selectedGroup.defaultChatId;
    if (!chatId) return;
    let cancelled = false;
    getGroupHistory(selectedGroup.groupId, chatId)
      .then((history) => {
        if (!cancelled) {
          setGroupMessages(history);
          setGroupHistoryError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setGroupMessages([]);
          setGroupHistoryError(e instanceof Error ? e.message : String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session, selectedGroup]);

  // Poll the CM friend-message buffer.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const incoming = await pollChat();
        if (!cancelled && incoming.length && selected) {
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
        const incoming = await pollGroupMessages();
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
    setMessages((prev) => [
      ...prev,
      { steamId: selfId, timestamp: Math.floor(Date.now() / 1000), message: text, kind: "saytext" },
    ]);
    setSending(true);
    try {
      await sendChatMessage(selected, text);
    } catch (e) {
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
    setGroupMessages((prev) => [
      ...prev,
      {
        groupId: selectedGroup.groupId,
        chatId,
        senderSteamId: selfId,
        timestamp: Math.floor(Date.now() / 1000),
        ordinal: 0,
        message: text,
      },
    ]);
    setGroupSending(true);
    try {
      await sendGroupMessage(selectedGroup.groupId, chatId, text);
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : String(e));
    } finally {
      setGroupSending(false);
    }
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
                    className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
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
                          {f.inGameName
                            ? t("steam.socialInGame", { defaultValue: "游戏中" })
                            : t(style.labelKey, { defaultValue: style.labelKey })}
                        </span>
                      </div>
                    </div>
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
                            {m.message}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
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
                            {m.message}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
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
