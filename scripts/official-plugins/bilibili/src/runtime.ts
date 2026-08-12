import type { BiliErrorKind, BiliLoginInfo, BiliQrLoginKey, PluginSdk } from "./types";

export interface BilibiliRuntimeState {
  sdk: PluginSdk | null;
  disposed: boolean;
  loginInfo: BiliLoginInfo | null;
  loginQr: BiliQrLoginKey | null;
  loginPolling: boolean;
  loginError: string;
  config: BilibiliPluginConfig;
  /** 动态发布计数：发布成功 +1，动态页订阅后重载首屏 */
  dynamicPublished: number;
}

export interface BilibiliPluginConfig {
  syncProgress: boolean;
  danmakuEnabled: boolean;
  danmakuFontSize: number;
  danmakuOpacity: number;
  danmakuDensity: number;
  danmakuSpeed: number;
  defaultPlaybackRate: number;
  defaultQualityMode: "auto";
  searchHistory: string[];
  // P7 播放器设置
  bufferMode: "auto" | "small" | "medium" | "large";
  defaultFormat: "dash" | "mp4";
  codecPreference: "avc" | "hevc" | "av1";
  audioPreference: "standard" | "flac";
  autoPlay: boolean;
}

export const defaultConfig: BilibiliPluginConfig = {
  syncProgress: true,
  danmakuEnabled: true,
  danmakuFontSize: 22,
  danmakuOpacity: 0.85,
  danmakuDensity: 0.85,
  danmakuSpeed: 1,
  defaultPlaybackRate: 1,
  defaultQualityMode: "auto",
  searchHistory: [],
  bufferMode: "auto",
  defaultFormat: "dash",
  codecPreference: "avc",
  audioPreference: "standard",
  autoPlay: true,
};

const initialState: BilibiliRuntimeState = {
  sdk: null,
  disposed: false,
  loginInfo: null,
  loginQr: null,
  loginPolling: false,
  loginError: "",
  config: defaultConfig,
  dynamicPublished: 0,
};

let state = initialState;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

export function getState() {
  return state;
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function attachSdk(sdk: PluginSdk) {
  setState({ sdk, disposed: false });
}

export function disposeRuntime() {
  stopQrLogin();
  setState({
    sdk: null,
    disposed: true,
    loginInfo: null,
    loginQr: null,
    loginPolling: false,
    loginError: "",
    config: defaultConfig,
  });
}

export async function loadConfig() {
  const sdk = requireSdk();
  const config = normalizeConfig(await sdk.storage.get());
  setState({ config });
  return config;
}

export async function saveConfig(next: Partial<BilibiliPluginConfig>) {
  const sdk = requireSdk();
  const config = normalizeConfig({ ...state.config, ...next });
  await sdk.storage.set(config);
  setState({ config });
  return config;
}

export async function refreshLoginStatus() {
  const sdk = requireSdk();
  try {
    const loginInfo = await sdk.bilibili.account.loginStatus();
    setState({ loginInfo, loginError: loginInfo.message || "" });
  } catch (error) {
    setState({ loginInfo: null, loginError: errorMessage(error) });
  }
}

export async function startQrLogin() {
  const sdk = requireSdk();
  stopQrLogin();
  setState({ loginPolling: true, loginQr: null, loginError: "" });

  try {
    const loginQr = await sdk.bilibili.account.loginQrKey();
    setState({ loginQr });
    pollTimer = setInterval(() => {
      void pollQrLogin(loginQr.key);
    }, 2000);
    timeoutTimer = setTimeout(() => {
      stopQrLogin("二维码已过期，请重新生成");
    }, 180000);
  } catch (error) {
    stopQrLogin(errorMessage(error));
  }
}

export function stopQrLogin(message = "") {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (timeoutTimer) {
    clearTimeout(timeoutTimer);
    timeoutTimer = null;
  }
  setState({ loginPolling: false, loginQr: null, loginError: message });
}

export async function logout() {
  const sdk = requireSdk();
  stopQrLogin();
  try {
    await sdk.bilibili.account.logout();
    setState({ loginInfo: null, loginError: "" });
  } catch (error) {
    setState({ loginError: errorMessage(error) });
  }
}

async function pollQrLogin(key: string) {
  const sdk = state.sdk;
  if (!sdk || state.disposed || !state.loginPolling) return;

  try {
    const status = await sdk.bilibili.account.loginQrCheck(key);
    if (status.loggedIn && status.loginInfo) {
      stopQrLogin();
      setState({ loginInfo: status.loginInfo, loginError: "" });
      return;
    }
    setState({ loginError: status.message || "" });
  } catch (error) {
    stopQrLogin(errorMessage(error));
  }
}

function requireSdk() {
  if (!state.sdk || state.disposed) {
    throw new Error("Bilibili 插件尚未初始化");
  }
  return state.sdk;
}

function setState(next: Partial<BilibiliRuntimeState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

/** 动态发布成功通知：动态页订阅此计数变化后重载首屏 */
export function markDynamicPublished() {
  setState({ dynamicPublished: state.dynamicPublished + 1 });
}

function normalizeConfig(value: unknown): BilibiliPluginConfig {
  const source = value && typeof value === "object" ? (value as Partial<BilibiliPluginConfig>) : {};
  return {
    syncProgress: source.syncProgress !== false,
    danmakuEnabled: source.danmakuEnabled !== false,
    danmakuFontSize: clampNumber(source.danmakuFontSize, 16, 32, defaultConfig.danmakuFontSize),
    danmakuOpacity: clampNumber(source.danmakuOpacity, 0.2, 1, defaultConfig.danmakuOpacity),
    danmakuDensity: clampNumber(source.danmakuDensity, 0.25, 1, defaultConfig.danmakuDensity),
    danmakuSpeed: clampNumber(source.danmakuSpeed, 0.6, 1.8, defaultConfig.danmakuSpeed),
    defaultPlaybackRate: clampRate(source.defaultPlaybackRate),
    defaultQualityMode: "auto",
    searchHistory: normalizeSearchHistory(source.searchHistory),
    bufferMode: pick(["auto", "small", "medium", "large"], source.bufferMode, defaultConfig.bufferMode),
    defaultFormat: pick(["dash", "mp4"], source.defaultFormat, defaultConfig.defaultFormat),
    codecPreference: pick(["avc", "hevc", "av1"], source.codecPreference, defaultConfig.codecPreference),
    audioPreference: pick(["standard", "flac"], source.audioPreference, defaultConfig.audioPreference),
    autoPlay: source.autoPlay !== false,
  };
}

/** 从白名单中取值，非法时回退默认 */
function pick<T extends string>(allowed: readonly T[], value: unknown, fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** 搜索历史：只保留非空字符串，最多 10 条 */
function normalizeSearchHistory(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const keyword = item.trim();
    if (!keyword || seen.has(keyword)) continue;
    seen.add(keyword);
    result.push(keyword);
    if (result.length >= 10) break;
  }
  return result;
}

/** 记录一条搜索历史（去重置顶、上限 10 条），返回新列表 */
export function withSearchHistory(history: string[], keyword: string): string[] {
  const trimmed = keyword.trim();
  if (!trimmed) return history;
  return normalizeSearchHistory([trimmed, ...history]);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function clampRate(value: unknown) {
  const parsed = Number(value);
  return [0.5, 0.75, 1, 1.25, 1.5, 2].includes(parsed) ? parsed : defaultConfig.defaultPlaybackRate;
}

export function errorMessage(error: unknown) {
  const kind = readErrorKind(error);
  if (kind) {
    const fallback = error instanceof Error ? error.message : "";
    const prefix = errorPrefix(kind);
    return fallback ? `${prefix}：${fallback}` : prefix;
  }
  return error instanceof Error ? error.message : String(error);
}

function readErrorKind(error: unknown): BiliErrorKind | "" {
  if (!error || typeof error !== "object") return "";
  const kind = (error as { kind?: unknown }).kind;
  return typeof kind === "string" ? (kind as BiliErrorKind) : "";
}

function errorPrefix(kind: BiliErrorKind) {
  switch (kind) {
    case "notLoggedIn":
      return "需要登录 Bilibili";
    case "loginExpired":
      return "Bilibili 登录已过期";
    case "vipRequired":
      return "该能力需要大会员";
    case "permissionDenied":
      return "没有执行该操作的权限";
    case "regionRestricted":
      return "当前内容存在地区限制";
    case "copyrightRestricted":
      return "当前内容存在版权限制";
    case "riskControl":
      return "请求触发风控，请稍后再试";
    case "network":
      return "网络请求失败";
    case "proxy":
      return "本地代理异常";
    case "playback":
      return "播放失败";
    case "api":
      return "Bilibili API 返回错误";
    default:
      return "未知错误";
  }
}
