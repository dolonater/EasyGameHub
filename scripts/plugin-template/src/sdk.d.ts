/// Minimal type declarations for the bare "sdk" specifier.
/// The real SDK module is bundled with the app (dist/plugin-sdk.js).
/// Plugins must import React from "sdk" (never from "react" directly).
declare module "sdk" {
  export const apiVersion: number;
  export type LifecycleDispose = () => void | Promise<void>;
  export type PlayMode = "list" | "shuffle" | "one";
  export type PlaybackQuality = "hires" | "lossless" | "exhigh" | "standard";

  export interface Artist {
    id: string;
    name: string;
    cover: string;
  }

  export interface Album {
    provider: string;
    id: string;
    name: string;
    artist: string;
    cover: string;
    song_count: number;
    publish_time?: number | null;
  }

  export interface Song {
    provider: string;
    id: string;
    name: string;
    artist: string;
    artists: Artist[];
    album: string;
    cover: string;
    duration: number;
    fee?: number | null;
    playable: boolean;
    language?: string | null;
  }

  export interface Playlist {
    provider: string;
    id: string;
    name: string;
    cover: string;
    track_count: number;
    creator: string;
    subscribed: boolean;
  }

  export interface SongUrlResult {
    url?: string | null;
    playable: boolean;
    trial: boolean;
    level?: string | null;
    quality?: string | null;
    br?: number | null;
    reason?: string | null;
    message?: string | null;
    fee?: number | null;
  }

  export interface LoginInfo {
    provider: string;
    logged_in: boolean;
    user_id: string;
    nickname: string;
    avatar: string;
    vip_type?: number | null;
    vip_level?: number | null;
    is_vip: boolean;
    is_svip: boolean;
  }

  export interface Lyrics {
    lyric: string;
    translation: string;
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

  export interface BiliDanmakuItem {
    id: string;
    time: number;
    text: string;
    color: string;
    mode: number;
    fontSize: number;
    timestamp: number;
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
  export function createElement(
    type: unknown,
    props?: Record<string, unknown> | null,
    ...children: unknown[]
  ): unknown;
  export const Fragment: symbol;
  export function useState<T>(initial: T): [T, (next: T | ((prev: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
  export function useRef<T>(initial: T): { current: T };
  export function useCallback<T extends (...args: never[]) => unknown>(fn: T, deps?: unknown[]): T;
  export function useContext<T>(ctx: unknown): T;

  export const Button: unknown;
  export const Dialog: unknown;
  export const Icon: unknown;
  export const Select: unknown;
  export const Slider: unknown;
  export const TextField: unknown;
  export const Toggle: unknown;

  export interface PluginSdk {
    apiVersion: number;
    log: (...args: unknown[]) => void;
    ui: {
      registerPage(page: { path: string; title: string; icon?: string; render: () => unknown }): void;
      registerSettingsSection(section: { id: string; title: string; render: () => unknown }): void;
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
    };
    bilibili: {
      account: {};
      home: {};
      video: {
        openExternal(bvid: string): Promise<BiliOperationResult>;
      };
      playback: {
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
          oid: number;
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
      dynamic: {
        all(args: { offset?: string; hostMid?: number }): Promise<BiliDynamicPage>;
        detail(args: { dynId: string }): Promise<BiliDynamicCard>;
        like(args: { dynId: string; like: boolean }): Promise<BiliOperationResult>;
        createText(args: { content: string }): Promise<BiliDynamicCreated>;
        top(args: { dynId: string; top: boolean }): Promise<BiliOperationResult>;
        forwards(args: { dynId: string; offset?: string }): Promise<BiliDynamicForwardsPage>;
      };
      message: {
      sessions(args: { cursor?: string }): Promise<BiliMessageSessionsPage>;
      history(args: { talkerUid: number; cursor?: number }): Promise<BiliMessageHistoryPage>;
      send(args: { uid: number; content: string }): Promise<BiliOperationResult>;
      unread(): Promise<BiliMessageUnread>;
      replyFeed(args: { startId?: number; startTime?: number }): Promise<BiliReplyFeedPage>;
    };
      note: Record<string, never>;
      article: Record<string, never>;
    };
  }

  const _default: {
    createElement: typeof createElement;
    Fragment: typeof Fragment;
    useState: typeof useState;
    useEffect: typeof useEffect;
    useRef: typeof useRef;
    useCallback: typeof useCallback;
  };
  export default _default;
}
