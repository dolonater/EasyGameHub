import { useSyncExternalStore } from "react";
import { setActiveThread } from "./steamSocial";
import type { ChatGroupDto, ChatMessageDto, ChatSessionDto, GroupMessageDto } from "./steamSocial";

/**
 * Module-level store for live social events (`social:chat` / `social:group`).
 *
 * Lives outside React so unread counts and previews survive route switches and
 * Steam hub sub-tab changes — SocialPanel unmounts when you leave the social
 * tab, but the badge must keep counting. Mirrors `steamHubCache.ts`.
 *
 * The active thread is tracked here AND mirrored to the backend
 * (`set_active_thread`) so the background poller suppresses its unread too.
 */
export interface SocialEventsState {
  /** Unread per friend (partner steamid → count). */
  friendUnread: Record<string, number>;
  /** Unread per group channel ("groupId:chatId" → count). */
  groupUnread: Record<string, number>;
  /** Sum of all unread (the social-tab badge). */
  totalUnread: number;
  /** Last-message preview per friend. */
  friendPreviews: Record<string, { lastMessage: string; lastTimestamp: number }>;
  /** Last-message preview per group channel. */
  groupPreviews: Record<string, { lastMessage: string; lastTimestamp: number }>;
  /** Currently open friend thread (unread suppression). */
  activePartner: string | null;
  /** Currently open group channel ("groupId:chatId", unread suppression). */
  activeGroup: string | null;
}

const initial: SocialEventsState = {
  friendUnread: {},
  groupUnread: {},
  totalUnread: 0,
  friendPreviews: {},
  groupPreviews: {},
  activePartner: null,
  activeGroup: null,
};

let state: SocialEventsState = initial;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emitChange() {
  listeners.forEach((l) => l());
}

function patch(p: Partial<SocialEventsState>) {
  state = { ...state, ...p };
  emitChange();
}

function recomputeTotal(s: SocialEventsState): SocialEventsState {
  let total = 0;
  for (const k in s.friendUnread) total += s.friendUnread[k];
  for (const k in s.groupUnread) total += s.groupUnread[k];
  return { ...s, totalUnread: total };
}

/** Subscribe a component to the live social state. */
export function useSocialState(): SocialEventsState {
  return useSyncExternalStore(subscribe, () => state);
}

/**
 * Apply a batch of incoming friend messages (from `social:chat`). Messages for
 * the active thread are skipped (SocialPanel renders them itself). Returns the
 * messages that were counted as unread, so the caller can decide about toasts.
 */
export function applyChatEvent(messages: ChatMessageDto[]): ChatMessageDto[] {
  const counted: ChatMessageDto[] = [];
  const friendUnread = { ...state.friendUnread };
  const friendPreviews = { ...state.friendPreviews };
  for (const m of messages) {
    if (m.steamId === state.activePartner) continue;
    counted.push(m);
    friendUnread[m.steamId] = (friendUnread[m.steamId] ?? 0) + 1;
    friendPreviews[m.steamId] = { lastMessage: m.message, lastTimestamp: m.timestamp };
  }
  if (counted.length) patch(recomputeTotal({ ...state, friendUnread, friendPreviews }));
  return counted;
}

/** Group-thread variant of `applyChatEvent`. */
export function applyGroupEvent(messages: GroupMessageDto[]): GroupMessageDto[] {
  const counted: GroupMessageDto[] = [];
  const groupUnread = { ...state.groupUnread };
  const groupPreviews = { ...state.groupPreviews };
  for (const m of messages) {
    const key = `${m.groupId}:${m.chatId}`;
    if (key === state.activeGroup) continue;
    counted.push(m);
    groupUnread[key] = (groupUnread[key] ?? 0) + 1;
    groupPreviews[key] = { lastMessage: m.message, lastTimestamp: m.timestamp };
  }
  if (counted.length) patch(recomputeTotal({ ...state, groupUnread, groupPreviews }));
  return counted;
}

/** A flattened group-channel summary used to seed the store (from `load_groups`). */
export interface GroupRoomSummary {
  key: string;
  unread: number;
  lastMessage: string;
  lastTimestamp: number;
}

/**
 * Seed friend unread/previews from the backend's session summaries (called once
 * on mount, e.g. from `refresh_sessions`). Only fills ABSENT keys — live event
 * counts are never overwritten, so a re-seed on remount cannot double-count and
 * cannot clobber a count that is mid-flight.
 */
export function seedSocialFriends(sessions: ChatSessionDto[]): void {
  const friendUnread = { ...state.friendUnread };
  const friendPreviews = { ...state.friendPreviews };
  for (const s of sessions) {
    if (s.unreadCount > 0) {
      friendUnread[s.partnerSteamId] = friendUnread[s.partnerSteamId] ?? s.unreadCount;
    }
    friendPreviews[s.partnerSteamId] = friendPreviews[s.partnerSteamId] ?? {
      lastMessage: s.lastMessage,
      lastTimestamp: s.lastTimestamp,
    };
  }
  patch(recomputeTotal({ ...state, friendUnread, friendPreviews }));
}

/** Group variant of `seedSocialFriends`. */
export function seedSocialGroups(rooms: GroupRoomSummary[]): void {
  const groupUnread = { ...state.groupUnread };
  const groupPreviews = { ...state.groupPreviews };
  for (const r of rooms) {
    if (r.unread > 0) {
      groupUnread[r.key] = groupUnread[r.key] ?? r.unread;
    }
    groupPreviews[r.key] = groupPreviews[r.key] ?? {
      lastMessage: r.lastMessage,
      lastTimestamp: r.lastTimestamp,
    };
  }
  patch(recomputeTotal({ ...state, groupUnread, groupPreviews }));
}

/** Seed group unread/previews from a loaded group list (rooms carry augmented unread). */
export function seedSocialGroupsFromGroups(groups: ChatGroupDto[]): void {
  seedSocialGroups(
    groups.flatMap((g) =>
      g.rooms.map((r) => ({
        key: `${g.groupId}:${r.chatId}`,
        unread: r.unreadCount,
        lastMessage: r.lastMessage,
        lastTimestamp: r.lastMessageTimestamp,
      })),
    ),
  );
}

/** Clear one friend's unread (when its thread is opened). */
export function clearFriendUnread(partner: string): void {
  if (!(partner in state.friendUnread)) return;
  const friendUnread = { ...state.friendUnread };
  delete friendUnread[partner];
  patch(recomputeTotal({ ...state, friendUnread }));
}

/** Clear one group channel's unread (when it is opened). */
export function clearGroupUnread(groupId: string, chatId: string): void {
  const key = `${groupId}:${chatId}`;
  if (!(key in state.groupUnread)) return;
  const groupUnread = { ...state.groupUnread };
  delete groupUnread[key];
  patch(recomputeTotal({ ...state, groupUnread }));
}

/**
 * Register the currently-open thread. Updates the local suppression state and
 * mirrors it to the backend poller (which must not count the active thread's
 * messages as unread in the cache either).
 */
export function registerActiveThread(opts: {
  partner?: string | null;
  group?: [string, string] | null;
}): void {
  const activePartner = opts.partner ?? null;
  const activeGroup = opts.group ? `${opts.group[0]}:${opts.group[1]}` : null;
  patch({ ...state, activePartner, activeGroup });
  void setActiveThread(activePartner, opts.group ?? null).catch(() => {});
}

/** Reset all live state (logout / account switch). */
export function resetSocialEvents(): void {
  state = { ...initial };
  emitChange();
  void setActiveThread(null, null).catch(() => {});
}

/**
 * Apply an `social:active-thread` event from a chat sub-window (the main window
 * and the chat window run in separate webviews, so their module stores don't
 * share state — the chat window broadcasts its active thread here). Unlike
 * `registerActiveThread`, this does NOT touch the backend: the chat window
 * already called `set_active_thread` itself.
 */
export function applyActiveThread(opts: {
  partner?: string | null;
  group?: [string, string] | null;
}): void {
  const activePartner = opts.partner ?? null;
  const activeGroup = opts.group ? `${opts.group[0]}:${opts.group[1]}` : null;
  patch({ ...state, activePartner, activeGroup });
}

/** Apply an `social:read` event from a chat sub-window (thread was opened/read). */
export function applyReadThread(payload: {
  kind: "friend" | "group";
  id: string;
  groupId?: string;
  chatId?: string;
}): void {
  if (payload.kind === "friend") {
    clearFriendUnread(payload.id);
  } else if (payload.groupId && payload.chatId) {
    clearGroupUnread(payload.groupId, payload.chatId);
  }
}
