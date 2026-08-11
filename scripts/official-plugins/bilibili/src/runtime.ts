import type { BiliErrorKind, BiliLoginInfo, BiliQrLoginKey, PluginSdk } from "./types";

export interface BilibiliRuntimeState {
  sdk: PluginSdk | null;
  disposed: boolean;
  loginInfo: BiliLoginInfo | null;
  loginQr: BiliQrLoginKey | null;
  loginPolling: boolean;
  loginError: string;
  config: BilibiliPluginConfig;
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
};

const initialState: BilibiliRuntimeState = {
  sdk: null,
  disposed: false,
  loginInfo: null,
  loginQr: null,
  loginPolling: false,
  loginError: "",
  config: defaultConfig,
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
  };
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
