import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTranslation } from "react-i18next";
import { GlassTitleBar } from "../ui";

interface ChatWindowTitleBarProps {
  title?: string;
}

/**
 * Mac-style traffic-light titlebar for the chat sub-window. Mirrors the main
 * window's `WindowTitleBar` (same glass surface + green/yellow/red dots + drag
 * region) but drives the CURRENT window via the JS API instead of the main-only
 * `maximize_window`/`minimize_window` invoke commands.
 *
 * The chat window is built frameless (`decorations: false`), so this bar is
 * rendered unconditionally — every state (loading / no session / empty / chat)
 * stays draggable and closable.
 */
export default function ChatWindowTitleBar({ title = "EasyGameHub" }: ChatWindowTitleBarProps) {
  const { t } = useTranslation();
  const win = getCurrentWindow();

  return (
    <GlassTitleBar className="titlebar-drag flex h-8 flex-shrink-0 select-none items-center justify-between border-b border-border px-2">
      <div className="flex items-center gap-2 pl-1">
        <button
          onClick={async () => {
            try {
              if (await win.isMaximized()) {
                await win.unmaximize();
              } else {
                await win.maximize();
              }
            } catch {}
          }}
          className="h-3 w-3 rounded-full bg-green-500 ring-1 ring-green-600/40 transition-all duration-200 hover:scale-125 hover:bg-green-400 hover:ring-green-400/70 hover:shadow-[0_0_0_4px_rgba(34,197,94,0.18),0_6px_14px_rgba(34,197,94,0.28)] active:scale-95"
          title={t("windowControls.maximizeRestore")}
        />
        <button
          onClick={() => {
            void win.minimize().catch(() => {});
          }}
          className="h-3 w-3 rounded-full bg-yellow-500 ring-1 ring-yellow-600/40 transition-all duration-200 hover:scale-125 hover:bg-yellow-400 hover:ring-yellow-400/70 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.18),0_6px_14px_rgba(234,179,8,0.28)] active:scale-95"
          title={t("windowControls.minimize")}
        />
        <button
          onClick={() => {
            void win.close().catch(() => {});
          }}
          className="h-3 w-3 rounded-full bg-red-500 ring-1 ring-red-600/40 transition-all duration-200 hover:scale-125 hover:bg-red-400 hover:ring-red-400/70 hover:shadow-[0_0_0_4px_rgba(239,68,68,0.18),0_6px_14px_rgba(239,68,68,0.28)] active:scale-95"
          title={t("windowControls.closeToTray")}
        />
      </div>
      <span className="pointer-events-none text-xs font-medium text-muted-foreground">{title}</span>
      <div className="w-14" />
    </GlassTitleBar>
  );
}
