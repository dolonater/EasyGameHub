import React, { Icon } from "sdk";
import { MenuPopover } from "./MenuPopover";

interface WatchMoreMenuProps {
  onExternalOpen(): void;
  onCopyLink(): void;
  onOpenScreenshotFolder(): void;
  onClose(): void;
  style?: Record<string, string | number>;
  triggerRef?: { current: HTMLElement | null };
}

/**
 * "更多"菜单：外部打开 / 复制链接 / 截图目录。菜单样式浮层。
 */
export function WatchMoreMenu({
  onExternalOpen,
  onCopyLink,
  onOpenScreenshotFolder,
  onClose,
  style,
  triggerRef,
}: WatchMoreMenuProps) {
  return (
    <MenuPopover onClose={onClose} style={style} triggerRef={triggerRef}>
      <div className="bili-menu-heading">
        <strong>更多</strong>
      </div>
      <button
        className="bili-menu-item"
        type="button"
        onClick={() => {
          onExternalOpen();
          onClose();
        }}
      >
        <Icon name="externalLink" size={16} />
        <span>外部打开</span>
      </button>
      <button
        className="bili-menu-item"
        type="button"
        onClick={() => {
          onCopyLink();
          onClose();
        }}
      >
        <Icon name="copy" size={16} />
        <span>复制链接</span>
      </button>
      <button
        className="bili-menu-item"
        type="button"
        onClick={() => {
          onOpenScreenshotFolder();
          onClose();
        }}
      >
        <Icon name="screenshots" size={16} />
        <span>截图目录</span>
      </button>
    </MenuPopover>
  );
}
