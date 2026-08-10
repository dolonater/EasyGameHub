import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { showToast } from "../components/Notification";
import { applyChatEvent, applyGroupEvent } from "../lib/socialEvents";
import type { ChatMessageDto, GroupMessageDto } from "../lib/steamSocial";

/**
 * App-level listener for live social events. Mount once at the app root
 * (`App.tsx`) so messages keep arriving — and unread keeps counting — on any
 * page or hub sub-tab.
 *
 * Toast policy (P1-7 visibility awareness): messages for the active thread are
 * skipped by the store (SocialPanel renders them), so this only fires for
 * unread ones. While the window is hidden it just accumulates; on return it
 * summarizes once.
 */
export function useSocialEvents() {
  const { t } = useTranslation();
  const visibleRef = useRef(!document.hidden);
  const pendingRef = useRef(0);

  useEffect(() => {
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

    const unlistenChat = listen<ChatMessageDto[]>("social:chat", (event) => {
      const counted = applyChatEvent(event.payload);
      if (!counted.length) return;
      if (visibleRef.current) {
        showToast("info", t("steam.socialNewMessage", { count: counted.length }));
      } else {
        pendingRef.current += counted.length;
      }
    });

    const unlistenGroup = listen<GroupMessageDto[]>("social:group", (event) => {
      const counted = applyGroupEvent(event.payload);
      if (!counted.length) return;
      if (visibleRef.current) {
        showToast("info", t("steam.socialNewMessage", { count: counted.length }));
      } else {
        pendingRef.current += counted.length;
      }
    });

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      unlistenChat.then((fn) => fn());
      unlistenGroup.then((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
