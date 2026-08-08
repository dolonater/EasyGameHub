import { type ReactNode, useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";
import { GlassFloating } from "./GlassSurface";

/**
 * Modal dialog based on animotion 提示弹窗/style1.tsx.
 * White card, rounded corners, X close button, soft shadow.
 * Light/dark adaptive. Animated enter (scale-in) + exit (fade-out).
 */
export default function Dialog({
  open,
  onClose,
  title,
  children,
  actions,
  className = "",
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** "md" = compact confirmation dialog; "lg" = wider, scrollable content (reader). */
  size?: "md" | "lg";
}) {
  const [closing, setClosing] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Parents commonly clear the dialog's source state when closing (e.g. set
  // `reading = null`). Without this the content would vanish and the tall
  // panel collapse mid-fade-out, looking like the dialog "shrinks". Keep the
  // last opened content so the fade-out plays on the real panel.
  const cachedRef = useRef<{ title?: string; children: ReactNode; actions?: ReactNode } | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      const timer = setTimeout(() => setMounted(false), 180);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => onClose(), 150);
  }, [onClose]);

  if (!mounted) return null;

  if (open) cachedRef.current = { title, children, actions };
  const content = cachedRef.current ?? { title, children, actions };

  const widthClass = size === "lg"
    ? "w-[min(92vw,680px)] max-h-[85vh]"
    : "w-[300px]";

  const dialog = (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center soft-backdrop ${
        closing ? "animate-fade-out" : "animate-fade-in"
      }`}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <GlassFloating
        className={`relative ${widthClass} rounded-[20px] shadow-[20px_20px_30px_rgba(0,0,0,0.068)] flex flex-col items-center gap-5 p-[30px] ${
          closing ? "animate-fade-out" : "animate-scale-in"
        } ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* X close button */}
        <button
          onClick={handleClose}
          className="absolute top-5 right-5 flex items-center justify-center border-none bg-transparent cursor-pointer group"
        >
          <Icon name="close" size={20} className="text-[#afafaf] group-hover:text-black dark:group-hover:text-white transition-colors" />
        </button>

        {/* Content */}
        <div className={`w-full flex flex-col gap-[5px] ${size === "lg" ? "min-h-0 overflow-y-auto" : ""}`}>
          {content.title && (
            <p className="text-[20px] font-bold text-[rgb(27,27,27)] dark:text-foreground">{content.title}</p>
          )}
          <div className="font-light text-[rgb(102,102,102)] dark:text-muted-foreground">{content.children}</div>
        </div>

        {/* Action buttons */}
        {content.actions && (
          <div className="w-full flex items-center justify-center gap-[10px]">
            {content.actions}
          </div>
        )}
      </GlassFloating>
    </div>
  );

  return createPortal(dialog, document.body);
}
