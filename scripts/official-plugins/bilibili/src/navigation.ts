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
  | { name: "dynamic" }
  | { name: "mine" }
  | { name: "watch"; type?: "video" | "season"; bvid?: string; aid?: number; cid?: number; seasonId?: number; epId?: number }
  | { name: "space"; mid: number }
  | { name: "season"; seasonId: number }
  | { name: "live"; roomId: number }
  | { name: "settings" }
  | { name: "search"; keyword?: string }
  | { name: "history" }
  | { name: "watchLater" }
  | { name: "favorites" }
  | { name: "bangumi" }
  | { name: "liveHome" }
  | { name: "dynDetail"; dynId: string }
  | { name: "article"; articleId: number }
  | { name: "messages" }
  | { name: "chat"; uid: number }
  | { name: "notifications" };

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
export function openWatch(view: {
  name: "watch";
  type?: "video" | "season";
  bvid?: string;
  aid?: number;
  cid?: number;
  seasonId?: number;
  epId?: number;
}): void {
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

/** 打开动态详情：压入当前视图，可逐级返回 */
export function openDynDetail(dynId: string): void {
  stack.push(memory);
  switchView({ name: "dynDetail", dynId });
}

/** 打开直播间：压入当前视图，可逐级返回 */
export function openLive(roomId: number): void {
  stack.push(memory);
  switchView({ name: "live", roomId });
}

/** 打开设置视图：压入当前视图，可逐级返回 */
export function openSettings(): void {
  stack.push(memory);
  switchView({ name: "settings" });
}

/** 打开搜索视图（顶栏搜索框提交；带关键词时直接搜索） */
export function openSearch(keyword?: string): void {
  stack.push(memory);
  switchView({ name: "search", keyword });
}

/** 打开历史记录页 */
export function openHistory(): void {
  stack.push(memory);
  switchView({ name: "history" });
}

/** 打开稍后再看页 */
export function openWatchLater(): void {
  stack.push(memory);
  switchView({ name: "watchLater" });
}

/** 打开收藏夹页 */
export function openFavorites(): void {
  stack.push(memory);
  switchView({ name: "favorites" });
}

/** 打开追番页 */
export function openBangumi(): void {
  stack.push(memory);
  switchView({ name: "bangumi" });
}

/** 打开直播首页（推荐直播列表） */
export function openLiveHome(): void {
  stack.push(memory);
  switchView({ name: "liveHome" });
}

/** 打开专栏阅读页：压入当前视图，可逐级返回 */
export function openArticle(articleId: number): void {
  stack.push(memory);
  switchView({ name: "article", articleId });
}

/** 打开私信会话列表 */
export function openMessages(): void {
  stack.push(memory);
  switchView({ name: "messages" });
}

/** 打开与某用户的私信会话 */
export function openChat(uid: number): void {
  stack.push(memory);
  switchView({ name: "chat", uid });
}

/** 打开通知流 */
export function openNotifications(): void {
  stack.push(memory);
  switchView({ name: "notifications" });
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
  delete scrollByView.dynamic;
  delete scrollByView.mine;
  delete scrollByView.search;
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
