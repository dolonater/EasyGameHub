import type { ChatMessageDto, GroupMessageDto } from "./steamSocial";

/** A chat message with an optional UI-only id for tracking optimistic bubbles. */
export type UiChatMessage = ChatMessageDto & { localId?: string };
/** A group message with an optional UI-only id for tracking optimistic bubbles. */
export type UiGroupMessage = GroupMessageDto & { localId?: string };

/** Friend-thread identity: `timestamp:sender:body` (Web-API history has no ordinal). */
export function chatDedupKey(m: ChatMessageDto): string {
  return `${m.timestamp}:${m.steamId}:${m.message}`;
}
/** Group-thread identity: `timestamp:ordinal:sender`. */
export function groupDedupKey(m: GroupMessageDto): string {
  return `${m.timestamp}:${m.ordinal}:${m.senderSteamId}`;
}

/**
 * Prefer `a` (server truth), then append `b`'s messages not already in `a`.
 * Our own sends are additionally deduplicated by body: the optimistic bubble
 * (local timestamp) and the confirmed server copy (server timestamp) are the
 * same message even when the second boundary crossed, so the bubble is dropped
 * in favour of the server copy.
 */
export function unionMessages(
  a: ChatMessageDto[],
  b: ChatMessageDto[],
  selfId?: string,
): ChatMessageDto[] {
  const seen = new Set(a.map(chatDedupKey));
  const selfBodies = new Set(
    selfId ? a.filter((m) => m.steamId === selfId).map((m) => m.message) : [],
  );
  return [
    ...a,
    ...b.filter((m) => {
      if (seen.has(chatDedupKey(m))) return false;
      if (selfId && m.steamId === selfId && selfBodies.has(m.message)) return false;
      return true;
    }),
  ];
}

/** Group-thread variant of `unionMessages`. */
export function unionGroupMessages(
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
