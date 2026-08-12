import React, { useEffect, useState } from "sdk";
import { navigateNav, openBangumi, openFavorites, openHistory, openLiveHome, openWatchLater } from "../navigation";
import type { BiliNavView } from "../navigation";
import { getState, subscribe } from "../runtime";

/** 侧边栏偏好：折叠状态（autoHide/位置在设置页配置） */
interface SidebarPrefs {
  collapsed: boolean;
}

const SIDEBAR_PREFS_KEY = "bilibili.sidebar.prefs";

function loadPrefs(): SidebarPrefs {
  try {
    const raw = localStorage.getItem(SIDEBAR_PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SidebarPrefs>;
      return { collapsed: parsed.collapsed === true };
    }
  } catch {
    // 忽略损坏的本地存储
  }
  return { collapsed: false };
}

interface SidebarItem {
  view: BiliNavView;
  label: string;
  /** 折叠态图标字符（阶段 2 先用文字缩写，图标后续替换） */
  glyph: string;
  section: "main" | "library";
}

export const SIDEBAR_ITEMS: SidebarItem[] = [
  { view: { name: "home" }, label: "首页", glyph: "首", section: "main" },
  { view: { name: "dynamic" }, label: "动态", glyph: "动", section: "main" },
  { view: { name: "liveHome" }, label: "直播", glyph: "播", section: "main" },
  { view: { name: "favorites" }, label: "收藏", glyph: "藏", section: "library" },
  { view: { name: "history" }, label: "历史", glyph: "历", section: "library" },
  { view: { name: "watchLater" }, label: "稍后再看", glyph: "看", section: "library" },
  { view: { name: "bangumi" }, label: "追番", glyph: "番", section: "library" },
  { view: { name: "mine" }, label: "我的", glyph: "我", section: "main" },
  { view: { name: "settings" }, label: "设置", glyph: "设", section: "main" },
];

/** 导航目标映射（open 系列压栈式跳转，避免破坏返回栈） */
const OPENERS: Record<string, () => void> = {
  home: () => navigateNav({ name: "home" }),
  dynamic: () => navigateNav({ name: "dynamic" }),
  liveHome: openLiveHome,
  favorites: openFavorites,
  history: openHistory,
  watchLater: openWatchLater,
  bangumi: openBangumi,
  mine: () => navigateNav({ name: "mine" }),
  settings: () => navigateNav({ name: "settings" }),
};

interface BiliSidebarProps {
  current: string;
}

export function BiliSidebar({ current }: BiliSidebarProps) {
  const [prefs, setPrefs] = useState<SidebarPrefs>(loadPrefs);
  const [hovered, setHovered] = useState(false);
  const [config, setConfig] = useState(getState().config);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_PREFS_KEY, JSON.stringify(prefs));
  }, [prefs]);

  useEffect(() => subscribe(() => setConfig(getState().config)), []);

  const collapsed = prefs.collapsed && !(config.sidebarAutoHide && hovered);

  const positionClass = config.sidebarPosition === "right" ? " bili-sidebar-right" : "";

  return (
    <aside
      className={`${collapsed ? "bili-sidebar bili-sidebar-collapsed" : "bili-sidebar"}${positionClass}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <nav className="bili-sidebar-nav" aria-label="Bilibili 导航">
        {SIDEBAR_ITEMS.map((item) => {
          const active = item.view.name === current;
          return (
            <button
              aria-current={active ? "page" : undefined}
              className={active ? "bili-sidebar-item bili-sidebar-item-active" : "bili-sidebar-item"}
              key={item.label}
              type="button"
              onClick={() => OPENERS[item.view.name]()}
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
