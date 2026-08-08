import { invoke } from "@tauri-apps/api/core";

export type OnlineState =
  | "online"
  | "busy"
  | "away"
  | "snooze"
  | "lookingToTrade"
  | "lookingToPlay"
  | "offline";

/** A friend with live persona / online-state (from `get_friends`). */
export interface FriendDto {
  steamId: string;
  personaName: string | null;
  avatarUrl: string | null;
  onlineState: OnlineState;
  inGameName: string | null;
  lastLogoff: number | null;
}

/** One chat message (sender steamid, text, unix seconds). */
export interface ChatMessageDto {
  steamId: string;
  timestamp: number;
  message: string;
  kind: string;
}

/** Friend list with live presence (needs an active Steam session). */
export function getFriends(): Promise<FriendDto[]> {
  return invoke<FriendDto[]>("get_friends");
}

/** Single friend's persona summary. */
export function getFriendProfile(steamId: string): Promise<FriendDto> {
  return invoke<FriendDto>("get_friend_profile", { steamId });
}

/** Drain chat messages buffered by the CM connection since the last poll. */
export function pollChat(timeoutMs?: number): Promise<ChatMessageDto[]> {
  const args = timeoutMs != null ? { timeoutMs } : {};
  return invoke<ChatMessageDto[]>("poll_chat", args);
}

/** Send a text message to a friend. */
export function sendChatMessage(steamId: string, text: string): Promise<void> {
  return invoke("send_chat_message", { steamId, text });
}

/** Last `count` messages exchanged with a friend (both directions). */
export function getChatHistory(steamId: string, count?: number): Promise<ChatMessageDto[]> {
  return invoke<ChatMessageDto[]>("get_chat_history", { steamId, count });
}

// ── Group chat ───────────────────────────────────────────────

/** A channel (room) inside a chat room group. */
export interface ChatGroupRoomDto {
  chatId: string;
  name: string;
  lastMessage: string;
  lastMessageTimestamp: number;
  lastSenderSteamId: string;
}

/** A Steam chat room group (from `get_chat_groups`). */
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
}

/** List the chat room groups the account belongs to. */
export function getChatGroups(): Promise<ChatGroupDto[]> {
  return invoke<ChatGroupDto[]>("get_chat_groups");
}

/** Last messages in a group channel. */
export function getGroupHistory(groupId: string, chatId: string): Promise<GroupMessageDto[]> {
  return invoke<GroupMessageDto[]>("get_group_history", { groupId, chatId });
}

/** Send a text message to a group channel. */
export function sendGroupMessage(groupId: string, chatId: string, text: string): Promise<void> {
  return invoke("send_group_message", { groupId, chatId, text });
}

/** Drain group chat messages buffered by the CM connection. */
export function pollGroupMessages(): Promise<GroupMessageDto[]> {
  return invoke<GroupMessageDto[]>("poll_group_messages");
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
