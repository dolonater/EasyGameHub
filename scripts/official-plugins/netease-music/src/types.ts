import type {
  Album,
  Artist,
  CaptchaSentResult,
  Lyrics,
  LoginQrCheckResult,
  LoginQrKeyResult,
  LoginInfo,
  PlaybackQuality,
  PlayMode,
  Playlist,
  PluginSdk,
  Song,
} from "sdk";

export type {
  Album,
  Artist,
  CaptchaSentResult,
  Lyrics,
  LoginInfo,
  LoginQrCheckResult,
  LoginQrKeyResult,
  PlaybackQuality,
  PlayMode,
  Playlist,
  PluginSdk,
  Song,
} from "sdk";

export interface LyricLine {
  time: number;
  text: string;
  translation?: string;
}

export type LyricFontSize = "compact" | "normal" | "large";
export type LyricStatus = "idle" | "loading" | "ready" | "empty" | "instrumental";

export interface LastPlaybackState {
  song: Song;
  currentTime: number;
  duration: number;
  updatedAt: number;
}

export interface CacheStats {
  coverCount: number;
  coverPendingCount: number;
  playlistCount: number;
  playlistTrackCount: number;
  persistedListCount: number;
  persistedCoverCount: number;
  persistedPlaylistCount: number;
  persistedPlaylistTrackCount: number;
}

export interface CachedValue<T> {
  value: T;
  loadedAt: number;
}

export interface PersistedPlaylistCacheEntry {
  playlist: Playlist;
  tracks: Song[];
  playlistOffset: number;
  hasMoreTracks: boolean;
  loadedAt: number;
}

export interface PersistedCoverCacheEntry {
  rawUrl: string;
  proxiedUrl: string;
  loadedAt: number;
}

export interface PersistentDataCache {
  schemaVersion: number;
  userId: string;
  userPlaylists: CachedValue<Playlist[]> | null;
  topPlaylists: CachedValue<Playlist[]> | null;
  discoverPlaylists: CachedValue<Playlist[]> | null;
  recommendSongs: CachedValue<Song[]> | null;
  coverEntries: PersistedCoverCacheEntry[];
  playlistEntries: PersistedPlaylistCacheEntry[];
}

export interface RuntimeConfig {
  volume: number;
  muted: boolean;
  playMode: PlayMode;
  quality: PlaybackQuality;
  recentSongs: Song[];
  searchHistory: string[];
  lyricFontSize: LyricFontSize;
  showLyricTranslation: boolean;
  showCoverBackground: boolean;
  keyboardShortcutsEnabled: boolean;
  lastPlayback: LastPlaybackState | null;
  dataCache: PersistentDataCache;
}

export interface PlayerState {
  currentSong: Song | null;
  currentCoverUrl: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  playMode: PlayMode;
  quality: PlaybackQuality;
  queue: Song[];
  currentIndex: number;
  loginInfo: LoginInfo | null;
  userPlaylists: Playlist[];
  topPlaylists: Playlist[];
  discoverPlaylists: Playlist[];
  activePlaylist: Playlist | null;
  activeTracks: Song[];
  searchResults: Song[];
  searchPlaylists: Playlist[];
  searchAlbums: Album[];
  searchArtists: Artist[];
  mediaDetailSongs: Song[];
  mediaDetailAlbums: Album[];
  mediaDetailArtists: Artist[];
  likedSongIds: string[];
  recommendSongs: Song[];
  recentSongs: Song[];
  searchHistory: string[];
  lyrics: LyricLine[];
  lyricStatus: LyricStatus;
  lyricFontSize: LyricFontSize;
  showLyricTranslation: boolean;
  showCoverBackground: boolean;
  keyboardShortcutsEnabled: boolean;
  lastPlayback: LastPlaybackState | null;
  trial: boolean;
  loading: string | null;
  error: string | null;
  view: "playlist" | "search" | "recommend" | "recent";
  playlistOffset: number;
  hasMoreTracks: boolean;
}

export type RuntimeListener = (state: PlayerState) => void;

export const DEFAULT_CONFIG: RuntimeConfig = {
  volume: 0.75,
  muted: false,
  playMode: "list",
  quality: "standard",
  recentSongs: [],
  searchHistory: [],
  lyricFontSize: "normal",
  showLyricTranslation: true,
  showCoverBackground: true,
  keyboardShortcutsEnabled: true,
  lastPlayback: null,
  dataCache: {
    schemaVersion: 1,
    userId: "",
    userPlaylists: null,
    topPlaylists: null,
    discoverPlaylists: null,
    recommendSongs: null,
    coverEntries: [],
    playlistEntries: [],
  },
};

export const EMPTY_LOGIN: LoginInfo = {
  provider: "netease",
  logged_in: false,
  user_id: "",
  nickname: "",
  avatar: "",
  vip_type: null,
  vip_level: null,
  is_vip: false,
  is_svip: false,
};
