import React from "sdk";
import { cssText } from "../styles";
import { BiliSidebar } from "./BiliSidebar";
import { BiliTopNav, type BiliTopNavPage } from "./BiliTopNav";

interface BiliAppShellProps {
  current: string;
  title?: string;
  subtitle?: string;
  children?: any;
  actions?: any;
}

/**
 * 插件全局骨架（P9 布局改造，参考 BewlyBewly）：
 * 顶栏（品牌 | 全局搜索 | 通知/设置/头像）+ 可折叠侧边栏 + 内容区。
 */
export function BiliAppShell({ current, title, subtitle, children, actions }: BiliAppShellProps) {
  return (
    <main className="bili-shell">
      <style>{cssText}</style>
      <BiliTopNav actions={actions} current={current} subtitle={subtitle} title={title} />
      <div className="bili-shell-body">
        <BiliSidebar current={current} />
        <div className="bili-shell-content">{children}</div>
      </div>
    </main>
  );
}
