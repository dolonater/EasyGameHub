import { useTranslation } from "react-i18next";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { GlassTitleBar } from "./ui";

interface WindowTitleBarProps {
  title?: string;
  className?: string;
}

export default function WindowTitleBar({ title = "EasyGameHub", className = "" }: WindowTitleBarProps) {
  const { t } = useTranslation();

  return (
    <GlassTitleBar className={["titlebar-drag h-8 flex items-center justify-between px-2 border-b border-border flex-shrink-0 select-none", className].join(" ").trim()}>
      <div className="flex items-center gap-2 pl-1">
        <button
          onClick={async () => {
            try {
              const maxed = await invoke<boolean>("is_maximized");
              if (maxed) {
                await invoke("unmaximize_window");
              } else {
                await invoke("maximize_window");
              }
            } catch {}
          }}
          className="w-3 h-3 rounded-full bg-green-500 ring-1 ring-green-600/40 shadow-[0_0_0_rgba(34,197,94,0)] transition-all duration-200 hover:scale-125 hover:bg-green-400 hover:ring-green-400/70 hover:shadow-[0_0_0_4px_rgba(34,197,94,0.18),0_6px_14px_rgba(34,197,94,0.28)] active:scale-95"
          title={t("windowControls.maximizeRestore")}
        />
        <button
          onClick={async () => {
            try {
              await invoke("minimize_window");
            } catch {}
          }}
          className="w-3 h-3 rounded-full bg-yellow-500 ring-1 ring-yellow-600/40 shadow-[0_0_0_rgba(234,179,8,0)] transition-all duration-200 hover:scale-125 hover:bg-yellow-400 hover:ring-yellow-400/70 hover:shadow-[0_0_0_4px_rgba(234,179,8,0.18),0_6px_14px_rgba(234,179,8,0.28)] active:scale-95"
          title={t("windowControls.minimize")}
        />
        <button
          onClick={async () => {
            try {
              await getCurrentWindow().close();
            } catch {}
          }}
          className="w-3 h-3 rounded-full bg-red-500 ring-1 ring-red-600/40 shadow-[0_0_0_rgba(239,68,68,0)] transition-all duration-200 hover:scale-125 hover:bg-red-400 hover:ring-red-400/70 hover:shadow-[0_0_0_4px_rgba(239,68,68,0.18),0_6px_14px_rgba(239,68,68,0.28)] active:scale-95"
          title={t("windowControls.closeToTray")}
        />
      </div>
      <span className="text-xs text-muted-foreground font-medium pointer-events-none">{title}</span>
      <div className="w-14" />
    </GlassTitleBar>
  );
}
