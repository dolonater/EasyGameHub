import { type ReactNode, useState, useEffect, useCallback } from "react";
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
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const [closing, setClosing] = useState(false);
  const [mounted, setMounted] = useState(false);

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

  const dialog = (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center soft-backdrop ${
        closing ? "animate-fade-out" : "animate-fade-in"
      }`}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <GlassFloating
        className={`relative w-[300px] rounded-[20px] shadow-[20px_20px_30px_rgba(0,0,0,0.068)] flex flex-col items-center gap-5 p-[30px] ${
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
        <div className="w-full flex flex-col gap-[5px]">
          {title && (
            <p className="text-[20px] font-bold text-[rgb(27,27,27)] dark:text-foreground">{title}</p>
          )}
          <div className="font-light text-[rgb(102,102,102)] dark:text-muted-foreground">{children}</div>
        </div>

        {/* Action buttons */}
        {actions && (
          <div className="w-full flex items-center justify-center gap-[10px]">
            {actions}
          </div>
        )}
      </GlassFloating>
    </div>
  );

  return createPortal(dialog, document.body);
}
