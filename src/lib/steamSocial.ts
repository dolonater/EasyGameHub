import { invoke } from "@tauri-apps/api/core";

export type OnlineState =
  | "online"
  | "busy"
  | "away"
  | "snooze"
  | "lookingToTrade"
  | "lookingToPlay"
  | "offline";

/** Delivery lifecycle of a chat message (mirrors `DeliveryState` in Rust). */
export type DeliveryState = "sent" | "pending" | "verifying" | "failedRetryable";

/** A friend with live persona / online-state (from `load/refresh_friends`). */
export interface FriendDto {
  steamId: string;
  personaName: string | null;
  avatarUrl: string | null;
  onlineState: OnlineState;
  inGameName: string | null;
  lastLogoff: number | null;
}

/** One chat message (sender steamid, text, unix seconds, delivery state). */
export interface ChatMessageDto {
  steamId: string;
  timestamp: number;
  message: string;
  kind: string;
  deliveryState?: DeliveryState;
}

/** A private-chat thread (from `open_chat` / `refresh_chat`). */
export interface ChatThreadDto {
  messages: ChatMessageDto[];
  moreAvailable: boolean;
}

/** Cached friend list (instant; empty when nothing cached yet). */
export function loadFriends(): Promise<FriendDto[]> {
  return invoke<FriendDto[]>("load_friends");
}

/** Fresh friend list + presence (network), persisted to the cache. */
export function refreshFriends(): Promise<FriendDto[]> {
  return invoke<FriendDto[]>("refresh_friends");
}

/** Single friend's persona summary. */
export function getFriendProfile(steamId: string): Promise<FriendDto> {
  return invoke<FriendDto>("get_friend_profile", { steamId });
}

/**
 * Drain chat messages buffered by the CM connection since the last poll.
 * `activePartner` suppresses the unread count for that conversation.
 */
export function pollChat(activePartner?: string): Promise<ChatMessageDto[]> {
  const args = activePartner ? { activePartner } : {};
  return invoke<ChatMessageDto[]>("poll_chat", args);
}

/** Send a text message to a friend; returns the persisted local message. */
export function sendChatMessage(steamId: string, text: string): Promise<ChatMessageDto> {
  return invoke<ChatMessageDto>("send_chat_message", { steamId, text });
}

/** Cached friend thread (instant, offline-safe); marks the conversation read. */
export function openChat(steamId: string): Promise<ChatThreadDto> {
  return invoke<ChatThreadDto>("open_chat", { steamId });
}

/** Fresh friend thread (network history merged with the cache). */
export function refreshChat(steamId: string): Promise<ChatThreadDto> {
  return invoke<ChatThreadDto>("refresh_chat", { steamId });
}

/** One recent-conversation summary (from `load_sessions` / `refresh_sessions`). */
export interface ChatSessionDto {
  partnerSteamId: string;
  lastMessage: string;
  lastTimestamp: number;
  unreadCount: number;
}

/** Cached recent-conversation summaries (instant; empty when nothing cached). */
export function loadSessions(): Promise<ChatSessionDto[]> {
  return invoke<ChatSessionDto[]>("load_sessions");
}

/** Fresh recent-conversation summaries (derived from friends + threads). */
export function refreshSessions(): Promise<ChatSessionDto[]> {
  return invoke<ChatSessionDto[]>("refresh_sessions");
}

// ── Group chat ───────────────────────────────────────────────

/** A channel (room) inside a chat room group. */
export interface ChatGroupRoomDto {
  chatId: string;
  name: string;
  lastMessage: string;
  lastMessageTimestamp: number;
  lastSenderSteamId: string;
  unreadCount: number;
}

/** A Steam chat room group (from `load_groups` / `refresh_groups`). */
export interface ChatGroupDto {
  groupId: string;
  name: string;
  defaultChatId: string;
  rooms: ChatGroupRoomDto[];
}

/** One group chat message. */
export interface GroupMessageDto {
  groupId: string;
  chatId: string;
  senderSteamId: string;
  timestamp: number;
  ordinal: number;
  message: string;
  deliveryState?: DeliveryState;
}

/** A group-channel thread (from `open_group_chat` / `refresh_group_chat`). */
export interface GroupThreadDto {
  messages: GroupMessageDto[];
  moreAvailable: boolean;
}

/** Cached chat room groups (instant; empty when nothing cached yet). */
export function loadGroups(): Promise<ChatGroupDto[]> {
  return invoke<ChatGroupDto[]>("load_groups");
}

/** Fresh chat room groups (network), persisted to the cache. */
export function refreshGroups(): Promise<ChatGroupDto[]> {
  return invoke<ChatGroupDto[]>("refresh_groups");
}

/** Cached group-channel thread (instant, offline-safe); marks the channel read. */
export function openGroupChat(groupId: string, chatId: string): Promise<GroupThreadDto> {
  return invoke<GroupThreadDto>("open_group_chat", { groupId, chatId });
}

/** Fresh group-channel thread (network history merged with the cache). */
export function refreshGroupChat(groupId: string, chatId: string): Promise<GroupThreadDto> {
  return invoke<GroupThreadDto>("refresh_group_chat", { groupId, chatId });
}

/** Send a text message to a group channel; returns the persisted local message. */
export function sendGroupMessage(
  groupId: string,
  chatId: string,
  text: string,
): Promise<GroupMessageDto> {
  return invoke<GroupMessageDto>("send_group_message", { groupId, chatId, text });
}

/**
 * Drain group chat messages buffered by the CM connection.
 * `activeGroup` (`[groupId, chatId]`) suppresses the unread count for that channel.
 */
export function pollGroupMessages(activeGroup?: [string, string]): Promise<GroupMessageDto[]> {
  const args = activeGroup ? { activeGroup } : {};
  return invoke<GroupMessageDto[]>("poll_group_messages", args);
}

// ── E4 图片 / 贴纸 ───────────────────────────────────────────

/** One owned Steam sticker (from `get_sticker_catalog`). */
export interface StickerDto {
  name: string;
  imageUrl: string;
}

/** Upload an image into a friend chat; Steam inserts it as an image message. */
export function uploadChatImage(path: string, steamId: string): Promise<string> {
  return invoke<string>("upload_chat_image", { path, steamId });
}

/** Upload an image into a group channel; Steam inserts it as an image message. */
export function uploadGroupImage(path: string, groupId: string, chatId: string): Promise<string> {
  return invoke<string>("upload_group_image", { path, groupId, chatId });
}

/** Owned sticker catalogue (for the sticker picker). */
export function getStickerCatalog(): Promise<StickerDto[]> {
  return invoke<StickerDto[]>("get_sticker_catalog");
}

/** Send a sticker to a friend (`/sticker <name>` body, like Steam's web chat). */
export function sendStickerMessage(steamId: string, name: string): Promise<void> {
  return invoke("send_sticker_message", { steamId, name });
}

/** CDN URL for a sticker asset, given its name. */
export function stickerImageUrl(name: string): string {
  return `https://steamcommunity.com/economy/sticker/${encodeURIComponent(name)}`;
}

/**
 * Report the currently-open chat thread so the background poller suppresses
 * its unread (both `partner` and `group` null = no active thread).
 */
export function setActiveThread(
  partner?: string | null,
  group?: [string, string] | null,
): Promise<null> {
  return invoke<null>("set_active_thread", {
    partner: partner ?? null,
    group: group ?? null,
  });
}
