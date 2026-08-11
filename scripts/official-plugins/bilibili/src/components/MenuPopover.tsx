import React, { useEffect, useRef } from "sdk";

interface MenuPopoverProps {
  onClose(): void;
  /** 定位样式；默认菜单面板由各调用方经 style/className 定位 */
  style?: Record<string, string | number>;
  className?: string;
  /** 触发弹层的按钮/锚点。点外关闭时把它视为"内部"，避免打开同一次点击立刻关闭 */
  triggerRef?: { current: HTMLElement | null };
  children?: any;
}

/**
 * 菜单样式浮层：竖排列表、点外/Esc 关闭。
 * 四个弹层（投币/收藏/弹幕设置/更多）共用，保证一致的弹层语言。
 */
export function MenuPopover({ onClose, style, className = "", triggerRef, children }: MenuPopoverProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const node = ref.current;
      if (node && node.contains(target)) return;
      if (triggerRef?.current && triggerRef.current.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, triggerRef]);

  return (
    <div className={`bili-menu-popover ${className}`} ref={ref} style={style}>
      {children}
    </div>
  );
}
