import React from "sdk";
import { cssText } from "../styles";
import { BiliTopNav, type BiliTopNavPage } from "./BiliTopNav";

interface BiliAppShellProps {
  current: BiliTopNavPage;
  title?: string;
  subtitle?: string;
  children: any;
  actions?: any;
}

export function BiliAppShell({ current, title, subtitle, children, actions }: BiliAppShellProps) {
  return (
    <main className="bili-shell">
      <style>{cssText}</style>
      <BiliTopNav actions={actions} current={current} subtitle={subtitle} title={title} />
      {children}
    </main>
  );
}
