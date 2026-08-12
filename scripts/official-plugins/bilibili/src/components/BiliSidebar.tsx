import React, { useEffect, useState } from "sdk";
import { navigateNav } from "../navigation";
import type { BiliNavView } from "../navigation";

/** 侧边栏偏好：折叠状态 + 是否自动隐藏（阶段 1 localStorage 记忆，阶段 2 移入设置页） */
interface SidebarPrefs {
  collapsed: boolean;
  autoHide: boolean;
}

const SIDEBAR_PREFS_KEY = "bilibili.sidebar.prefs";

function loadPrefs(): SidebarPrefs {
  try {
    const raw = localStorage.getItem(SIDEBAR_PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SidebarPrefs>;
      return {
        collapsed: parsed.collapsed === true,
        autoHide: parsed.autoHide === true,
      };
    }
  } catch {
    // 忽略损坏的本地存储
  }
  return { collapsed: false, autoHide: false };
}

interface SidebarItem {
  view: BiliNavView;
  label: string;
  /** 折叠态图标字符（阶段 1 用文字缩写，阶段 2 换 Icon） */
  glyph: string;
  section: "main" | "library";
}

// 阶段 1：直播/收藏/历史等入口在阶段 2 拆页后加入（live 视图需 roomId，直播聚合页随阶段 2）
export const SIDEBAR_ITEMS: SidebarItem[] = [
  { view: { name: "home" }, label: "首页", glyph: "首", section: "main" },
  { view: { name: "dynamic" }, label: "动态", glyph: "动", section: "main" },
  { view: { name: "mine" }, label: "我的", glyph: "我", section: "main" },
  { view: { name: "settings" }, label: "设置", glyph: "设", section: "main" },
];

interface BiliSidebarProps {
  current: string;
}

export function BiliSidebar({ current }: BiliSidebarProps) {
  const [prefs, setPrefs] = useState<SidebarPrefs>(loadPrefs);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_PREFS_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const collapsed = prefs.collapsed && !(prefs.autoHide && hovered);

  return (
    <aside
      className={collapsed ? "bili-sidebar bili-sidebar-collapsed" : "bili-sidebar"}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <nav className="bili-sidebar-nav" aria-label="Bilibili 导航">
        {SIDEBAR_ITEMS.map((item) => {
          const active = isActive(current, item.view);
          return (
            <button
              aria-current={active ? "page" : undefined}
              className={active ? "bili-sidebar-item bili-sidebar-item-active" : "bili-sidebar-item"}
              key={item.label}
              type="button"
              onClick={() => navigateNav(item.view)}
            >
              <span className="bili-sidebar-glyph">{item.glyph}</span>
              <span className="bili-sidebar-label">{item.label}</span>
              {active ? <span className="bili-sidebar-dot" /> : null}
            </button>
          );
        })}
      </nav>
      <button
        aria-label={prefs.collapsed ? "展开侧边栏" : "收起侧边栏"}
        className="bili-sidebar-collapse"
        type="button"
        onClick={() => setPrefs((prev) => ({ ...prev, collapsed: !prev.collapsed }))}
      >
        <span className="bili-sidebar-glyph">{collapsed ? "»" : "«"}</span>
        <span className="bili-sidebar-label">{prefs.collapsed ? "展开" : "收起"}</span>
      </button>
    </aside>
  );
}

function isActive(current: string, view: BiliNavView): boolean {
  if (current === view.name) return true;
  // 播放/UP主页等详情视图时，高亮其归属的一级入口（阶段 1：一律不高亮，避免误引导）
  return false;
}
