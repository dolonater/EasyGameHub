import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { showToast } from "../components/Notification";
import {
  applyActiveThread,
  applyChatEvent,
  applyGroupEvent,
  applyReadThread,
} from "../lib/socialEvents";
import type { ChatMessageDto, GroupMessageDto } from "../lib/steamSocial";

/**
 * App-level listener for live social events. Mount once at the app root
 * (`App.tsx`) so messages keep arriving — and unread keeps counting — on any
 * page or hub sub-tab.
 *
 * Toast policy (P1-7 visibility awareness): messages for the active thread are
 * skipped by the store (SocialPanel renders them), so this only fires for
 * unread ones. While the window is hidden it just accumulates; on return it
 * summarizes once. Chat sub-windows (label `chat-*`) never toast — they only
 * show their own thread live, and a second toast for other threads would be
 * noise.
 *
 * Also bridges the cross-window events from chat sub-windows: their module
 * stores are separate webview instances, so `social:active-thread` /
 * `social:read` patch this window's store.
 */
export function useSocialEvents() {
  const { t } = useTranslation();
  const visibleRef = useRef(!document.hidden);
  const pendingRef = useRef(0);

  useEffect(() => {
    // Chat sub-windows have `chat-*` labels and never toast.
    const isChatWindow = getCurrentWebviewWindow().label.startsWith("chat-");

    const onVisibility = () => {
      const visible = !document.hidden;
      visibleRef.current = visible;
      if (visible && pendingRef.current > 0) {
        const count = pendingRef.current;
        pendingRef.current = 0;
        showToast("info", t("steam.socialNewMessage", { count }));
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const maybeToast = (count: number) => {
      if (isChatWindow) return; // chat windows render their own thread live
      if (visibleRef.current) {
        showToast("info", t("steam.socialNewMessage", { count }));
      } else {
        pendingRef.current += count;
      }
    };

    const unlistenChat = listen<ChatMessageDto[]>("social:chat", (event) => {
      const counted = applyChatEvent(event.payload);
      if (counted.length) maybeToast(counted.length);
    });

    const unlistenGroup = listen<GroupMessageDto[]>("social:group", (event) => {
      const counted = applyGroupEvent(event.payload);
      if (counted.length) maybeToast(counted.length);
    });

    // Cross-window bridge from chat sub-windows.
    const unlistenActive = listen<{ partner?: string | null; group?: [string, string] | null }>(
      "social:active-thread",
      (event) => applyActiveThread(event.payload),
    );
    const unlistenRead = listen<{
      kind: "friend" | "group";
      id: string;
      groupId?: string;
      chatId?: string;
    }>("social:read", (event) => applyReadThread(event.payload));

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      unlistenChat.then((fn) => fn());
      unlistenGroup.then((fn) => fn());
      unlistenActive.then((fn) => fn());
      unlistenRead.then((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
