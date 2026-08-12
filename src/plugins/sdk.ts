import { invoke } from "@tauri-apps/api/core";
import type { ReactElement } from "react";
import { createElement, Fragment, useCallback, useContext, useEffect, useRef, useState } from "react";
import { showToast } from "../lib/toast";
import { off, onForPlugin } from "./events";
import type {
  CaptchaSentResult,
  Lyrics,
  LoginQrCheckResult,
  LoginQrKeyResult,
  LoginInfo,
  Album,
  Artist,
  PlaybackQuality,
  Playlist,
  Song,
  SongUrlResult,
} from "./music-types";

export type {
  Artist,
  Album,
  CaptchaSentResult,
  Lyrics,
  LoginInfo,
  LoginQrCheckResult,
  LoginQrKeyResult,
  PlaybackQuality,
  PlayMode,
  Playlist,
  Song,
  SongUrlResult,
} from "./music-types";

// React re-exports — plugins must NOT import "react" directly; everything
// comes from the "sdk" module (resolved via the document import map).
export { createElement, Fragment, useCallback, useContext, useEffect, useRef, useState };

/// Default export mirrors the React surface so plugins can write the classic
/// JSX transform import (`import React from "sdk"`) per design 3.1.
export default {
  createElement,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
};

// Curated set of app UI components plugins can reuse.
export { default as Button } from "../components/ui/Button";
export { default as Dialog } from "../components/ui/Dialog";
export { default as Icon } from "../components/ui/Icon";
export { default as Select } from "../components/ui/Select";
export { default as Slider } from "../components/ui/Slider";
export { default as TextField } from "../components/ui/TextField";
export { default as Toggle } from "../components/ui/Toggle";

/// Highest api_version the current SDK supports. Bump only on breaking changes.
export const apiVersion = 1;

export const ALL_PERMISSIONS = ["core.read", "core.backup", "events", "ui", "music", "bilibili"] as const;
export type Permission = (typeof ALL_PERMISSIONS)[number];
export type LifecycleDispose = () => void | Promise<void>;

export interface RegisteredPage {
  pluginId: string;
  path: string;
  title: string;
  icon?: string;
  render: () => ReactElement;
}

export interface RegisteredSettingsSection {
  pluginId: string;
  id: string;
  title: string;
  render: () => ReactElement;
}

export interface BiliLoginInfo {
  provider: "bilibili" | string;
  loggedIn: boolean;
  userId: string;
  nickname: string;
  avatar: string;
  loginExpired: boolean;
  message: string;
}

export interface BiliQrLoginKey {
  key: string;
  qrUrl: string;
  qrImage: string;
}

export interface BiliQrLoginStatus {
  code: number;
  message: string;
  loggedIn: boolean;
  loginInfo?: BiliLoginInfo;
}

export interface BiliOperationResult {
  ok: boolean;
  message: string;
}

export interface BiliDanmakuSendResult {
  ok: boolean;
  message: string;
  dmid?: number;
}

export interface BiliDynamicCard {
  dynId: string;
  cardType: string;
  uid: number;
  name: string;
  face: string;
  pubTime: string;
  content: string;
  video?: BiliDynamicVideo | null;
  images: string[];
  live?: BiliDynamicLive | null;
  forward?: BiliDynamicCard | null;
  likeCount: number;
  liked: boolean;
  forwardCount: number;
  commentCount: number;
  commentId: string;
  commentType: number;
  visible: boolean;
  isTop: boolean;
}

export interface BiliDynamicVideo {
  aid: number;
  bvid: string;
  cover: string;
  title: string;
  durationText: string;
  desc: string;
  play: number;
  danmaku: number;
}

export interface BiliDynamicLive {
  roomId: number;
  title: string;
  cover: string;
  areaName: string;
}

export interface BiliDynamicPage {
  cards: BiliDynamicCard[];
  hasMore: boolean;
  offset: string;
}

export interface BiliDynamicForwardEntry {
  dynId: string;
  pubTime: string;
  name: string;
  face: string;
  content: string;
}

export interface BiliDynamicForwardsPage {
  entries: BiliDynamicForwardEntry[];
  hasMore: boolean;
  offset: string;
}

export interface BiliDynamicCreated {
  ok: boolean;
  message: string;
  dynId: string;
}

export interface BiliMessageSession {
  talkerId: number;
  unreadCount: number;
  lastMsg?: BiliMessageItem | null;
  name: string;
  face: string;
}

export interface BiliMessageItem {
  msgId: number;
  senderUid: number;
  content: string;
  timestamp: number;
  msgType: number;
}

export interface BiliMessageSessionsPage {
  sessions: BiliMessageSession[];
  hasMore: boolean;
  nextOffset?: string | null;
}

export interface BiliMessageHistoryPage {
  messages: BiliMessageItem[];
  hasMore: boolean;
  nextOffset?: number | null;
}

export interface BiliMessageUnread {
  reply: number;
  at: number;
  like: number;
  privateMsg: number;
  sysMsg: number;
}

export interface BiliReplyFeedEntry {
  id: number;
  userName: string;
  userFace: string;
  replyTime: number;
  title: string;
  desc: string;
  uri: string;
  replyType: string;
}

export interface BiliReplyFeedPage {
  entries: BiliReplyFeedEntry[];
  isEnd: boolean;
  cursorId?: number | null;
}

export type BiliErrorKind =
  | "notLoggedIn"
  | "loginExpired"
  | "vipRequired"
  | "permissionDenied"
  | "regionRestricted"
  | "copyrightRestricted"
  | "riskControl"
  | "network"
  | "proxy"
  | "playback"
  | "api"
  | "unknown";

export interface BiliErrorDto {
  kind: BiliErrorKind;
  message: string;
  retryable: boolean;
  externalUrl?: string;
}

export class BiliSdkError extends Error {
  kind: BiliErrorKind;
  retryable: boolean;
  externalUrl?: string;

  constructor(dto: BiliErrorDto) {
    super(dto.message);
    this.name = "BiliSdkError";
    this.kind = dto.kind;
    this.retryable = dto.retryable;
    this.externalUrl = dto.externalUrl;
  }
}

export interface BiliLocalProgress {
  bvid: string;
  aid: number;
  cid: number;
  progressSeconds: number;
  updatedAt: number;
}

export interface BiliVideoCard {
  bvid: string;
  aid: number;
  cid: number;
  title: string;
  cover: string;
  ownerName: string;
  ownerMid: number;
  duration: number;
  viewCount: number;
  danmakuCount: number;
  publishedAt: number;
  progress: number;
}

export interface BiliWeeklySeries {
  number: number;
  subject: string;
  name: string;
}

export interface BiliHotWord {
  keyword: string;
  showName: string;
  heatScore: number;
}

export interface BiliPreciousVideos {
  title: string;
  explain: string;
  videos: BiliVideoCard[];
}

export interface BiliUserSpace {
  mid: number;
  name: string;
  face: string;
  sign: string;
  level: number;
  fans: number;
  following: number;
  likes: number;
  view: number;
  archiveCount: number;
  isFollowed: boolean;
  liveRoom: BiliUserSpaceLive | null;
}

export interface BiliUserSpaceLive {
  roomId: number;
  liveStatus: number;
  title: string;
  url: string;
}

export interface BiliSeasonDetail {
  seasonId: number;
  mediaId: number;
  title: string;
  cover: string;
  evaluate: string;
  total: number;
  isFollowed: boolean;
  newEp: string;
  score: BiliSeasonScore | null;
  episodes: BiliSeasonEpisode[];
}

export interface BiliSeasonScore {
  score: number;
  count: number;
}

export interface BiliSeasonEpisode {
  epId: number;
  aid: number;
  cid: number;
  bvid: string;
  title: string;
  longTitle: string;
  cover: string;
  duration: number;
}

export interface BiliPgcCard {
  seasonId: number;
  seasonType: number;
  title: string;
  cover: string;
  indexShow: string;
  score: number | null;
}

export interface BiliPgcSection {
  title: string;
  style: string;
  items: BiliPgcCard[];
}

export interface BiliBangumiFollow {
  seasonId: number;
  mediaId: number;
  title: string;
  cover: string;
  totalCount: number;
  isFinish: number;
  badge: string;
}

export interface BiliOwner {
  mid: number;
  name: string;
  face: string;
}

export interface BiliVideoStats {
  viewCount: number;
  danmakuCount: number;
  replyCount: number;
  favoriteCount: number;
  coinCount: number;
  shareCount: number;
  likeCount: number;
}

export interface BiliVideoPage {
  cid: number;
  page: number;
  title: string;
  duration: number;
}

export interface BiliVideoDetail {
  bvid: string;
  aid: number;
  cid: number;
  title: string;
  cover: string;
  description: string;
  owner: BiliOwner;
  stats: BiliVideoStats;
  pages: BiliVideoPage[];
  duration: number;
  publishedAt: number;
  lastPlayCid?: number;
  lastPlayTime?: number;
}

export interface BiliQualityOption {
  id: string;
  quality: number;
  label: string;
  codecs: string;
  width?: number;
  height?: number;
  bandwidth: number;
}

export interface BiliPlaybackSource {
  playbackId: string;
  manifestUrl: string;
  directUrl?: string;
  qualities: BiliQualityOption[];
  expiresAt: number;
}

export interface BiliDanmakuItem {
  id: string;
  time: number;
  text: string;
  color: string;
  mode: number;
  fontSize: number;
  timestamp: number;
}

export interface BiliHistoryItem {
  video: BiliVideoCard;
  viewedAt: number;
  page: number;
  pageTitle: string;
}

export interface BiliToViewItem {
  video: BiliVideoCard;
  addedAt: number;
}

export interface BiliFavoriteFolder {
  id: number;
  title: string;
  cover: string;
  ownerMid: number;
  ownerName: string;
  mediaCount: number;
  owned: boolean;
  favState: number;
}

export interface BiliVideoInteractionStats {
  likeCount: number;
  coinCount: number;
  favoriteCount: number;
  shareCount: number;
}

export interface BiliOwnerInteractionState {
  mid: number;
  name: string;
  avatar: string;
  followerCount: number;
  following: boolean;
}

export interface BiliVideoInteractionState {
  aid: number;
  bvid: string;
  liked: boolean;
  coinCount: number;
  favorited: boolean;
  toView: boolean;
  stats: BiliVideoInteractionStats;
  owner: BiliOwnerInteractionState;
  favoriteFolders: BiliFavoriteFolder[];
}

export interface BiliFavoriteItem {
  video: BiliVideoCard;
  mediaId: number;
  favoriteTime: number;
}

export type BiliCommentSort = "time" | "like" | "replies";
export type BiliReportReason =
  | "other"
  | "ad"
  | "porn"
  | "spam"
  | "flame"
  | "spoiler"
  | "politics"
  | "abuse"
  | "irrelevant"
  | "illegal"
  | "vulgar"
  | "phishing"
  | "scam"
  | "rumor"
  | "incitement"
  | "privacy"
  | "floorSnatching"
  | "harmfulToYouth";

export interface BiliCommentMember {
  mid: number;
  name: string;
  avatar: string;
}

export interface BiliCommentContent {
  message: string;
  pictures: string[];
}

export interface BiliComment {
  rpid: number;
  root: number;
  parent: number;
  ctime: number;
  likeCount: number;
  liked: boolean;
  disliked: boolean;
  repliesCount: number;
  member: BiliCommentMember;
  content: BiliCommentContent;
  replies: BiliComment[];
  canDelete: boolean;
  canTop: boolean;
  isTop: boolean;
}

export interface BiliCommentPage {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  sort: string;
  comments: BiliComment[];
  topComments: BiliComment[];
}

// Module-level UI registries, keyed by pluginId (loader clears on unload).
export const registeredPages: RegisteredPage[] = [];
export const registeredSettingsSections: RegisteredSettingsSection[] = [];
const disposeCallbacks = new Map<string, LifecycleDispose[]>();

export function clearPluginRegistrations(pluginId: string) {
  for (let i = registeredPages.length - 1; i >= 0; i--) {
    if (registeredPages[i].pluginId === pluginId) registeredPages.splice(i, 1);
  }
  for (let i = registeredSettingsSections.length - 1; i >= 0; i--) {
    if (registeredSettingsSections[i].pluginId === pluginId) registeredSettingsSections.splice(i, 1);
  }
}

export async function runPluginDispose(pluginId: string): Promise<unknown[]> {
  const callbacks = disposeCallbacks.get(pluginId) ?? [];
  const errors: unknown[] = [];
  for (const callback of callbacks) {
    try {
      await callback();
    } catch (e) {
      errors.push(e);
    }
  }
  return errors;
}

export function clearPluginDispose(pluginId: string): void {
  disposeCallbacks.delete(pluginId);
}

export interface PluginSdk {
  apiVersion: number;
  log: (...args: unknown[]) => void;
  ui: {
    registerPage(page: { path: string; title: string; icon?: string; render: () => ReactElement }): void;
    registerSettingsSection(section: { id: string; title: string; render: () => ReactElement }): void;
    notify(message: string): void;
  };
  core: {
    listGames(): Promise<unknown[]>;
    listSnapshots(gameId: string): Promise<unknown[]>;
    getGame(gameId: string): Promise<unknown>;
    triggerBackup(gameId: string): Promise<unknown>;
  };
  events: {
    on(event: string, handler: (payload: unknown) => void): void;
    off(event: string, handler: (payload: unknown) => void): void;
  };
  storage: {
    get(): Promise<unknown | null>;
    set(data: unknown): Promise<void>;
  };
  lifecycle: {
    onDispose(callback: LifecycleDispose): void;
  };
  music: {
    openLoginWindow(): Promise<void>;
    loginQrKey(): Promise<LoginQrKeyResult>;
    loginQrCheck(key: string): Promise<LoginQrCheckResult>;
    sendLoginCaptcha(phone: string, countrycode?: string): Promise<CaptchaSentResult>;
    loginCellphone(phone: string, captcha: string, countrycode?: string): Promise<LoginInfo>;
    loginStatus(): Promise<LoginInfo>;
    logout(): Promise<void>;
    search(keywords: string, limit?: number): Promise<Song[]>;
    userPlaylists(): Promise<Playlist[]>;
    likedList(): Promise<string[]>;
    likeSong(id: string, like: boolean): Promise<void>;
    subscribePlaylist(id: string, subscribe: boolean): Promise<void>;
    recommendSongs(): Promise<Song[]>;
    topPlaylists(): Promise<Playlist[]>;
    personalizedPlaylists(): Promise<Playlist[]>;
    searchPlaylists(keywords: string, limit?: number): Promise<Playlist[]>;
    searchAlbums(keywords: string, limit?: number): Promise<Album[]>;
    searchArtists(keywords: string, limit?: number): Promise<Artist[]>;
    albumSongs(id: string): Promise<Song[]>;
    artistSongs(id: string): Promise<Song[]>;
    playlistTracks(id: string): Promise<[Playlist, Song[]]>;
    playlistTracksRange(id: string, start: number, count: number): Promise<Song[]>;
    songUrl(id: string, quality?: PlaybackQuality): Promise<SongUrlResult>;
    lyric(id: string): Promise<Lyrics>;
    proxyPort(): Promise<number>;
    audioProxyUrl(rawUrl: string): Promise<string>;
    coverProxyUrl(rawUrl: string): Promise<string>;
    clearCoverCache(): Promise<number>;
  };
  bilibili: {
    account: {
      loginQrKey(): Promise<BiliQrLoginKey>;
      loginQrCheck(key: string): Promise<BiliQrLoginStatus>;
      loginStatus(): Promise<BiliLoginInfo>;
      logout(): Promise<BiliOperationResult>;
    };
    home: {
      recommendVideos(page?: number, refresh?: boolean): Promise<BiliVideoCard[]>;
      searchVideos(keywords: string, page?: number, refresh?: boolean): Promise<BiliVideoCard[]>;
      popularVideos(page?: number, refresh?: boolean): Promise<BiliVideoCard[]>;
    };
    video: {
      detail(args: { bvid?: string; aid?: number }): Promise<BiliVideoDetail>;
      related(args: { bvid?: string; aid?: number }): Promise<BiliVideoCard[]>;
      openExternal(bvid: string): Promise<BiliOperationResult>;
    };
    playback: {
      proxyPort(): Promise<number>;
      createPlayback(args: {
        bvid?: string;
        aid?: number;
        cid: number;
        quality?: number;
        preferProgressive?: boolean;
        seasonId?: number;
        epId?: number;
      }): Promise<BiliPlaybackSource>;
      saveLocalProgress(args: {
        bvid: string;
        aid: number;
        cid: number;
        progressSeconds: number;
      }): Promise<BiliLocalProgress>;
      loadLocalProgress(args: { bvid: string; cid?: number }): Promise<BiliLocalProgress | null>;
      reportProgress(args: { aid: number; cid: number; progress: number }): Promise<BiliOperationResult>;
    };
    danmaku: {
      list(args: { cid: number; aid?: number; bvid?: string }): Promise<BiliDanmakuItem[]>;
      segment(args: {
        cid: number;
        segmentIndex: number;
        aid?: number;
      }): Promise<BiliDanmakuItem[]>;
      thumbup(args: { cid: number; dmid: number; like: boolean }): Promise<BiliOperationResult>;
      report(args: {
        cid: number;
        dmid: number;
        reason: number;
        content?: string;
      }): Promise<BiliOperationResult>;
      recall(args: { cid: number; dmid: number }): Promise<BiliOperationResult>;
      send(args: {
        aid: number;
        bvid: string;
        cid: number;
        message: string;
        progress: number;
      }): Promise<BiliDanmakuSendResult>;
    };
    comment: {
      list(args: {
        oid: string | number;
        page?: number;
        sort?: BiliCommentSort;
        type?: number;
      }): Promise<BiliCommentPage>;
      replies(args: { oid: string | number; root: number; page?: number }): Promise<BiliCommentPage>;
      add(args: { oid: string | number; message: string; root?: number; parent?: number }): Promise<BiliComment>;
      like(args: { oid: string | number; rpid: number; like: boolean }): Promise<BiliOperationResult>;
      dislike(args: { oid: string | number; rpid: number; dislike: boolean }): Promise<BiliOperationResult>;
      delete(args: { oid: string | number; rpid: number }): Promise<BiliOperationResult>;
      top(args: { oid: string | number; rpid: number; top: boolean }): Promise<BiliOperationResult>;
      report(args: {
        oid: string | number;
        rpid: number;
        reason: BiliReportReason;
        content?: string;
      }): Promise<BiliOperationResult>;
    };
    library: {
      historyList(page?: number): Promise<BiliHistoryItem[]>;
      toViewList(): Promise<BiliToViewItem[]>;
      addToView(args: { aid: number; bvid?: string }): Promise<BiliOperationResult>;
      removeToView(args: { aid: number }): Promise<BiliOperationResult>;
      favoriteFolders(rid?: number): Promise<BiliFavoriteFolder[]>;
      favoriteItems(mediaId: number, page?: number): Promise<BiliFavoriteItem[]>;
      favoriteVideo(args: {
        rid: number;
        addMediaIds?: string[];
        delMediaIds?: string[];
      }): Promise<BiliOperationResult>;
    };
    interaction: {
      state(args: { aid?: number; bvid?: string; ownerMid?: number }): Promise<BiliVideoInteractionState>;
      like(args: { aid?: number; bvid?: string; liked: boolean }): Promise<BiliVideoInteractionState>;
      coin(args: {
        aid?: number;
        bvid?: string;
        multiply: 1 | 2;
        alsoLike: boolean;
      }): Promise<BiliVideoInteractionState>;
      favorite(args: {
        rid: number;
        addMediaIds?: string[];
        delMediaIds?: string[];
      }): Promise<BiliVideoInteractionState>;
      toView(args: { aid: number; bvid?: string; toView: boolean }): Promise<BiliVideoInteractionState>;
      followOwner(args: {
        mid: number;
        following: boolean;
        aid?: number;
        bvid?: string;
      }): Promise<BiliVideoInteractionState>;
      copyShareLink(args: { bvid: string }): Promise<BiliOperationResult>;
      openReport(args: { bvid: string }): Promise<BiliOperationResult>;
    };
    cache: {
      saveScreenshot(args: { fileName: string; dataBase64: string }): Promise<string>;
      openScreenshotFolder(): Promise<BiliOperationResult>;
      clearCache(): Promise<number>;
      coverProxyUrl(rawUrl: string): Promise<string>;
    };
    ranking: {
      videos(rid?: number): Promise<BiliVideoCard[]>;
      weeks(): Promise<BiliWeeklySeries[]>;
      weekDetail(number: number): Promise<BiliVideoCard[]>;
      precious(): Promise<BiliPreciousVideos>;
    };
    search: {
      suggest(keyword: string): Promise<string[]>;
      hotwords(): Promise<BiliHotWord[]>;
    };
    fav: {
      createFolder(args: { title: string }): Promise<BiliOperationResult>;
      editFolder(args: { mediaId: number; title: string }): Promise<BiliOperationResult>;
      deleteFolders(args: { mediaIds: number[] }): Promise<BiliOperationResult>;
      deleteResources(args: { mediaId: number; resources: number[] }): Promise<BiliOperationResult>;
      moveResources(args: {
        srcMediaId: number;
        tarMediaId: number;
        resources: number[];
      }): Promise<BiliOperationResult>;
      copyResources(args: {
        srcMediaId: number;
        tarMediaId: number;
        resources: number[];
      }): Promise<BiliOperationResult>;
      cleanResources(args: { mediaId: number }): Promise<BiliOperationResult>;
    };
    user: {
      space(args: { mid: number }): Promise<BiliUserSpace>;
      videos(args: { mid: number; page?: number }): Promise<BiliVideoCard[]>;
      follow(args: { mid: number; follow: boolean }): Promise<BiliOperationResult>;
    };
    season: {
      detail(args: { seasonId: number }): Promise<BiliSeasonDetail>;
      follow(args: { seasonId: number; follow: boolean }): Promise<BiliOperationResult>;
      pgcTabs(args: { kind: "bangumi" | "cinema" }): Promise<BiliPgcSection[]>;
      pgcRank(args: { seasonType: number }): Promise<BiliPgcCard[]>;
      followList(args: { page?: number; cinema?: boolean }): Promise<BiliBangumiFollow[]>;
    };
    live: Record<string, never>;
    dynamic: {
      all(args: { offset?: string; hostMid?: number }): Promise<BiliDynamicPage>;
      detail(args: { dynId: string }): Promise<BiliDynamicCard>;
      like(args: { dynId: string; like: boolean }): Promise<BiliOperationResult>;
      createText(args: { content: string }): Promise<BiliDynamicCreated>;
      top(args: { dynId: string; top: boolean }): Promise<BiliOperationResult>;
      forwards(args: { dynId: string; offset?: string }): Promise<BiliDynamicForwardsPage>;
    };
    message: {
      sessions(args: { beginTs?: number }): Promise<BiliMessageSessionsPage>;
      history(args: { talkerUid: number; cursor?: number }): Promise<BiliMessageHistoryPage>;
      send(args: { uid: number; content: string }): Promise<BiliOperationResult>;
      unread(): Promise<BiliMessageUnread>;
      replyFeed(args: { startId?: number; startTime?: number }): Promise<BiliReplyFeedPage>;
    };
    note: Record<string, never>;
    article: Record<string, never>;
  };
}

/// Build the SDK instance handed to a plugin at load time. The allowlist is
/// enforced here: calling an API whose permission was not declared in the
/// manifest throws PermissionDenied.
export function createPluginSdk(pluginId: string, permissions: string[]): PluginSdk {
  const allowed = new Set(permissions);
  function requirePerm(perm: Permission, apiName: string) {
    if (!allowed.has(perm)) {
      throw new Error(
        `PermissionDenied: plugin "${pluginId}" lacks permission "${perm}" (${apiName})`
      );
    }
  }
  function biliInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    return invoke<T>(command, args).catch((error) => {
      throw parseBiliError(error);
    });
  }

  return {
    apiVersion,
    log: (...args: unknown[]) => console.log(`[plugin:${pluginId}]`, ...args),

    ui: {
      registerPage(page) {
        requirePerm("ui", "ui.registerPage");
        registeredPages.push({ pluginId, ...page });
      },
      registerSettingsSection(section) {
        requirePerm("ui", "ui.registerSettingsSection");
        registeredSettingsSections.push({ pluginId, ...section });
      },
      notify(message) {
        requirePerm("ui", "ui.notify");
        showToast("info", message);
      },
    },

    core: {
      listGames() {
        requirePerm("core.read", "core.listGames");
        return invoke("get_games");
      },
      listSnapshots(gameId) {
        requirePerm("core.read", "core.listSnapshots");
        return invoke("get_snapshots", { gameId });
      },
      getGame(gameId) {
        requirePerm("core.read", "core.getGame");
        return invoke("get_game_by_id", { gameId });
      },
      triggerBackup(gameId) {
        requirePerm("core.backup", "core.triggerBackup");
        return invoke("backup_now", { gameId });
      },
    },

    events: {
      on(event, handler) {
        requirePerm("events", "events.on");
        onForPlugin(pluginId, event, handler);
      },
      off(event, handler) {
        requirePerm("events", "events.off");
        off(event, handler);
      },
    },

    storage: {
      get() {
        return invoke("read_plugin_config", { id: pluginId });
      },
      set(data) {
        return invoke("write_plugin_config", { id: pluginId, data });
      },
    },

    lifecycle: {
      onDispose(callback) {
        const callbacks = disposeCallbacks.get(pluginId) ?? [];
        callbacks.push(callback);
        disposeCallbacks.set(pluginId, callbacks);
      },
    },

    music: {
      openLoginWindow() {
        requirePerm("music", "music.openLoginWindow");
        return invoke("music_open_login_window");
      },
      loginQrKey() {
        requirePerm("music", "music.loginQrKey");
        return invoke("music_login_qr_key");
      },
      loginQrCheck(key) {
        requirePerm("music", "music.loginQrCheck");
        return invoke("music_login_qr_check", { key });
      },
      sendLoginCaptcha(phone, countrycode) {
        requirePerm("music", "music.sendLoginCaptcha");
        return invoke("music_login_send_captcha", { phone, countrycode });
      },
      loginCellphone(phone, captcha, countrycode) {
        requirePerm("music", "music.loginCellphone");
        return invoke("music_login_cellphone", { phone, captcha, countrycode });
      },
      loginStatus() {
        requirePerm("music", "music.loginStatus");
        return invoke("music_login_status");
      },
      logout() {
        requirePerm("music", "music.logout");
        return invoke("music_logout");
      },
      search(keywords, limit) {
        requirePerm("music", "music.search");
        return invoke("music_search", { keywords, limit });
      },
      userPlaylists() {
        requirePerm("music", "music.userPlaylists");
        return invoke("music_user_playlists");
      },
      likedList() {
        requirePerm("music", "music.likedList");
        return invoke("music_likelist");
      },
      likeSong(id, like) {
        requirePerm("music", "music.likeSong");
        return invoke("music_like", { id, like });
      },
      subscribePlaylist(id, subscribe) {
        requirePerm("music", "music.subscribePlaylist");
        return invoke("music_playlist_subscribe", { id, subscribe });
      },
      recommendSongs() {
        requirePerm("music", "music.recommendSongs");
        return invoke("music_recommend_songs");
      },
      topPlaylists() {
        requirePerm("music", "music.topPlaylists");
        return invoke("music_toplists");
      },
      personalizedPlaylists() {
        requirePerm("music", "music.personalizedPlaylists");
        return invoke("music_personalized_playlists");
      },
      searchPlaylists(keywords, limit) {
        requirePerm("music", "music.searchPlaylists");
        return invoke("music_playlist_search", { keywords, limit });
      },
      searchAlbums(keywords, limit) {
        requirePerm("music", "music.searchAlbums");
        return invoke("music_album_search", { keywords, limit });
      },
      searchArtists(keywords, limit) {
        requirePerm("music", "music.searchArtists");
        return invoke("music_artist_search", { keywords, limit });
      },
      albumSongs(id) {
        requirePerm("music", "music.albumSongs");
        return invoke("music_album_songs", { id });
      },
      artistSongs(id) {
        requirePerm("music", "music.artistSongs");
        return invoke("music_artist_songs", { id });
      },
      playlistTracks(id) {
        requirePerm("music", "music.playlistTracks");
        return invoke("music_playlist_tracks", { id });
      },
      playlistTracksRange(id, start, count) {
        requirePerm("music", "music.playlistTracksRange");
        return invoke("music_playlist_tracks_range", { id, start, count });
      },
      songUrl(id, quality) {
        requirePerm("music", "music.songUrl");
        const args = quality ? { id, quality } : { id };
        return invoke("music_song_url", args);
      },
      lyric(id) {
        requirePerm("music", "music.lyric");
        return invoke("music_lyric", { id });
      },
      proxyPort() {
        requirePerm("music", "music.proxyPort");
        return invoke("music_proxy_port");
      },
      async audioProxyUrl(rawUrl) {
        requirePerm("music", "music.audioProxyUrl");
        const port = await invoke<number>("music_proxy_port");
        return `http://127.0.0.1:${port}/audio?url=${encodeURIComponent(rawUrl)}`;
      },
      async coverProxyUrl(rawUrl) {
        requirePerm("music", "music.coverProxyUrl");
        if (!rawUrl) return "";
        const port = await invoke<number>("music_proxy_port");
        return `http://127.0.0.1:${port}/cover?url=${encodeURIComponent(rawUrl)}`;
      },
      clearCoverCache() {
        requirePerm("music", "music.clearCoverCache");
        return invoke("music_clear_cover_cache");
      },
    },

    bilibili: {
      account: {
        loginQrKey() {
          requirePerm("bilibili", "bilibili.account.loginQrKey");
          return biliInvoke("bilibili_login_qr_key");
        },
        loginQrCheck(key) {
          requirePerm("bilibili", "bilibili.account.loginQrCheck");
          return biliInvoke("bilibili_login_qr_check", { key });
        },
        loginStatus() {
          requirePerm("bilibili", "bilibili.account.loginStatus");
          return biliInvoke("bilibili_login_status");
        },
        logout() {
          requirePerm("bilibili", "bilibili.account.logout");
          return biliInvoke("bilibili_logout");
        },
      },
      home: {
        recommendVideos(page, refresh) {
          requirePerm("bilibili", "bilibili.home.recommendVideos");
          return biliInvoke("bilibili_recommend_videos", { page, refresh });
        },
        searchVideos(keywords, page, refresh) {
          requirePerm("bilibili", "bilibili.home.searchVideos");
          return biliInvoke("bilibili_search_videos", { keywords, page, refresh });
        },
        popularVideos(page, refresh) {
          requirePerm("bilibili", "bilibili.home.popularVideos");
          return biliInvoke("bilibili_popular_videos", { page, refresh });
        },
      },
      video: {
        detail(args) {
          requirePerm("bilibili", "bilibili.video.detail");
          return biliInvoke("bilibili_video_detail", args);
        },
        related(args) {
          requirePerm("bilibili", "bilibili.video.related");
          return biliInvoke("bilibili_related_videos", args);
        },
        openExternal(bvid) {
          requirePerm("bilibili", "bilibili.video.openExternal");
          return biliInvoke("bilibili_open_video", { bvid });
        },
      },
      playback: {
        proxyPort() {
          requirePerm("bilibili", "bilibili.playback.proxyPort");
          return biliInvoke("bilibili_proxy_port");
        },
        createPlayback(args) {
          requirePerm("bilibili", "bilibili.playback.createPlayback");
          return biliInvoke("bilibili_create_playback", args);
        },
        saveLocalProgress(args) {
          requirePerm("bilibili", "bilibili.playback.saveLocalProgress");
          return biliInvoke("bilibili_save_local_progress", args);
        },
        loadLocalProgress(args) {
          requirePerm("bilibili", "bilibili.playback.loadLocalProgress");
          return biliInvoke("bilibili_load_local_progress", args);
        },
        reportProgress(args) {
          requirePerm("bilibili", "bilibili.playback.reportProgress");
          return biliInvoke("bilibili_report_progress", args);
        },
      },
      danmaku: {
        list(args) {
          requirePerm("bilibili", "bilibili.danmaku.list");
          return biliInvoke("bilibili_danmaku_list", args);
        },
        segment(args) {
          requirePerm("bilibili", "bilibili.danmaku.segment");
          return biliInvoke("bilibili_danmaku_segment", args);
        },
        thumbup(args) {
          requirePerm("bilibili", "bilibili.danmaku.thumbup");
          return biliInvoke("bilibili_danmaku_thumbup", args);
        },
        report(args) {
          requirePerm("bilibili", "bilibili.danmaku.report");
          return biliInvoke("bilibili_danmaku_report", args);
        },
        recall(args) {
          requirePerm("bilibili", "bilibili.danmaku.recall");
          return biliInvoke("bilibili_danmaku_recall", args);
        },
        send(args) {
          requirePerm("bilibili", "bilibili.danmaku.send");
          return biliInvoke("bilibili_send_danmaku", args);
        },
      },
      comment: {
        list(args) {
          requirePerm("bilibili", "bilibili.comment.list");
          return biliInvoke("bilibili_comment_list", { ...args, oid: String(args.oid) });
        },
        replies(args) {
          requirePerm("bilibili", "bilibili.comment.replies");
          return biliInvoke("bilibili_comment_replies", { ...args, oid: String(args.oid) });
        },
        add(args) {
          requirePerm("bilibili", "bilibili.comment.add");
          return biliInvoke("bilibili_comment_add", { ...args, oid: String(args.oid) });
        },
        like(args) {
          requirePerm("bilibili", "bilibili.comment.like");
          return biliInvoke("bilibili_comment_like", { ...args, oid: String(args.oid) });
        },
        dislike(args) {
          requirePerm("bilibili", "bilibili.comment.dislike");
          return biliInvoke("bilibili_comment_dislike", { ...args, oid: String(args.oid) });
        },
        delete(args) {
          requirePerm("bilibili", "bilibili.comment.delete");
          return biliInvoke("bilibili_comment_delete", { ...args, oid: String(args.oid) });
        },
        top(args) {
          requirePerm("bilibili", "bilibili.comment.top");
          return biliInvoke("bilibili_comment_top", { ...args, oid: String(args.oid) });
        },
        report(args) {
          requirePerm("bilibili", "bilibili.comment.report");
          return biliInvoke("bilibili_comment_report", { ...args, oid: String(args.oid) });
        },
      },
      library: {
        historyList(page) {
          requirePerm("bilibili", "bilibili.library.historyList");
          return biliInvoke("bilibili_history_list", { page });
        },
        toViewList() {
          requirePerm("bilibili", "bilibili.library.toViewList");
          return biliInvoke("bilibili_toview_list");
        },
        addToView(args) {
          requirePerm("bilibili", "bilibili.library.addToView");
          return biliInvoke("bilibili_toview_add", args);
        },
        removeToView(args) {
          requirePerm("bilibili", "bilibili.library.removeToView");
          return biliInvoke("bilibili_toview_remove", args);
        },
        favoriteFolders(rid) {
          requirePerm("bilibili", "bilibili.library.favoriteFolders");
          return biliInvoke("bilibili_favorite_folders", { rid });
        },
        favoriteItems(mediaId, page) {
          requirePerm("bilibili", "bilibili.library.favoriteItems");
          return biliInvoke("bilibili_favorite_items", { mediaId, page });
        },
        favoriteVideo(args) {
          requirePerm("bilibili", "bilibili.library.favoriteVideo");
          return biliInvoke("bilibili_favorite_video", {
            rid: args.rid,
            addMediaIds: args.addMediaIds ?? [],
            delMediaIds: args.delMediaIds ?? [],
          });
        },
      },
      interaction: {
        state(args) {
          requirePerm("bilibili", "bilibili.interaction.state");
          return biliInvoke("bilibili_interaction_state", args);
        },
        like(args) {
          requirePerm("bilibili", "bilibili.interaction.like");
          return biliInvoke("bilibili_like_video", args);
        },
        coin(args) {
          requirePerm("bilibili", "bilibili.interaction.coin");
          return biliInvoke("bilibili_coin_video", args);
        },
        favorite(args) {
          requirePerm("bilibili", "bilibili.interaction.favorite");
          return biliInvoke("bilibili_favorite_video_interaction", {
            rid: args.rid,
            addMediaIds: args.addMediaIds ?? [],
            delMediaIds: args.delMediaIds ?? [],
          });
        },
        toView(args) {
          requirePerm("bilibili", "bilibili.interaction.toView");
          return biliInvoke("bilibili_toview_video_interaction", args);
        },
        followOwner(args) {
          requirePerm("bilibili", "bilibili.interaction.followOwner");
          return biliInvoke("bilibili_follow_owner", args);
        },
        copyShareLink(args) {
          requirePerm("bilibili", "bilibili.interaction.copyShareLink");
          return biliInvoke("bilibili_copy_share_link", args);
        },
        openReport(args) {
          requirePerm("bilibili", "bilibili.interaction.openReport");
          return biliInvoke("bilibili_open_report", args);
        },
      },
      cache: {
        saveScreenshot(args) {
          requirePerm("bilibili", "bilibili.cache.saveScreenshot");
          return biliInvoke("bilibili_save_screenshot", args);
        },
        openScreenshotFolder() {
          requirePerm("bilibili", "bilibili.cache.openScreenshotFolder");
          return biliInvoke("bilibili_open_screenshot_folder");
        },
        clearCache() {
          requirePerm("bilibili", "bilibili.cache.clearCache");
          return biliInvoke("bilibili_clear_cache");
        },
        async coverProxyUrl(rawUrl) {
          requirePerm("bilibili", "bilibili.cache.coverProxyUrl");
          if (!rawUrl) return "";
          const port = await biliInvoke<number>("bilibili_proxy_port");
          return `http://127.0.0.1:${port}/bilibili/cover/${coverKey(rawUrl)}?url=${encodeURIComponent(rawUrl)}`;
        },
      },
      ranking: {
        videos(rid) {
          requirePerm("bilibili", "bilibili.ranking.videos");
          return biliInvoke("bilibili_ranking_videos", { rid });
        },
        weeks() {
          requirePerm("bilibili", "bilibili.ranking.weeks");
          return biliInvoke("bilibili_weekly_series_list");
        },
        weekDetail(number) {
          requirePerm("bilibili", "bilibili.ranking.weekDetail");
          return biliInvoke("bilibili_weekly_series_one", { number });
        },
        precious() {
          requirePerm("bilibili", "bilibili.ranking.precious");
          return biliInvoke("bilibili_precious_videos");
        },
      },
      search: {
        suggest(keyword) {
          requirePerm("bilibili", "bilibili.search.suggest");
          return biliInvoke("bilibili_search_suggest", { keyword });
        },
        hotwords() {
          requirePerm("bilibili", "bilibili.search.hotwords");
          return biliInvoke("bilibili_search_hotwords");
        },
      },
      fav: {
        createFolder({ title }) {
          requirePerm("bilibili", "bilibili.fav.createFolder");
          return biliInvoke("bilibili_fav_folder_create", { title });
        },
        editFolder({ mediaId, title }) {
          requirePerm("bilibili", "bilibili.fav.editFolder");
          return biliInvoke("bilibili_fav_folder_edit", { mediaId, title });
        },
        deleteFolders({ mediaIds }) {
          requirePerm("bilibili", "bilibili.fav.deleteFolders");
          return biliInvoke("bilibili_fav_folder_delete", { mediaIds });
        },
        deleteResources({ mediaId, resources }) {
          requirePerm("bilibili", "bilibili.fav.deleteResources");
          return biliInvoke("bilibili_fav_resource_delete", { mediaId, resources });
        },
        moveResources({ srcMediaId, tarMediaId, resources }) {
          requirePerm("bilibili", "bilibili.fav.moveResources");
          return biliInvoke("bilibili_fav_resource_move", { srcMediaId, tarMediaId, resources });
        },
        copyResources({ srcMediaId, tarMediaId, resources }) {
          requirePerm("bilibili", "bilibili.fav.copyResources");
          return biliInvoke("bilibili_fav_resource_copy", { srcMediaId, tarMediaId, resources });
        },
        cleanResources({ mediaId }) {
          requirePerm("bilibili", "bilibili.fav.cleanResources");
          return biliInvoke("bilibili_fav_resource_clean", { mediaId });
        },
      },
      user: {
        space({ mid }) {
          requirePerm("bilibili", "bilibili.user.space");
          return biliInvoke("bilibili_user_space", { mid });
        },
        videos({ mid, page }) {
          requirePerm("bilibili", "bilibili.user.videos");
          return biliInvoke("bilibili_user_videos", { mid, page });
        },
        follow({ mid, follow }) {
          requirePerm("bilibili", "bilibili.user.follow");
          return biliInvoke("bilibili_user_follow", { mid, follow });
        },
      },
      season: {
        detail({ seasonId }) {
          requirePerm("bilibili", "bilibili.season.detail");
          return biliInvoke("bilibili_season_detail", { seasonId });
        },
        follow({ seasonId, follow }) {
          requirePerm("bilibili", "bilibili.season.follow");
          return biliInvoke("bilibili_season_follow", { seasonId, follow });
        },
        pgcTabs({ kind }) {
          requirePerm("bilibili", "bilibili.season.pgcTabs");
          return biliInvoke("bilibili_pgc_tabs", { kind });
        },
        pgcRank({ seasonType }) {
          requirePerm("bilibili", "bilibili.season.pgcRank");
          return biliInvoke("bilibili_pgc_rank", { seasonType });
        },
        followList({ page, cinema }) {
          requirePerm("bilibili", "bilibili.season.followList");
          return biliInvoke("bilibili_bangumi_follow_list", { page, cinema });
        },
      },
      live: {},
      dynamic: {
        all(args) {
          requirePerm("bilibili", "bilibili.dynamic.all");
          return biliInvoke("bilibili_dynamic_all", args);
        },
        detail(args) {
          requirePerm("bilibili", "bilibili.dynamic.detail");
          return biliInvoke("bilibili_dynamic_detail", args);
        },
        like(args) {
          requirePerm("bilibili", "bilibili.dynamic.like");
          return biliInvoke("bilibili_dynamic_like", args);
        },
        createText(args) {
          requirePerm("bilibili", "bilibili.dynamic.createText");
          return biliInvoke("bilibili_dynamic_create_text", args);
        },
        top(args) {
          requirePerm("bilibili", "bilibili.dynamic.top");
          return biliInvoke("bilibili_dynamic_top", args);
        },
        forwards(args) {
          requirePerm("bilibili", "bilibili.dynamic.forwards");
          return biliInvoke("bilibili_dynamic_forwards", args);
        },
      },
      message: {
        sessions(args) {
          requirePerm("bilibili", "bilibili.message.sessions");
          return biliInvoke("bilibili_message_sessions", args);
        },
        history(args) {
          requirePerm("bilibili", "bilibili.message.history");
          return biliInvoke("bilibili_message_history", args);
        },
        send(args) {
          requirePerm("bilibili", "bilibili.message.send");
          return biliInvoke("bilibili_message_send", args);
        },
        unread() {
          requirePerm("bilibili", "bilibili.message.unread");
          return biliInvoke("bilibili_message_unread");
        },
        replyFeed(args) {
          requirePerm("bilibili", "bilibili.message.replyFeed");
          return biliInvoke("bilibili_message_reply_feed", args);
        },
      },
      note: {},
      article: {},
    },
  };
}

function parseBiliError(error: unknown): Error {
  const raw = error instanceof Error ? error.message : String(error);
  try {
    const dto = JSON.parse(raw) as Partial<BiliErrorDto>;
    if (typeof dto.kind === "string" && typeof dto.message === "string") {
      return new BiliSdkError({
        kind: dto.kind as BiliErrorKind,
        message: dto.message,
        retryable: Boolean(dto.retryable),
        externalUrl: typeof dto.externalUrl === "string" ? dto.externalUrl : undefined,
      });
    }
  } catch {
    // Fall through to a plain API error.
  }
  return new BiliSdkError({ kind: "api", message: raw, retryable: false });
}

function coverKey(rawUrl: string): string {
  let hash = 2166136261;
  for (let index = 0; index < rawUrl.length; index += 1) {
    hash ^= rawUrl.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `c${(hash >>> 0).toString(16)}`;
}
