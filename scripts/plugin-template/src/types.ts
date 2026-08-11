/// The permission-gated SDK instance handed to setup(ctx) by the loader.
/// Mirrors src/plugins/sdk.ts PluginSdk in the main app.
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
  };
}

export interface GameInfo {
  id: string;
  name: string;
  save_path: string;
  backup_dir: string;
  steam_app_id: number | null;
  is_custom: boolean;
  last_backup: string | null;
  snapshot_count: number;
  status: "active" | "inactive" | "unavailable";
  pinned: boolean;
  auto_backup: boolean;
}

export interface SnapshotInfo {
  game_name: string;
  path: string;
  timestamp: string;
  note: string;
  size_bytes: number;
}
