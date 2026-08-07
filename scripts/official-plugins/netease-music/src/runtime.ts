import { parseLrc } from "./lyrics";
import {
  DEFAULT_CONFIG,
  EMPTY_LOGIN,
  type Album,
  type Artist,
  type CacheStats,
  type CachedValue,
  type LastPlaybackState,
  type PlaybackQuality,
  type PlayMode,
  type LoginInfo,
  type LoginQrCheckResult,
  type LoginQrKeyResult,
  type CaptchaSentResult,
  type PersistedCoverCacheEntry,
  type PersistedPlaylistCacheEntry,
  type PersistentDataCache,
  type PlayerState,
  type PluginSdk,
  type Playlist,
  type RuntimeConfig,
  type RuntimeListener,
  type Song,
} from "./types";

const INITIAL_STATE: PlayerState = {
  currentSong: null,
  currentCoverUrl: "",
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: DEFAULT_CONFIG.volume,
  muted: DEFAULT_CONFIG.muted,
  playMode: DEFAULT_CONFIG.playMode,
  quality: DEFAULT_CONFIG.quality,
  queue: [],
  currentIndex: -1,
  loginInfo: EMPTY_LOGIN,
  userPlaylists: [],
  topPlaylists: [],
  discoverPlaylists: [],
  activePlaylist: null,
  activeTracks: [],
  searchResults: [],
  searchPlaylists: [],
  searchAlbums: [],
  searchArtists: [],
  mediaDetailSongs: [],
  mediaDetailAlbums: [],
  mediaDetailArtists: [],
  likedSongIds: [],
  recommendSongs: [],
  recentSongs: DEFAULT_CONFIG.recentSongs,
  searchHistory: DEFAULT_CONFIG.searchHistory,
  lyrics: [],
  lyricStatus: "idle",
  lyricFontSize: DEFAULT_CONFIG.lyricFontSize,
  showLyricTranslation: DEFAULT_CONFIG.showLyricTranslation,
  showCoverBackground: DEFAULT_CONFIG.showCoverBackground,
  keyboardShortcutsEnabled: DEFAULT_CONFIG.keyboardShortcutsEnabled,
  lastPlayback: DEFAULT_CONFIG.lastPlayback,
  trial: false,
  loading: null,
  error: null,
  view: "playlist",
  playlistOffset: 0,
  hasMoreTracks: false,
};

const PLAYLIST_CACHE_TTL_MS = 5 * 60 * 1000;
const LIST_CACHE_TTL_MS = 10 * 60 * 1000;
const RECOMMEND_CACHE_TTL_MS = 30 * 60 * 1000;
const COVER_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PLAYLIST_CACHE_SIZE = 24;
const MAX_COVER_CACHE_SIZE = 500;
const MAX_PERSISTED_PLAYLIST_TRACKS = 150;
const PLAYLIST_TRACK_PAGE_SIZE = 50;
const CONFIG_SAVE_DEBOUNCE_MS = 1200;
const MAX_ACTIVE_COVER_REQUESTS = 6;
const PLAYBACK_SAVE_INTERVAL_MS = 5000;
const DATA_CACHE_SCHEMA_VERSION = 1;
const NOTIFY_DEDUPE_MS = 1600;
const DISCOVER_PLAYLIST_KEYWORDS = ["华语", "流行", "治愈", "摇滚", "电子", "民谣", "古风", "ACG", "学习", "夜晚", "开车", "轻音乐"];
const DISCOVER_PLAYLIST_MODIFIERS = ["精选", "宝藏", "热门", "新歌", "私人", "循环", "放松", "经典"];

interface PlaylistCacheEntry {
  playlist: Playlist;
  tracks: Song[];
  playlistOffset: number;
  hasMoreTracks: boolean;
  loadedAt: number;
}

class MusicRuntime {
  private sdk: PluginSdk | null = null;
  private state: PlayerState = { ...INITIAL_STATE };
  private listeners = new Set<RuntimeListener>();
  private audio = new Audio();
  private audioBound = false;
  private loginPollTimer: number | null = null;
  private requestSeq = 0;
  private playlistRequestSeq = 0;
  private consecutiveSkips = 0;
  private coverCache = new Map<string, string>();
  private coverRequestCache = new Map<string, Promise<string>>();
  private coverQueue: Array<{ rawUrl: string; resolve: (value: string) => void; reject: (error: unknown) => void }> = [];
  private activeCoverRequests = 0;
  private playlistCache = new Map<string, PlaylistCacheEntry>();
  private dataCache: PersistentDataCache = createEmptyDataCache();
  private lastPlaybackSaveAt = 0;
  private tracksLoadingMore = false;
  private configSaveTimer: number | null = null;
  private lastNotifyMessage = "";
  private lastNotifyAt = 0;
  private discoverShuffleIndex = 0;

  init(sdk: PluginSdk): void {
    this.sdk = sdk;
    this.bindAudio();
    void this.loadConfig().finally(() => {
      void this.refreshLoginStatus();
    });
  }

  subscribe(listener: RuntimeListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  getState(): PlayerState {
    return {
      ...this.state,
      queue: [...this.state.queue],
      userPlaylists: [...this.state.userPlaylists],
      topPlaylists: [...this.state.topPlaylists],
      discoverPlaylists: [...this.state.discoverPlaylists],
      activeTracks: [...this.state.activeTracks],
      searchResults: [...this.state.searchResults],
      searchPlaylists: [...this.state.searchPlaylists],
      searchAlbums: [...this.state.searchAlbums],
      searchArtists: [...this.state.searchArtists],
      mediaDetailSongs: [...this.state.mediaDetailSongs],
      mediaDetailAlbums: [...this.state.mediaDetailAlbums],
      mediaDetailArtists: [...this.state.mediaDetailArtists],
      likedSongIds: [...this.state.likedSongIds],
      recommendSongs: [...this.state.recommendSongs],
      recentSongs: [...this.state.recentSongs],
      searchHistory: [...this.state.searchHistory],
      lyrics: [...this.state.lyrics],
    };
  }

  setState(patch: Partial<PlayerState>): void {
    this.state = { ...this.state, ...patch };
    const snapshot = this.getState();
    for (const listener of this.listeners) listener(snapshot);
  }

  async openLoginWindow(): Promise<void> {
    const sdk = this.requireSdk();
    this.setState({ loading: "login", error: null });
    try {
      await sdk.music.openLoginWindow();
      this.startLoginPolling();
    } catch (error) {
      this.setError(error);
    } finally {
      this.setState({ loading: null });
    }
  }

  async createQrLogin(): Promise<LoginQrKeyResult> {
    const sdk = this.requireSdk();
    this.setState({ loading: "login", error: null });
    try {
      return await sdk.music.loginQrKey();
    } catch (error) {
      const message = this.errorMessage(error);
      this.setState({ error: message });
      this.notify(message);
      throw new Error(message);
    } finally {
      this.setState({ loading: null });
    }
  }

  async checkQrLogin(key: string): Promise<LoginQrCheckResult> {
    const sdk = this.requireSdk();
    try {
      const result = await sdk.music.loginQrCheck(key);
      if (result.logged_in) {
        await this.refreshLoginStatus();
      }
      return result;
    } catch (error) {
      const message = this.errorMessage(error);
      this.setState({ error: message });
      this.notify(message);
      throw new Error(message);
    }
  }

  async sendLoginCaptcha(phone: string, countrycode?: string): Promise<CaptchaSentResult> {
    const sdk = this.requireSdk();
    try {
      return await sdk.music.sendLoginCaptcha(phone, countrycode);
    } catch (error) {
      const message = this.errorMessage(error);
      this.setState({ error: message });
      this.notify(message);
      throw new Error(message);
    }
  }

  async loginWithCellphone(phone: string, captcha: string, countrycode?: string): Promise<LoginInfo> {
    const sdk = this.requireSdk();
    this.setState({ loading: "login", error: null });
    try {
      const loginInfo = await sdk.music.loginCellphone(phone, captcha, countrycode);
      await this.refreshLoginStatus();
      return loginInfo;
    } catch (error) {
      const message = this.errorMessage(error);
      this.setState({ error: message });
      this.notify(message);
      throw new Error(message);
    } finally {
      this.setState({ loading: null });
    }
  }

  async logout(): Promise<void> {
    const sdk = this.requireSdk();
    this.stopLoginPolling();
    this.stopAudio();
    await sdk.music.logout();
    this.setState({
      loginInfo: EMPTY_LOGIN,
      userPlaylists: [],
      topPlaylists: [],
      discoverPlaylists: [],
      activePlaylist: null,
      activeTracks: [],
      searchResults: [],
      searchPlaylists: [],
      searchAlbums: [],
      searchArtists: [],
      mediaDetailSongs: [],
      mediaDetailAlbums: [],
      mediaDetailArtists: [],
      likedSongIds: [],
      recommendSongs: [],
      queue: [],
      currentIndex: -1,
      currentSong: null,
      currentCoverUrl: "",
      lyrics: [],
      lyricStatus: "idle",
      trial: false,
      lastPlayback: null,
      error: null,
    });
    this.playlistCache.clear();
    this.dataCache = createEmptyDataCache();
    void this.saveConfig();
  }

  async refreshLoginStatus(): Promise<void> {
    const sdk = this.requireSdk();
    try {
      const loginInfo = await sdk.music.loginStatus();
      this.setState({ loginInfo, error: null });
      if (loginInfo.logged_in) {
        this.stopLoginPolling();
        this.applyDataCacheForUser(loginInfo.user_id || "");
        await Promise.all([
          this.loadUserPlaylists(),
          this.loadLikedList(),
          this.loadRecommendSongs(),
          this.loadTopPlaylists(),
          this.loadDiscoverPlaylists(),
        ]);
      }
    } catch (error) {
      this.setError(error);
    }
  }

  async loadUserPlaylists(force = false): Promise<void> {
    const sdk = this.requireSdk();
    if (!this.state.loginInfo?.logged_in) return;
    const cached = this.dataCache.userPlaylists;
    const hasCached = this.applyCachedList("userPlaylists", cached);
    const stale = !cached || Date.now() - cached.loadedAt > LIST_CACHE_TTL_MS;
    if (hasCached && !force && !stale) return;
    if (!hasCached || force) this.setState({ loading: "playlists", error: null });
    try {
      const userPlaylists = await sdk.music.userPlaylists();
      this.setState({ userPlaylists });
      this.rememberCachedList("userPlaylists", userPlaylists);
    } catch (error) {
      if (!hasCached) this.setError(error);
      else this.notify("歌单刷新失败，已显示缓存数据");
    } finally {
      if (!hasCached || force) this.setState({ loading: null });
    }
  }

  async loadTopPlaylists(force = false): Promise<void> {
    const sdk = this.requireSdk();
    const cached = this.dataCache.topPlaylists;
    const hasCached = this.applyCachedList("topPlaylists", cached);
    const stale = !cached || Date.now() - cached.loadedAt > LIST_CACHE_TTL_MS;
    if (hasCached && !force && !stale) return;
    if (!hasCached || force) this.setState({ loading: "toplists", error: null });
    try {
      const topPlaylists = await sdk.music.topPlaylists();
      this.setState({ topPlaylists });
      this.rememberCachedList("topPlaylists", topPlaylists);
    } catch (error) {
      if (!hasCached) this.setError(error);
      else this.notify("榜单刷新失败，已显示缓存数据");
    } finally {
      if (!hasCached || force) this.setState({ loading: null });
    }
  }

  async loadDiscoverPlaylists(force = false): Promise<void> {
    const sdk = this.requireSdk();
    const cached = this.dataCache.discoverPlaylists;
    const hasCached = this.applyCachedList("discoverPlaylists", cached);
    const stale = !cached || Date.now() - cached.loadedAt > LIST_CACHE_TTL_MS;
    if (hasCached && !force && !stale) return;
    if (!hasCached || force) this.setState({ loading: "discover-playlists", error: null });
    try {
      const discoverPlaylists = await sdk.music.personalizedPlaylists();
      this.setState({ discoverPlaylists });
      this.rememberCachedList("discoverPlaylists", discoverPlaylists);
    } catch (error) {
      if (!hasCached) this.setError(error);
      else this.notify("发现歌单刷新失败，已显示缓存数据");
    } finally {
      if (!hasCached || force) this.setState({ loading: null });
    }
  }

  async searchDiscoverPlaylists(keywords: string, force = false): Promise<void> {
    const sdk = this.requireSdk();
    const query = keywords.trim();
    if (!query) {
      await this.loadDiscoverPlaylists(force);
      return;
    }
    this.setState({ loading: "playlist-search", error: null });
    try {
      const discoverPlaylists = await sdk.music.searchPlaylists(query, 30);
      this.setState({ discoverPlaylists });
    } catch (error) {
      this.setError(error);
    } finally {
      this.setState({ loading: null });
    }
  }

  async shuffleDiscoverPlaylists(keywords = ""): Promise<void> {
    const sdk = this.requireSdk();
    const query = keywords.trim();
    const currentIds = new Set(this.state.discoverPlaylists.map((playlist) => playlist.id));
    const seed = query
      ? `${query} ${DISCOVER_PLAYLIST_MODIFIERS[this.discoverShuffleIndex % DISCOVER_PLAYLIST_MODIFIERS.length]}`
      : DISCOVER_PLAYLIST_KEYWORDS[this.discoverShuffleIndex % DISCOVER_PLAYLIST_KEYWORDS.length];
    this.discoverShuffleIndex += 1;

    this.setState({ loading: "playlist-search", error: null });
    try {
      const primary = await sdk.music.searchPlaylists(seed, 50);
      const fallback = primary.length || !query ? [] : await sdk.music.searchPlaylists(query, 50);
      const merged = uniquePlaylists([...primary, ...fallback]);
      const fresh = merged.filter((playlist) => !currentIds.has(playlist.id));
      const discoverPlaylists = (fresh.length >= 6 ? fresh : rotatePlaylists(merged, this.discoverShuffleIndex * 7)).slice(0, 30);

      if (!discoverPlaylists.length) {
        this.notify("暂时没有换到新的歌单");
        return;
      }

      this.setState({ discoverPlaylists });
      if (!query) this.rememberCachedList("discoverPlaylists", discoverPlaylists);
    } catch (error) {
      this.setError(error);
    } finally {
      this.setState({ loading: null });
    }
  }

  async loadLikedList(): Promise<void> {
    const sdk = this.requireSdk();
    if (!this.state.loginInfo?.logged_in) return;
    this.setState({ loading: "liked", error: null });
    try {
      const likedSongIds = await sdk.music.likedList();
      this.setState({ likedSongIds });
    } catch (error) {
      this.setError(error);
    } finally {
      this.setState({ loading: null });
    }
  }

  async toggleLike(songId: string): Promise<void> {
    const sdk = this.requireSdk();
    if (!this.state.loginInfo?.logged_in) {
      this.notify("请先登录网易云账号");
      return;
    }
    const previous = this.state.likedSongIds;
    const liked = previous.includes(songId);
    const likedSongIds = liked ? previous.filter((id) => id !== songId) : [...previous, songId];
    this.setState({ likedSongIds });
    try {
      await sdk.music.likeSong(songId, !liked);
      this.notify(liked ? "已取消喜欢" : "已添加到喜欢");
    } catch (error) {
      this.setState({ likedSongIds: previous });
      this.setError(error);
    }
  }

  async togglePlaylistSubscribe(playlist: Playlist): Promise<void> {
    const sdk = this.requireSdk();
    if (!this.state.loginInfo?.logged_in) {
      this.notify("请先登录网易云账号");
      return;
    }

    const previousPlaylists = this.state.userPlaylists;
    const previousTopPlaylists = this.state.topPlaylists;
    const previousDiscoverPlaylists = this.state.discoverPlaylists;
    const previousActive = this.state.activePlaylist;
    const subscribe = !playlist.subscribed;
    const updatePlaylist = (item: Playlist): Playlist =>
      item.id === playlist.id ? { ...item, subscribed: subscribe } : item;

    this.setState({
      userPlaylists: previousPlaylists.map(updatePlaylist),
      topPlaylists: previousTopPlaylists.map(updatePlaylist),
      discoverPlaylists: previousDiscoverPlaylists.map(updatePlaylist),
      activePlaylist: previousActive?.id === playlist.id ? updatePlaylist(previousActive) : previousActive,
    });

    try {
      await sdk.music.subscribePlaylist(playlist.id, subscribe);
      this.notify(subscribe ? "已收藏歌单" : "已取消收藏歌单");
      await this.loadUserPlaylists();
    } catch (error) {
      this.setState({
        userPlaylists: previousPlaylists,
        topPlaylists: previousTopPlaylists,
        discoverPlaylists: previousDiscoverPlaylists,
        activePlaylist: previousActive,
      });
      this.setError(error);
    }
  }

  async loadRecommendSongs(force = false): Promise<void> {
    const sdk = this.requireSdk();
    if (!this.state.loginInfo?.logged_in) return;
    const cached = this.dataCache.recommendSongs;
    const hasCached = this.applyCachedList("recommendSongs", cached);
    const stale = !cached || Date.now() - cached.loadedAt > RECOMMEND_CACHE_TTL_MS;
    if (hasCached && !force && !stale) return;
    if (!hasCached || force) this.setState({ loading: "recommend", error: null });
    try {
      const recommendSongs = await sdk.music.recommendSongs();
      this.setState({ recommendSongs });
      this.rememberCachedList("recommendSongs", recommendSongs);
    } catch (error) {
      if (!hasCached) this.setError(error);
      else this.notify("每日推荐刷新失败，已显示缓存数据");
    } finally {
      if (!hasCached || force) this.setState({ loading: null });
    }
  }

  showQueue(): void {
    this.setState({ view: "playlist" });
  }

  showRecommendations(): void {
    this.setState({ view: "recommend" });
    if (!this.state.recommendSongs.length) {
      void this.loadRecommendSongs();
    }
  }

  showRecentSongs(): void {
    this.setState({ view: "recent" });
  }

  async loadPlaylist(target: string | Playlist): Promise<void> {
    const sdk = this.requireSdk();
    const id = typeof target === "string" ? target : target.id;
    const playlistHint = typeof target === "string" ? null : target;
    const request = ++this.playlistRequestSeq;
    const cached = this.playlistCache.get(id);
    const stale = cached ? Date.now() - cached.loadedAt > PLAYLIST_CACHE_TTL_MS : true;

    if (cached) {
      this.applyPlaylistCache(cached);
      this.setState({ error: null, view: "playlist" });
      if (!stale) return;
    } else {
      this.setState({
        activePlaylist: playlistHint,
        activeTracks: [],
        playlistOffset: 0,
        hasMoreTracks: false,
        loading: "playlist",
        error: null,
        view: "playlist",
      });
    }

    try {
      const [activePlaylist, activeTracks] = playlistHint
        ? [playlistHint, await sdk.music.playlistTracksRange(id, 0, PLAYLIST_TRACK_PAGE_SIZE)] as [Playlist, Song[]]
        : await sdk.music.playlistTracks(id);
      if (request !== this.playlistRequestSeq) return;
      const entry = this.rememberPlaylist(activePlaylist, activeTracks, activeTracks.length < activePlaylist.track_count);
      this.setState({
        activePlaylist: entry.playlist,
        activeTracks: [...entry.tracks],
        playlistOffset: entry.playlistOffset,
        hasMoreTracks: entry.hasMoreTracks,
      });
    } catch (error) {
      if (!cached) this.setError(error);
      else this.notify("歌单刷新失败，已显示缓存数据");
    } finally {
      if (request === this.playlistRequestSeq && !cached) this.setState({ loading: null });
    }
  }

  async loadMoreTracks(): Promise<void> {
    const sdk = this.requireSdk();
    const playlist = this.state.activePlaylist;
    if (!playlist || !this.state.hasMoreTracks || this.tracksLoadingMore) return;
    const playlistId = playlist.id;
    const start = this.state.activeTracks.length;
    const previousTracks = this.state.activeTracks;
    const shouldSyncQueue =
      this.state.queue.length === previousTracks.length &&
      previousTracks.every((song, index) => this.state.queue[index]?.id === song.id);
    this.tracksLoadingMore = true;
    this.setState({ loading: "tracks", error: null });
    try {
      const tracks = await sdk.music.playlistTracksRange(playlist.id, start, PLAYLIST_TRACK_PAGE_SIZE);
      if (this.state.activePlaylist?.id !== playlistId) return;
      const currentPlaylist = this.state.activePlaylist;
      if (!currentPlaylist || currentPlaylist.id !== playlistId) return;
      const activeTracks = [...this.state.activeTracks, ...tracks];
      const hasMoreTracks = activeTracks.length < currentPlaylist.track_count && tracks.length > 0;
      this.setState({
        activeTracks,
        ...(shouldSyncQueue ? { queue: activeTracks } : {}),
        playlistOffset: activeTracks.length,
        hasMoreTracks,
      });
      this.rememberPlaylist(currentPlaylist, activeTracks, hasMoreTracks);
    } catch (error) {
      this.setError(error);
    } finally {
      this.tracksLoadingMore = false;
      if (this.state.activePlaylist?.id === playlistId && this.state.loading === "tracks") this.setState({ loading: null });
    }
  }

  async search(keywords: string): Promise<void> {
    const query = keywords.trim();
    if (!query) {
      this.setState({
        searchResults: [],
        searchPlaylists: [],
        searchAlbums: [],
        searchArtists: [],
        mediaDetailSongs: [],
        mediaDetailAlbums: [],
        mediaDetailArtists: [],
        view: "playlist",
      });
      return;
    }
    const sdk = this.requireSdk();
    this.setState({ loading: "search", error: null, view: "search", mediaDetailSongs: [] });
    try {
      const [searchResults, searchPlaylists, searchAlbums, searchArtists] = await Promise.all([
        sdk.music.search(query, 30),
        sdk.music.searchPlaylists(query, 20).catch(() => []),
        sdk.music.searchAlbums(query, 20).catch(() => []),
        sdk.music.searchArtists(query, 20).catch(() => []),
      ]);
      this.rememberSearchKeyword(query);
      this.setState({ searchResults, searchPlaylists, searchAlbums, searchArtists });
    } catch (error) {
      this.setError(error);
    } finally {
      this.setState({ loading: null });
    }
  }

  async findArtistByName(name: string): Promise<Artist | null> {
    const query = name.trim();
    if (!query) return null;
    const sdk = this.requireSdk();
    const artists = await sdk.music.searchArtists(query, 8).catch(() => []);
    const normalizedQuery = normalizeMediaName(query);
    return artists.find((artist) => normalizeMediaName(artist.name) === normalizedQuery) ?? artists[0] ?? null;
  }

  async findAlbumByName(name: string, artistName = ""): Promise<Album | null> {
    const query = name.trim();
    if (!query) return null;
    const sdk = this.requireSdk();
    const albums = await sdk.music.searchAlbums(query, 8).catch(() => []);
    const normalizedQuery = normalizeMediaName(query);
    const normalizedArtist = normalizeMediaName(artistName);
    const sameName = albums.filter((album) => normalizeMediaName(album.name) === normalizedQuery);
    const sameArtist = sameName.find((album) => {
      if (!normalizedArtist) return true;
      const albumArtist = normalizeMediaName(album.artist);
      return albumArtist.includes(normalizedArtist) || normalizedArtist.includes(albumArtist);
    });
    return sameArtist ?? sameName[0] ?? albums[0] ?? null;
  }

  async playSong(song: Song, queue?: Song[]): Promise<void> {
    const nextQueue = queue?.length ? queue : this.state.queue.length ? this.state.queue : [song];
    const index = Math.max(0, nextQueue.findIndex((item) => item.id === song.id));
    await this.startSong(song, nextQueue, index, false);
  }

  async playNext(song: Song): Promise<void> {
    const queue = this.state.queue.length ? [...this.state.queue] : this.state.currentSong ? [this.state.currentSong] : [];
    const insertAt = Math.max(0, this.state.currentIndex) + 1;
    const existingIndex = queue.findIndex((item) => item.id === song.id);
    if (existingIndex >= 0) queue.splice(existingIndex, 1);
    queue.splice(Math.min(insertAt, queue.length), 0, song);
    this.setState({ queue });
    this.notify("已添加到下一首播放");
  }

  addSongsToQueue(songs: Song[]): void {
    const nextSongs = songs.filter((song) => song.playable !== false);
    if (!nextSongs.length) return;
    const queue = this.state.queue.length ? [...this.state.queue] : this.state.currentSong ? [this.state.currentSong] : [];
    const existingIds = new Set(queue.map((song) => song.id));
    const additions = nextSongs.filter((song) => !existingIds.has(song.id));
    if (!additions.length) {
      this.notify("这些歌曲已在队列中");
      return;
    }
    this.setState({
      queue: [...queue, ...additions],
      currentIndex: this.state.currentIndex >= 0 ? this.state.currentIndex : queue.length ? 0 : -1,
    });
    this.notify("已加入播放队列");
  }

  removeFromQueue(songId: string): void {
    const index = this.state.queue.findIndex((item) => item.id === songId);
    if (index < 0) return;
    const queue = this.state.queue.filter((item) => item.id !== songId);
    let currentIndex = this.state.currentIndex;
    if (index < currentIndex) currentIndex -= 1;
    if (this.state.currentSong?.id === songId) {
      this.stopAudio();
      this.setState({ queue, currentIndex: -1, currentSong: null, currentCoverUrl: "", lyrics: [], lyricStatus: "idle", trial: false });
      return;
    }
    this.setState({ queue, currentIndex });
  }

  clearQueue(): void {
    const currentSong = this.state.currentSong;
    this.setState({
      queue: currentSong ? [currentSong] : [],
      currentIndex: currentSong ? 0 : -1,
    });
  }

  clearSearchHistory(): void {
    if (!this.state.searchHistory.length) return;
    this.setState({ searchHistory: [] });
    void this.saveConfig();
  }

  async loadAlbumSongs(album: Album): Promise<void> {
    const sdk = this.requireSdk();
    this.setState({ loading: "album", error: null, view: "search", mediaDetailSongs: [], mediaDetailArtists: [] });
    try {
      const [mediaDetailSongs, mediaDetailArtists] = await Promise.all([
        sdk.music.albumSongs(album.id),
        album.artist ? sdk.music.searchArtists(album.artist, 6).catch(() => []) : Promise.resolve([]),
      ]);
      this.setState({ mediaDetailSongs, mediaDetailArtists });
    } catch (error) {
      this.setError(error);
    } finally {
      this.setState({ loading: null });
    }
  }

  async loadArtistSongs(artist: Artist): Promise<void> {
    const sdk = this.requireSdk();
    this.setState({ loading: "artist", error: null, view: "search", mediaDetailSongs: [], mediaDetailAlbums: [] });
    try {
      const [mediaDetailSongs, mediaDetailAlbums] = await Promise.all([
        sdk.music.artistSongs(artist.id),
        sdk.music.searchAlbums(artist.name, 12).catch(() => []),
      ]);
      this.setState({ mediaDetailSongs, mediaDetailAlbums });
    } catch (error) {
      this.setError(error);
    } finally {
      this.setState({ loading: null });
    }
  }

  async togglePlay(): Promise<void> {
    if (this.audio.paused) {
      if (!this.audio.src && this.state.currentSong && this.state.currentIndex >= 0) {
        await this.startSong(this.state.currentSong, this.state.queue, this.state.currentIndex, false, this.state.currentTime);
        return;
      }
      try {
        await this.audio.play();
        this.setState({ isPlaying: true });
      } catch (error) {
        const message = this.errorMessage(error);
        if (!isPlayInterruptedError(message)) this.setError(message);
      }
    } else {
      this.audio.pause();
      this.setState({ isPlaying: false });
      this.rememberPlaybackPosition(true);
    }
  }

  async nextTrack(automatic = false): Promise<void> {
    const queue = this.state.queue;
    if (!queue.length) return;
    let nextIndex = this.state.currentIndex + 1;
    if (this.state.playMode === "shuffle" && queue.length > 1) {
      nextIndex = Math.floor(Math.random() * queue.length);
      if (nextIndex === this.state.currentIndex) nextIndex = (nextIndex + 1) % queue.length;
    } else if (nextIndex >= queue.length) {
      const activeTracks = this.state.activeTracks;
      const queueIsActivePlaylist =
        this.state.hasMoreTracks &&
        queue.length === activeTracks.length &&
        activeTracks.every((song, index) => queue[index]?.id === song.id);
      if (queueIsActivePlaylist) {
        await this.loadMoreTracks();
        const nextQueue = this.state.activeTracks;
        if (nextQueue.length > queue.length) {
          await this.startSong(nextQueue[queue.length], nextQueue, queue.length, automatic);
          return;
        }
      }
      nextIndex = 0;
    }
    await this.startSong(queue[nextIndex], queue, nextIndex, automatic);
  }

  async prevTrack(): Promise<void> {
    const queue = this.state.queue;
    if (!queue.length) return;
    const nextIndex = this.state.currentIndex <= 0 ? queue.length - 1 : this.state.currentIndex - 1;
    await this.startSong(queue[nextIndex], queue, nextIndex, false);
  }

  seek(time: number): void {
    this.audio.currentTime = Math.max(0, Math.min(time, this.audio.duration || time));
    this.setState({ currentTime: this.audio.currentTime });
    this.rememberPlaybackPosition(true);
  }

  setVolume(volume: number): void {
    const next = Math.max(0, Math.min(1, volume));
    this.audio.volume = next;
    const muted = next <= 0 ? true : this.state.muted;
    this.audio.muted = muted;
    this.setState({ volume: next, muted });
    void this.saveConfig();
  }

  toggleMute(): void {
    const muted = !this.state.muted;
    this.audio.muted = muted;
    this.setState({ muted });
    void this.saveConfig();
  }

  setPlayMode(playMode: PlayMode): void {
    this.setState({ playMode });
    void this.saveConfig();
  }

  setQuality(quality: PlaybackQuality): void {
    this.setState({ quality });
    void this.saveConfig();
  }

  setLyricFontSize(lyricFontSize: PlayerState["lyricFontSize"]): void {
    this.setState({ lyricFontSize });
    void this.saveConfig();
  }

  toggleLyricTranslation(): void {
    this.setState({ showLyricTranslation: !this.state.showLyricTranslation });
    void this.saveConfig();
  }

  toggleCoverBackground(): void {
    this.setState({ showCoverBackground: !this.state.showCoverBackground });
    void this.saveConfig();
  }

  toggleKeyboardShortcuts(): void {
    this.setState({ keyboardShortcutsEnabled: !this.state.keyboardShortcutsEnabled });
    void this.saveConfig();
  }

  clearError(): void {
    this.setState({ error: null });
  }

  getCacheStats(): CacheStats {
    let playlistTrackCount = 0;
    for (const entry of this.playlistCache.values()) playlistTrackCount += entry.tracks.length;
    let persistedPlaylistTrackCount = 0;
    for (const entry of this.dataCache.playlistEntries) persistedPlaylistTrackCount += entry.tracks.length;
    const persistedListCount = [
      this.dataCache.userPlaylists,
      this.dataCache.topPlaylists,
      this.dataCache.discoverPlaylists,
      this.dataCache.recommendSongs,
    ].filter(Boolean).length;
    return {
      coverCount: this.coverCache.size,
      coverPendingCount: this.coverRequestCache.size,
      playlistCount: this.playlistCache.size,
      playlistTrackCount,
      persistedListCount,
      persistedCoverCount: this.dataCache.coverEntries.length,
      persistedPlaylistCount: this.dataCache.playlistEntries.length,
      persistedPlaylistTrackCount,
    };
  }

  clearCoverCache(): void {
    this.coverCache.clear();
    this.coverRequestCache.clear();
    this.dataCache.coverEntries = [];
    void this.sdk?.music.clearCoverCache().catch(() => undefined);
    void this.saveConfig();
    this.notify("封面缓存已清理");
  }

  clearPlaylistCache(): void {
    this.playlistCache.clear();
    this.clearPersistentPlaylistData();
    void this.saveConfig();
    this.notify("歌单数据缓存已清理");
  }

  clearAllCaches(): void {
    this.coverCache.clear();
    this.coverRequestCache.clear();
    this.playlistCache.clear();
    this.clearPersistentDataCache();
    void this.sdk?.music.clearCoverCache().catch(() => undefined);
    void this.saveConfig();
    this.notify("播放器缓存已清理");
  }

  async coverProxyUrl(rawUrl: string): Promise<string> {
    if (!rawUrl) return "";
    const cached = this.coverCache.get(rawUrl);
    if (cached) return cached;
    const pending = this.coverRequestCache.get(rawUrl);
    if (pending) return pending;

    const request = new Promise<string>((resolve, reject) => {
      this.coverQueue.push({ rawUrl, resolve, reject });
      this.pumpCoverQueue();
    });
    this.coverRequestCache.set(rawUrl, request);
    return request;
  }

  cachedCoverProxyUrl(rawUrl: string): string {
    return rawUrl ? this.coverCache.get(rawUrl) || "" : "";
  }

  dispose(): void {
    this.stopLoginPolling();
    this.stopAudio();
    this.unbindAudio();
    if (this.configSaveTimer !== null) {
      window.clearTimeout(this.configSaveTimer);
      this.configSaveTimer = null;
    }
    this.listeners.clear();
    this.coverCache.clear();
    this.coverRequestCache.clear();
    this.coverQueue = [];
    this.activeCoverRequests = 0;
    this.playlistCache.clear();
    this.dataCache = createEmptyDataCache();
    this.sdk = null;
    this.state = { ...INITIAL_STATE };
  }

  private applyPlaylistCache(entry: PlaylistCacheEntry): void {
    this.setState({
      activePlaylist: entry.playlist,
      activeTracks: [...entry.tracks],
      playlistOffset: entry.playlistOffset,
      hasMoreTracks: entry.hasMoreTracks,
    });
  }

  private rememberPlaylist(playlist: Playlist, tracks: Song[], hasMoreTracks: boolean): PlaylistCacheEntry {
    if (this.playlistCache.size >= MAX_PLAYLIST_CACHE_SIZE && !this.playlistCache.has(playlist.id)) {
      const firstKey = this.playlistCache.keys().next().value;
      if (firstKey) this.playlistCache.delete(firstKey);
    }

    const entry: PlaylistCacheEntry = {
      playlist,
      tracks: [...tracks],
      playlistOffset: tracks.length,
      hasMoreTracks,
      loadedAt: Date.now(),
    };
    this.playlistCache.set(playlist.id, entry);
    this.rememberPersistedPlaylist(entry);
    this.scheduleSaveConfig();
    return entry;
  }

  private applyDataCacheForUser(userId: string): void {
    if (!userId) return;
    if (this.dataCache.userId && this.dataCache.userId !== userId) {
      this.dataCache = createEmptyDataCache(userId);
      this.playlistCache.clear();
      void this.saveConfig();
      return;
    }

    if (!this.dataCache.userId) {
      this.dataCache.userId = userId;
      void this.saveConfig();
    }

    this.restoreMemoryCachesFromDataCache();
    const patch: Partial<PlayerState> = {};
    if (this.dataCache.userPlaylists) patch.userPlaylists = [...this.dataCache.userPlaylists.value];
    if (this.dataCache.topPlaylists) patch.topPlaylists = [...this.dataCache.topPlaylists.value];
    if (this.dataCache.discoverPlaylists) patch.discoverPlaylists = [...this.dataCache.discoverPlaylists.value];
    if (this.dataCache.recommendSongs) patch.recommendSongs = [...this.dataCache.recommendSongs.value];
    if (Object.keys(patch).length) this.setState(patch);
  }

  private applyCachedList<K extends "userPlaylists" | "topPlaylists" | "discoverPlaylists" | "recommendSongs">(
    key: K,
    cached: CachedValue<PlayerState[K]> | null,
  ): boolean {
    if (!cached || !Array.isArray(cached.value)) return false;
    this.setState({ [key]: [...cached.value] } as Pick<PlayerState, K>);
    return true;
  }

  private rememberCachedList<K extends "userPlaylists" | "topPlaylists" | "discoverPlaylists" | "recommendSongs">(
    key: K,
    value: PlayerState[K],
  ): void {
    this.ensureDataCacheUser();
    this.dataCache[key] = {
      value: [...value],
      loadedAt: Date.now(),
    } as PersistentDataCache[K];
    this.scheduleSaveConfig();
  }

  private rememberPersistedPlaylist(entry: PlaylistCacheEntry): void {
    this.ensureDataCacheUser();
    const tracks = entry.tracks.slice(0, MAX_PERSISTED_PLAYLIST_TRACKS);
    const persisted: PersistedPlaylistCacheEntry = {
      playlist: entry.playlist,
      tracks,
      playlistOffset: tracks.length,
      hasMoreTracks: entry.hasMoreTracks || entry.tracks.length > tracks.length,
      loadedAt: entry.loadedAt,
    };
    this.dataCache.playlistEntries = [
      persisted,
      ...this.dataCache.playlistEntries.filter((item) => item.playlist.id !== entry.playlist.id),
    ].slice(0, MAX_PLAYLIST_CACHE_SIZE);
  }

  private rememberPersistedCover(rawUrl: string, proxiedUrl: string): void {
    if (!rawUrl || !proxiedUrl) return;
    this.ensureDataCacheUser();
    const entry: PersistedCoverCacheEntry = {
      rawUrl,
      proxiedUrl,
      loadedAt: Date.now(),
    };
    this.dataCache.coverEntries = [
      entry,
      ...this.dataCache.coverEntries.filter((item) => item.rawUrl !== rawUrl),
    ].slice(0, MAX_COVER_CACHE_SIZE);
  }

  private pumpCoverQueue(): void {
    const sdk = this.sdk;
    if (!sdk) return;
    while (this.activeCoverRequests < MAX_ACTIVE_COVER_REQUESTS && this.coverQueue.length) {
      const task = this.coverQueue.shift();
      if (!task) return;
      this.activeCoverRequests += 1;
      sdk.music
        .coverProxyUrl(task.rawUrl)
        .catch(() => task.rawUrl)
        .then((proxied) => {
          this.coverCache.set(task.rawUrl, proxied);
          this.rememberPersistedCover(task.rawUrl, proxied);
          this.scheduleSaveConfig();
          task.resolve(proxied);
        })
        .catch((error) => {
          task.reject(error);
        })
        .finally(() => {
          this.activeCoverRequests = Math.max(0, this.activeCoverRequests - 1);
          this.coverRequestCache.delete(task.rawUrl);
          this.pumpCoverQueue();
        });
    }
  }

  private restoreMemoryCachesFromDataCache(): void {
    this.playlistCache.clear();
    for (const entry of this.dataCache.playlistEntries) {
      this.playlistCache.set(entry.playlist.id, {
        playlist: entry.playlist,
        tracks: [...entry.tracks],
        playlistOffset: entry.playlistOffset,
        hasMoreTracks: entry.hasMoreTracks,
        loadedAt: entry.loadedAt,
      });
    }
    this.coverCache.clear();
    const now = Date.now();
    this.dataCache.coverEntries = this.dataCache.coverEntries
      .filter((entry) => now - entry.loadedAt <= COVER_CACHE_TTL_MS)
      .slice(0, MAX_COVER_CACHE_SIZE);
    for (const entry of this.dataCache.coverEntries) {
      this.coverCache.set(entry.rawUrl, entry.proxiedUrl);
    }
  }

  private clearPersistentDataCache(): void {
    const userId = this.dataCache.userId;
    this.dataCache = createEmptyDataCache(userId);
  }

  private clearPersistentPlaylistData(): void {
    this.dataCache.userPlaylists = null;
    this.dataCache.topPlaylists = null;
    this.dataCache.discoverPlaylists = null;
    this.dataCache.recommendSongs = null;
    this.dataCache.playlistEntries = [];
  }

  private ensureDataCacheUser(): void {
    const userId = this.state.loginInfo?.user_id || this.dataCache.userId || "";
    if (this.dataCache.userId && userId && this.dataCache.userId !== userId) {
      this.dataCache = createEmptyDataCache(userId);
      this.playlistCache.clear();
      return;
    }
    if (userId && !this.dataCache.userId) this.dataCache.userId = userId;
  }

  private async startSong(song: Song, queue: Song[], index: number, automatic: boolean, startAt = 0): Promise<void> {
    const sdk = this.requireSdk();
    const request = ++this.requestSeq;
    this.setState({ loading: "song", error: null });
    try {
      const result = await sdk.music.songUrl(song.id, this.state.quality);
      if (request !== this.requestSeq) return;
      if (!result.playable || !result.url) {
        const message = friendlyErrorMessage(result.message || result.reason || "当前账号无法播放这首歌");
        if (automatic) {
          await this.skipUnavailable(message);
        } else {
          this.notify(message);
          this.setState({ error: message });
        }
        return;
      }

      const [audioUrl, coverUrl] = await Promise.all([
        sdk.music.audioProxyUrl(result.url),
        song.cover ? this.coverProxyUrl(song.cover) : Promise.resolve(""),
      ]);
      if (request !== this.requestSeq) return;

      if (!automatic) this.consecutiveSkips = 0;
      this.audio.src = audioUrl;
      this.audio.volume = this.state.volume;
      this.audio.muted = this.state.muted;
      const resumeTime = clampPlaybackTime(startAt, song.duration ? song.duration / 1000 : 0);
      if (resumeTime > 0) {
        try {
          this.audio.currentTime = resumeTime;
        } catch {
          // Some streams reject seeking until metadata is ready; loadedmetadata will still sync duration.
        }
      }
      await this.audio.play();
      this.consecutiveSkips = 0;
      this.setState({
        currentSong: song,
        currentCoverUrl: coverUrl,
        isPlaying: true,
        currentTime: resumeTime,
        duration: song.duration ? song.duration / 1000 : 0,
        queue: [...queue],
        currentIndex: index,
        trial: result.trial,
        lyrics: [],
        lyricStatus: "loading",
        loading: null,
      });
      this.rememberRecentSong(song);
      this.rememberPlaybackPosition(true);
      void this.loadLyrics(song.id, request);
    } catch (error) {
      if (request !== this.requestSeq) return;
      const message = this.errorMessage(error);
      if (isPlayInterruptedError(message)) {
        this.setState({ isPlaying: false });
      } else if (automatic) {
        await this.skipUnavailable(message);
      } else {
        this.setError(message);
      }
    } finally {
      if (request === this.requestSeq) this.setState({ loading: null });
    }
  }

  private async loadLyrics(songId: string, request: number): Promise<void> {
    const sdk = this.requireSdk();
    try {
      const lyrics = await sdk.music.lyric(songId);
      if (request !== this.requestSeq || this.state.currentSong?.id !== songId) return;
      const lines = parseLrc(lyrics.lyric, lyrics.translation);
      this.setState({
        lyrics: lines,
        lyricStatus: lines.length ? "ready" : isInstrumentalLyric(lyrics.lyric) ? "instrumental" : "empty",
      });
    } catch {
      if (request === this.requestSeq) this.setState({ lyrics: [], lyricStatus: "empty" });
    }
  }

  private async skipUnavailable(message: string): Promise<void> {
    this.consecutiveSkips += 1;
    const safeMessage = friendlyErrorMessage(message || "播放失败，已尝试下一首")
      .replace("可尝试下一首", "已尝试下一首");
    if (this.consecutiveSkips >= 5) {
      this.notify("队列中多首歌曲不可播放，已停止自动跳过");
      this.stopAudio();
      this.setState({ error: safeMessage, isPlaying: false });
      return;
    }
    this.setState({ error: safeMessage });
    if (this.consecutiveSkips === 1) this.notify(safeMessage);
    await this.nextTrack(true);
  }

  private async loadConfig(): Promise<void> {
    const sdk = this.requireSdk();
    const raw = await sdk.storage.get().catch(() => null);
    const config = normalizeConfig(raw);
    this.dataCache = cloneDataCache(config.dataCache);
    this.restoreMemoryCachesFromDataCache();
    this.audio.volume = config.volume;
    this.audio.muted = config.muted;
    const restoredSong = config.lastPlayback?.song ?? null;
    const restoredTime = config.lastPlayback ? clampPlaybackTime(config.lastPlayback.currentTime, config.lastPlayback.duration) : 0;
    this.setState({
      ...config,
      currentSong: restoredSong,
      currentTime: restoredTime,
      duration: config.lastPlayback?.duration || (restoredSong?.duration ? restoredSong.duration / 1000 : 0),
      queue: restoredSong ? [restoredSong] : [],
      currentIndex: restoredSong ? 0 : -1,
      isPlaying: false,
      trial: false,
      lyrics: [],
      lyricStatus: "idle",
    });
    if (restoredSong?.cover) {
      const coverUrl = await this.coverProxyUrl(restoredSong.cover);
      if (this.state.currentSong?.id === restoredSong.id) this.setState({ currentCoverUrl: coverUrl });
    }
  }

  private async saveConfig(): Promise<void> {
    const sdk = this.sdk;
    if (!sdk) return;
    await sdk.storage
      .set({
        volume: this.state.volume,
        muted: this.state.muted,
        playMode: this.state.playMode,
        quality: this.state.quality,
        recentSongs: this.state.recentSongs,
        searchHistory: this.state.searchHistory,
        lyricFontSize: this.state.lyricFontSize,
        showLyricTranslation: this.state.showLyricTranslation,
        showCoverBackground: this.state.showCoverBackground,
        keyboardShortcutsEnabled: this.state.keyboardShortcutsEnabled,
        lastPlayback: this.state.lastPlayback,
        dataCache: this.dataCache,
      })
      .catch(() => undefined);
  }

  private scheduleSaveConfig(): void {
    if (this.configSaveTimer !== null) window.clearTimeout(this.configSaveTimer);
    this.configSaveTimer = window.setTimeout(() => {
      this.configSaveTimer = null;
      void this.saveConfig();
    }, CONFIG_SAVE_DEBOUNCE_MS);
  }

  private rememberRecentSong(song: Song): void {
    const recentSongs = [song, ...this.state.recentSongs.filter((item) => item.id !== song.id)].slice(0, 30);
    this.setState({ recentSongs });
    void this.saveConfig();
  }

  private rememberSearchKeyword(keyword: string): void {
    const value = keyword.trim();
    if (!value) return;
    const searchHistory = [value, ...this.state.searchHistory.filter((item) => item !== value)].slice(0, 12);
    this.setState({ searchHistory });
    void this.saveConfig();
  }

  private rememberPlaybackPosition(force = false): void {
    const song = this.state.currentSong;
    if (!song) return;
    const now = Date.now();
    if (!force && now - this.lastPlaybackSaveAt < PLAYBACK_SAVE_INTERVAL_MS) return;
    this.lastPlaybackSaveAt = now;
    const duration = Number.isFinite(this.state.duration) && this.state.duration > 0
      ? this.state.duration
      : song.duration
        ? song.duration / 1000
        : 0;
    const currentTime = clampPlaybackTime(this.state.currentTime, duration);
    this.setState({
      lastPlayback: {
        song,
        currentTime,
        duration,
        updatedAt: now,
      },
    });
    void this.saveConfig();
  }

  private bindAudio(): void {
    if (this.audioBound) return;
    this.audio.addEventListener("timeupdate", this.handleTimeUpdate);
    this.audio.addEventListener("loadedmetadata", this.handleLoadedMetadata);
    this.audio.addEventListener("ended", this.handleEnded);
    this.audio.addEventListener("error", this.handleAudioError);
    this.audioBound = true;
  }

  private unbindAudio(): void {
    if (!this.audioBound) return;
    this.audio.removeEventListener("timeupdate", this.handleTimeUpdate);
    this.audio.removeEventListener("loadedmetadata", this.handleLoadedMetadata);
    this.audio.removeEventListener("ended", this.handleEnded);
    this.audio.removeEventListener("error", this.handleAudioError);
    this.audioBound = false;
  }

  private handleTimeUpdate = (): void => {
    this.setState({ currentTime: this.audio.currentTime });
    this.rememberPlaybackPosition(false);
  };

  private handleLoadedMetadata = (): void => {
    if (Number.isFinite(this.audio.duration)) {
      this.setState({ duration: this.audio.duration });
      this.rememberPlaybackPosition(true);
    }
  };

  private handleEnded = (): void => {
    this.rememberPlaybackPosition(true);
    if (this.state.playMode === "one" && this.state.currentSong) {
      void this.startSong(this.state.currentSong, this.state.queue, this.state.currentIndex, true);
    } else {
      void this.nextTrack(true);
    }
  };

  private handleAudioError = (): void => {
    if (!this.audio.src) return;
    this.setState({ error: "播放失败，可尝试下一首", isPlaying: false });
  };

  private stopAudio(): void {
    this.rememberPlaybackPosition(true);
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.setState({ isPlaying: false, currentTime: 0 });
  }

  private startLoginPolling(): void {
    this.stopLoginPolling();
    let attempts = 0;
    this.loginPollTimer = window.setInterval(() => {
      attempts += 1;
      void this.refreshLoginStatus();
      if (attempts >= 150 || this.state.loginInfo?.logged_in) this.stopLoginPolling();
    }, 2000);
  }

  private stopLoginPolling(): void {
    if (this.loginPollTimer !== null) {
      window.clearInterval(this.loginPollTimer);
      this.loginPollTimer = null;
    }
  }

  private setError(error: unknown): void {
    const message = this.errorMessage(error);
    this.setState({ error: message, loading: null });
    this.notify(message);
  }

  private errorMessage(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error);
    return friendlyErrorMessage(raw);
  }

  private notify(message: string): void {
    const now = Date.now();
    if (message === this.lastNotifyMessage && now - this.lastNotifyAt < NOTIFY_DEDUPE_MS) return;
    this.lastNotifyMessage = message;
    this.lastNotifyAt = now;
    this.sdk?.ui.notify(message);
  }

  private requireSdk(): PluginSdk {
    if (!this.sdk) throw new Error("Music runtime is not initialized");
    return this.sdk;
  }
}

function normalizeConfig(raw: unknown): RuntimeConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_CONFIG, dataCache: createEmptyDataCache() };
  const data = raw as Partial<RuntimeConfig>;
  return {
    volume: typeof data.volume === "number" ? Math.max(0, Math.min(1, data.volume)) : DEFAULT_CONFIG.volume,
    muted: typeof data.muted === "boolean" ? data.muted : DEFAULT_CONFIG.muted,
    playMode: isPlayMode(data.playMode) ? data.playMode : DEFAULT_CONFIG.playMode,
    quality: isQuality(data.quality) ? data.quality : DEFAULT_CONFIG.quality,
    recentSongs: Array.isArray(data.recentSongs) ? data.recentSongs.filter(isSong).slice(0, 30) : DEFAULT_CONFIG.recentSongs,
    searchHistory: Array.isArray(data.searchHistory) ? data.searchHistory.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 12) : DEFAULT_CONFIG.searchHistory,
    lyricFontSize: isLyricFontSize(data.lyricFontSize) ? data.lyricFontSize : DEFAULT_CONFIG.lyricFontSize,
    showLyricTranslation: typeof data.showLyricTranslation === "boolean" ? data.showLyricTranslation : DEFAULT_CONFIG.showLyricTranslation,
    showCoverBackground: typeof data.showCoverBackground === "boolean" ? data.showCoverBackground : DEFAULT_CONFIG.showCoverBackground,
    keyboardShortcutsEnabled: typeof data.keyboardShortcutsEnabled === "boolean" ? data.keyboardShortcutsEnabled : DEFAULT_CONFIG.keyboardShortcutsEnabled,
    lastPlayback: isLastPlayback(data.lastPlayback) ? data.lastPlayback : DEFAULT_CONFIG.lastPlayback,
    dataCache: normalizeDataCache(data.dataCache),
  };
}

function createEmptyDataCache(userId = ""): PersistentDataCache {
  return {
    schemaVersion: DATA_CACHE_SCHEMA_VERSION,
    userId,
    userPlaylists: null,
    topPlaylists: null,
    discoverPlaylists: null,
    recommendSongs: null,
    coverEntries: [],
    playlistEntries: [],
  };
}

function cloneDataCache(cache: PersistentDataCache): PersistentDataCache {
  return {
    schemaVersion: DATA_CACHE_SCHEMA_VERSION,
    userId: cache.userId,
    userPlaylists: cloneCachedValue(cache.userPlaylists),
    topPlaylists: cloneCachedValue(cache.topPlaylists),
    discoverPlaylists: cloneCachedValue(cache.discoverPlaylists),
    recommendSongs: cloneCachedValue(cache.recommendSongs),
    coverEntries: cache.coverEntries.map((entry) => ({ ...entry })),
    playlistEntries: cache.playlistEntries.map((entry) => ({
      playlist: entry.playlist,
      tracks: [...entry.tracks],
      playlistOffset: entry.playlistOffset,
      hasMoreTracks: entry.hasMoreTracks,
      loadedAt: entry.loadedAt,
    })),
  };
}

function cloneCachedValue<T>(cache: CachedValue<T[]> | null): CachedValue<T[]> | null {
  return cache ? { value: [...cache.value], loadedAt: cache.loadedAt } : null;
}

function uniquePlaylists(playlists: Playlist[]): Playlist[] {
  const seen = new Set<string>();
  const result: Playlist[] = [];
  for (const playlist of playlists) {
    if (seen.has(playlist.id)) continue;
    seen.add(playlist.id);
    result.push(playlist);
  }
  return result;
}

function rotatePlaylists(playlists: Playlist[], offset: number): Playlist[] {
  if (!playlists.length) return [];
  const start = Math.abs(offset) % playlists.length;
  return [...playlists.slice(start), ...playlists.slice(0, start)];
}

function normalizeDataCache(value: unknown): PersistentDataCache {
  if (!value || typeof value !== "object") return createEmptyDataCache();
  const cache = value as Partial<PersistentDataCache>;
  if (cache.schemaVersion !== DATA_CACHE_SCHEMA_VERSION) return createEmptyDataCache(typeof cache.userId === "string" ? cache.userId : "");
  const userId = typeof cache.userId === "string" ? cache.userId : "";
  return {
    schemaVersion: DATA_CACHE_SCHEMA_VERSION,
    userId,
    userPlaylists: normalizeCachedArray(cache.userPlaylists, isPlaylist, 200),
    topPlaylists: normalizeCachedArray(cache.topPlaylists, isPlaylist, 100),
    discoverPlaylists: normalizeCachedArray(cache.discoverPlaylists, isPlaylist, 100),
    recommendSongs: normalizeCachedArray(cache.recommendSongs, isSong, 100),
    coverEntries: Array.isArray(cache.coverEntries)
      ? cache.coverEntries.filter(isPersistedCoverCacheEntry).slice(0, MAX_COVER_CACHE_SIZE)
      : [],
    playlistEntries: Array.isArray(cache.playlistEntries)
      ? cache.playlistEntries.filter(isPersistedPlaylistCacheEntry).slice(0, MAX_PLAYLIST_CACHE_SIZE)
      : [],
  };
}

function normalizeCachedArray<T>(
  value: unknown,
  guard: (item: unknown) => item is T,
  limit: number,
): CachedValue<T[]> | null {
  if (!value || typeof value !== "object") return null;
  const cache = value as Partial<CachedValue<unknown[]>>;
  if (!Array.isArray(cache.value) || typeof cache.loadedAt !== "number" || !Number.isFinite(cache.loadedAt)) return null;
  return {
    value: cache.value.filter(guard).slice(0, limit),
    loadedAt: cache.loadedAt,
  };
}

function isPlayMode(value: unknown): value is PlayMode {
  return value === "list" || value === "shuffle" || value === "one";
}

function isQuality(value: unknown): value is PlaybackQuality {
  return value === "hires" || value === "lossless" || value === "exhigh" || value === "standard";
}

function isLyricFontSize(value: unknown): value is PlayerState["lyricFontSize"] {
  return value === "compact" || value === "normal" || value === "large";
}

function isInstrumentalLyric(value: string): boolean {
  return /纯音乐|instrumental/i.test(value || "");
}

function normalizeMediaName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function isSong(value: unknown): value is Song {
  if (!value || typeof value !== "object") return false;
  const song = value as Partial<Song>;
  return typeof song.id === "string" && typeof song.name === "string";
}

function isPlaylist(value: unknown): value is Playlist {
  if (!value || typeof value !== "object") return false;
  const playlist = value as Partial<Playlist>;
  return typeof playlist.id === "string" && typeof playlist.name === "string";
}

function isPersistedPlaylistCacheEntry(value: unknown): value is PersistedPlaylistCacheEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<PersistedPlaylistCacheEntry>;
  return isPlaylist(entry.playlist)
    && Array.isArray(entry.tracks)
    && entry.tracks.every(isSong)
    && typeof entry.playlistOffset === "number"
    && Number.isFinite(entry.playlistOffset)
    && typeof entry.hasMoreTracks === "boolean"
    && typeof entry.loadedAt === "number"
    && Number.isFinite(entry.loadedAt);
}

function isPersistedCoverCacheEntry(value: unknown): value is PersistedCoverCacheEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<PersistedCoverCacheEntry>;
  return typeof entry.rawUrl === "string"
    && typeof entry.proxiedUrl === "string"
    && typeof entry.loadedAt === "number"
    && Number.isFinite(entry.loadedAt);
}

function isLastPlayback(value: unknown): value is LastPlaybackState {
  if (!value || typeof value !== "object") return false;
  const playback = value as Partial<LastPlaybackState>;
  return isSong(playback.song)
    && typeof playback.currentTime === "number"
    && Number.isFinite(playback.currentTime)
    && typeof playback.duration === "number"
    && Number.isFinite(playback.duration);
}

function clampPlaybackTime(currentTime: number, duration: number): number {
  if (!Number.isFinite(currentTime) || currentTime < 0) return 0;
  if (!Number.isFinite(duration) || duration <= 0) return Math.max(0, currentTime);
  if (duration <= 12) return 0;
  return Math.max(0, Math.min(currentTime, Math.max(0, duration - 3)));
}

function isMediaPlaybackError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("no supported source")
    || lower.includes("not supported")
    || lower.includes("src_not_supported")
    || lower.includes("media resource")
    || lower.includes("media element")
    || message.includes("音源")
    || message.includes("播放失败");
}

function isPlayInterruptedError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("interrupted by a call to pause")
    || lower.includes("interrupted by a new load request")
    || lower.includes("the play() request was interrupted");
}

function friendlyErrorMessage(raw: string): string {
  const message = (raw || "").trim();
  const lower = message.toLowerCase();
  if (!message || message === "undefined" || message === "null") return "操作失败，请稍后重试";
  if (isPlayInterruptedError(message)) {
    return "播放已中断";
  }
  if (isMediaPlaybackError(message)) {
    return "播放失败，可尝试下一首";
  }
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("timeout") || message.includes("超时") || message.includes("网络")) {
    return "网络连接不稳定，请检查网络后重试";
  }
  if (message.includes("二维码已过期") || lower.includes("qrcode expired") || message === "800") {
    return "二维码已过期，请刷新后重新扫码";
  }
  if (message.includes("等待扫码") || lower.includes("waiting scan") || message === "801") {
    return "请使用网易云音乐 App 扫码登录";
  }
  if (message.includes("已扫码") || message.includes("待确认") || lower.includes("waiting confirm") || message === "802") {
    return "已扫码，请在手机上确认登录";
  }
  if (message.includes("验证码") || lower.includes("captcha")) {
    if (message.includes("频繁") || message.includes("太多") || lower.includes("frequent") || lower.includes("rate")) {
      return "验证码请求太频繁，请稍后再试";
    }
    if (message.includes("错误") || message.includes("不正确") || lower.includes("invalid")) {
      return "验证码错误，请检查后重新输入";
    }
    return message.length > 80 ? `${message.slice(0, 80)}...` : message;
  }
  if (lower.includes("rate") || message.includes("频繁") || message.includes("限流")) {
    return "请求太频繁了，请稍等片刻再试";
  }
  if (lower.includes("login") || message.includes("登录") || message.includes("账号")) {
    return "网易云账号状态异常，请重新登录后再试";
  }
  if (message.includes("会员") || lower.includes("vip") || lower.includes("fee")) {
    return "当前歌曲需要会员权限，可尝试播放试听片段或切换歌曲";
  }
  if (message.includes("版权") || message.includes("下架") || lower.includes("copyright") || lower.includes("unavailable")) {
    return "当前歌曲暂时不可播放，可能是版权或地区限制";
  }
  return message.length > 80 ? `${message.slice(0, 80)}...` : message;
}

export const runtime = new MusicRuntime();
