declare module "sdk" {
  export const apiVersion: number;
  export type LifecycleDispose = () => void | Promise<void>;
  export const Button: (props: any) => any;
  export const Dialog: (props: any) => any;
  export const Icon: (props: any) => any;
  export const Select: (props: any) => any;
  export const Slider: (props: any) => any;
  export const TextField: (props: any) => any;
  export const Toggle: (props: any) => any;

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
    constructor(dto: BiliErrorDto);
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

  export interface PluginSdk {
    apiVersion: number;
    log: (...args: unknown[]) => void;
    ui: {
      registerPage(page: { path: string; title: string; icon?: string; render: () => unknown }): void;
      registerSettingsSection(section: { id: string; title: string; render: () => unknown }): void;
      notify(message: string): void;
    };
    storage: {
      get(): Promise<unknown | null>;
      set(data: unknown): Promise<void>;
    };
    lifecycle: {
      onDispose(callback: LifecycleDispose): void;
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
        send(args: {
          aid: number;
          bvid: string;
          cid: number;
          message: string;
          progress: number;
        }): Promise<BiliOperationResult>;
      };
      comment: {
        list(args: { oid: number; page?: number; sort?: BiliCommentSort }): Promise<BiliCommentPage>;
        replies(args: { oid: number; root: number; page?: number }): Promise<BiliCommentPage>;
        add(args: { oid: number; message: string; root?: number; parent?: number }): Promise<BiliComment>;
        like(args: { oid: number; rpid: number; like: boolean }): Promise<BiliOperationResult>;
        dislike(args: { oid: number; rpid: number; dislike: boolean }): Promise<BiliOperationResult>;
        delete(args: { oid: number; rpid: number }): Promise<BiliOperationResult>;
        top(args: { oid: number; rpid: number; top: boolean }): Promise<BiliOperationResult>;
        report(args: {
          oid: number;
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
      dynamic: Record<string, never>;
      message: Record<string, never>;
      note: Record<string, never>;
      article: Record<string, never>;
    };
  }

  export function createElement(type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]): unknown;
  export const Fragment: symbol;
  export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
  export function useState<T>(initial: T | (() => T)): [T, (value: T | ((previous: T) => T)) => void];
  export function useCallback<T extends (...args: unknown[]) => unknown>(callback: T, deps: unknown[]): T;
  export function useRef<T>(initial: T): { current: T };

  const _default: {
    createElement: typeof createElement;
    Fragment: typeof Fragment;
    useEffect: typeof useEffect;
    useState: typeof useState;
    useCallback: typeof useCallback;
    useRef: typeof useRef;
  };
  export default _default;
}
