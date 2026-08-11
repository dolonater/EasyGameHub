/**
 * 插件内单页导航状态。
 *
 * 三个视图（首页 / 播放 / 我的）不再各自注册为宿主独立页面，而是由 MainPage
 * 在单个插件页内按 view 切换渲染。所有跳转走这里的函数，不依赖 window.location：
 * - 首页 / 我的 Tab 切换：navigateNav，清除观看回退栈
 * - 打开播放页：openWatch，压入当前视图（播放页内点相关推荐可逐级返回）
 * - 播放页返回：goBackNav，弹栈回到上一个视图
 *
 * 模块级 memory 让视图在宿主侧切走再回来时（插件页组件卸载重挂）仍回到上次位置，
 * 对齐网易云插件的 viewMemory 方案。scrollByView 记录离开各视图时的宿主滚动位置，
 * 用于返回时恢复首页/我的的滚动位置。
 */

export type BiliNavView =
  | { name: "home" }
  | { name: "mine" }
  | { name: "watch"; type?: "video" | "season"; bvid?: string; aid?: number; cid?: number; seasonId?: number; epId?: number }
  | { name: "space"; mid: number }
  | { name: "season"; seasonId: number }
  | { name: "live"; roomId: number }
  | { name: "settings" }
  | { name: "dynDetail"; dynId: string }
  | { name: "article"; articleId: number };

type NavListener = (view: BiliNavView) => void;

const listeners = new Set<NavListener>();
let memory: BiliNavView = { name: "home" };
let stack: BiliNavView[] = [];
const scrollByView: Partial<Record<BiliNavView["name"], number>> = {};

export function getNavView(): BiliNavView {
  return memory;
}

export function subscribeNav(listener: NavListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tab 级切换（首页 / 我的），清除观看回退栈，避免残留旧的返回目标 */
export function navigateNav(view: BiliNavView): void {
  switchView(view);
  stack = [];
}

/** 打开播放页：压入当前视图，播放页内连点相关视频可逐级返回 */
export function openWatch(view: { name: "watch"; bvid?: string; aid?: number; cid?: number }): void {
  stack.push(memory);
  switchView(view);
}

/** 打开 UP 主页：压入当前视图，可逐级返回 */
export function openSpace(mid: number): void {
  stack.push(memory);
  switchView({ name: "space", mid });
}

/** 打开番剧详情：压入当前视图，可逐级返回 */
export function openSeason(seasonId: number): void {
  stack.push(memory);
  switchView({ name: "season", seasonId });
}

/** 播放页返回：弹栈回到上一个视图（空栈则回首页） */
export function goBackNav(): void {
  const previous = stack.pop();
  switchView(previous ?? { name: "home" });
}

export function getViewScroll(name: BiliNavView["name"]): number {
  return scrollByView[name] ?? 0;
}

/** 插件页每次（重新）挂载时清掉残留滚动，避免旧高度错位 */
export function clearViewScroll(): void {
  delete scrollByView.home;
  delete scrollByView.mine;
}

function switchView(view: BiliNavView): void {
  captureScroll();
  memory = view;
  listeners.forEach((listener) => listener(view));
}

function captureScroll(): void {
  const el = document.querySelector<HTMLElement>(".app-page-surface");
  if (el) scrollByView[memory.name] = el.scrollTop;
}
