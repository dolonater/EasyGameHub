import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import { onToast, showToast } from "../../lib/toast";
import Icon from "./Icon";
import { GlassToastPanel } from "./GlassSurface";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

let nextId = 0;

// ── Per-type style maps (based on animotion 浮动提示/style1.tsx) ──────

const barMap: Record<ToastType, string> = {
  success: "border-[#84d65a]/70 bg-[#edfbd8]/72 dark:bg-[#1a2e12]/72",
  error:   "border-[#f87171]/70 bg-[#fef2f2]/72 dark:bg-[#2e1212]/72",
  warning: "border-[#facc15]/70 bg-[#fefce8]/72 dark:bg-[#2e2a0a]/72",
  info:    "border-[#1d4ed8]/70 bg-[#eff6ff]/72 dark:bg-[#0f1e3a]/72",
};

const textMap: Record<ToastType, string> = {
  success: "text-[#2b641e] dark:text-[#84d65a]",
  error:   "text-[#991b1b] dark:text-[#f87171]",
  warning: "text-[#ca8a04] dark:text-[#facc15]",
  info:    "text-[#1d4ed8] dark:text-[#60a5fa]",
};

const iconMap: Record<ToastType, "success" | "error" | "warning" | "info"> = {
  success: "success",
  error: "error",
  warning: "warning",
  info: "info",
};

// ── Component ─────────────────────────────────────────────────────

export default function Toast() {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (type: ToastType, message: string) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 5000);
  };

  useEffect(() => {
    onToast((type, message) => addToast(type, message));
  }, []);

  useEffect(() => {
    const unlisteners = [
      listen<any>("backup:completed", (event) => {
        const p = event.payload;
        if (p?.event === "backup:completed" && p?.game_name) {
          addToast("success", t("notification.backupCompleted", { name: p.game_name }));
          return;
        }
        if (p?.game_name && p?.path && p?.timestamp) {
          addToast("success", t("notification.backupCompleted", { name: p.game_name }));
          return;
        }
        if (p?.game && p?.note) {
          addToast("success", p.note);
          return;
        }
      }),
      listen<any>("backup:failed", (event) => {
        const p = event.payload;
        addToast("error", t("notification.backupFailed", { name: p?.game_name || "Unknown", error: p?.error || "" }));
      }),
    ];
    return () => { unlisteners.forEach((u) => u.then((fn) => fn())); };
  }, [t]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => {
        const iconName = iconMap[toast.type];
        return (
          <GlassToastPanel
            key={toast.id}
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== toast.id))}
            className={`flex items-center gap-2 w-[300px] rounded px-3 py-2 border-l-4 shadow-md pointer-events-auto cursor-pointer text-sm font-light ${barMap[toast.type]}`}
          >
            <Icon name={iconName} size={20} className={`flex-shrink-0 ${textMap[toast.type]}`} />
            <span className={`flex-1 ${textMap[toast.type]}`}>{toast.message}</span>
            <span className="flex-shrink-0 cursor-pointer text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-200">
              <Icon name="close" size={20} />
            </span>
          </GlassToastPanel>
        );
      })}
    </div>
  );
}

export { showToast };
