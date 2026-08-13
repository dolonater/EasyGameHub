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

  export interface BiliLiveQuality {
    qn: number;
    desc: string;
  }

  export interface BiliLiveStreamUrl {
    url: string;
    order: number;
  }

  export interface BiliLiveStream {
    currentQuality: number;
    currentQn: number;
    qualityDescription: BiliLiveQuality[];
    durl: BiliLiveStreamUrl[];
  }

  export interface BiliLiveRoom {
    roomId: number;
    uid: number;
    title: string;
    cover: string;
    liveStatus: number;
    online: number;
    areaName: string;
    parentAreaName: string;
    description: string;
    tags: string;
    liveTime: string;
    attention: number;
  }

  export interface BiliLiveRecommendRoom {
    roomId: number;
    uid: number;
    title: string;
    cover: string;
    uname: string;
    face: string;
    online: number;
    areaName: string;
    areaParentName: string;
    status: boolean;
    followers: number;
  }

  export interface BiliLiveRecommendPage {
    rooms: BiliLiveRecommendRoom[];
    topRoomId: number;
  }
  export interface BiliLiveRoomPage {
    rooms: BiliLiveRecommendRoom[];
    count: number;
    hasMore: boolean;
  }

  export interface BiliLiveSubArea {
    id: number;
    name: string;
    pic: string;
  }

  export interface BiliLiveArea {
    id: number;
    name: string;
    children: BiliLiveSubArea[];
  }

  export interface BiliLiveSendDanmakuResult {
    ok: boolean;
    message: string;
  }
  export interface BiliArticleAuthor {
    mid: number;
    name: string;
    face: string;
  }
  export interface BiliArticleStats {
    view: number;
    like: number;
    coin: number;
    favorite: number;
    reply: number;
  }
  export interface BiliArticleView {
    id: number;
    title: string;
    summary: string;
    contentType: "json" | "html";
    content: string;
    pubTime: number;
    words: number;
    author: BiliArticleAuthor;
    stats: BiliArticleStats;
    isLiked: boolean;
    tags: string[];
  }
  export interface BiliArticleCard {
    id: number;
    title: string;
    summary: string;
    bannerUrl: string;
    imageUrls: string[];
    pubTime: number;
    words: number;
    viewCount: number;
    likeCount: number;
  }
  export interface BiliArticleListPage {
    articles: BiliArticleCard[];
    total: number;
  }
  export interface BiliArticleSearchItem {
    id: number;
    title: string;
    desc: string;
    imageUrls: string[];
    pubTime: number;
    like: number;
    reply: number;
    mid: number;
    categoryName: string;
  }
  export interface BiliArticleSearchPage {
    items: BiliArticleSearchItem[];
    hasMore: boolean;
  }
  export interface BiliNoteItem {
    cvid: number;
    noteId: number;
    title: string;
    summary: string;
    pubTime: string;
    authorName: string;
    authorFace: string;
    likes: number;
    hasLike: boolean;
    isPrivate: boolean;
  }
  export interface BiliNoteListPage {
    notes: BiliNoteItem[];
    hasMore: boolean;
  }
  export interface BiliNoteDetail {
    cvid: number;
    noteId: number;
    title: string;
    summary: string;
    content: string;
    pubTime: string;
    authorName: string;
    authorFace: string;
    likes: number;
    isPrivate: boolean;
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
    articleId: number;
    title: string;
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


  export interface BiliPgcCondition {
    filters: BiliPgcFilter[];
  }
  
  export interface BiliPgcFilter {
    field: string;
    name: string;
    values: BiliPgcFilterValue[];
  }
  
  export interface BiliPgcFilterValue {
    keyword: string;
    name: string;
  }
  export interface BiliPgcIndexPage {
    items: BiliPgcCard[];
    hasMore: boolean;
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
  manifest: string;
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

  export interface BiliMessageItem {
    msgId: number;
    senderUid: number;
    content: string;
    timestamp: number;
    msgType: number;
  }

  export interface BiliMessageSession {
    talkerId: number;
    unreadCount: number;
    lastMsg: BiliMessageItem | null;
    name: string;
    face: string;
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
    cursorId: number | null;
    isEnd: boolean;
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

  export interface BiliFavoritePage {
    items: BiliFavoriteItem[];
    hasMore: boolean;
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
    articleId: number;
    title: string;
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
        createPlayback(args: {
          bvid?: string;
          aid?: number;
          cid: number;
          quality?: number;
          preferProgressive?: boolean;
          codecPreference?: "avc" | "hevc" | "av1";
          audioPreference?: "standard" | "flac";
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
        favoriteItems(mediaId: number, page?: number): Promise<BiliFavoritePage>;
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
        pgcIndex(args: { seasonType: number; order?: number; isFinish?: number; page?: number }): Promise<BiliPgcIndexPage>;
        pgcRank(args: { seasonType: number }): Promise<BiliPgcCard[]>;
        followList(args: { page?: number; cinema?: boolean }): Promise<BiliBangumiFollow[]>;
      };
      live: {
        room(args: { roomId: number }): Promise<BiliLiveRoom>;
        stream(args: { roomId: number; qn?: number }): Promise<BiliLiveStream>;
        recommend(args: { page?: number }): Promise<BiliLiveRecommendPage>;
        areas(): Promise<BiliLiveArea[]>;
        rooms(args: { parentAreaId: number; areaId?: number; page?: number }): Promise<BiliLiveRoomPage>;
        sendDanmaku(args: { roomId: number; text: string }): Promise<BiliLiveSendDanmakuResult>;
        heartbeat(args: { roomId: number }): Promise<BiliOperationResult>;
        danmakuWsUrl(args: { roomId: number }): Promise<string>;
      };
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
      note: {
        list(args: { aid: number }): Promise<BiliNoteListPage>;
        detail(args: { cvid?: number; noteId?: number; aid?: number }): Promise<BiliNoteDetail>;
      };
      article: {
        view(args: { articleId: number }): Promise<BiliArticleView>;
        like(args: { articleId: number; like: boolean }): Promise<BiliOperationResult>;
        coin(args: { articleId: number; upid: number }): Promise<BiliOperationResult>;
        list(args: { mid: number; page?: number }): Promise<BiliArticleListPage>;
        search(args: { keyword: string; page?: number }): Promise<BiliArticleSearchPage>;
      };
    };
  }

  export function createElement(type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]): unknown;
  export function createPortal(children: unknown, container: unknown): unknown;
  export const Fragment: symbol;
  export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
  export function useState<T>(initial: T | (() => T)): [T, (value: T | ((previous: T) => T)) => void];
  export function useCallback<F extends (...args: any[]) => any>(callback: F, deps: unknown[]): F;
  export function useRef<T>(initial: T): { current: T };
  export namespace React {
    type ReactNode = any;
    type ChangeEvent<T = any> = { target: T };
    type FormEvent<T = any> = { target: T };
  }

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

declare namespace JSX {
  interface IntrinsicElements {
    [elem: string]: any;
  }
  interface LibraryManagedAttributes<C, P> {
    [name: string]: any;
  }
}
