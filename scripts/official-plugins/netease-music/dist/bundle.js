// src/index.tsx
import React, { Button, Dialog, Icon, Slider, TextField, useEffect, useRef, useState } from "sdk";

// src/lyrics.ts
var timePattern = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
function parseLrc(lyric, translation) {
  const translations = /* @__PURE__ */ new Map();
  for (const line of parsePlainLrc(translation)) {
    translations.set(roundTime(line.time), line.text);
  }
  return parsePlainLrc(lyric).map((line) => ({
    ...line,
    translation: translations.get(roundTime(line.time))
  })).filter((line) => line.text || line.translation).sort((a, b) => a.time - b.time);
}
function activeLyricIndex(lines, currentTime) {
  if (!lines.length) return -1;
  let low = 0;
  let high = lines.length - 1;
  let result = -1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lines[mid].time <= currentTime + 0.15) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return result;
}
function parsePlainLrc(input) {
  const rows = [];
  for (const rawLine of input.split(/\r?\n/)) {
    timePattern.lastIndex = 0;
    const matches = Array.from(rawLine.matchAll(timePattern));
    if (!matches.length) continue;
    const text = rawLine.replace(timePattern, "").trim();
    for (const match of matches) {
      rows.push({ time: toSeconds(match), text });
    }
  }
  return rows;
}
function toSeconds(match) {
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const fraction = match[3] ?? "0";
  const ms = Number(fraction.padEnd(3, "0").slice(0, 3));
  return minutes * 60 + seconds + ms / 1e3;
}
function roundTime(value) {
  return Math.round(value * 10) / 10;
}

// src/types.ts
var DEFAULT_CONFIG = {
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
    playlistEntries: []
  }
};
var EMPTY_LOGIN = {
  provider: "netease",
  logged_in: false,
  user_id: "",
  nickname: "",
  avatar: "",
  vip_type: null,
  vip_level: null,
  is_vip: false,
  is_svip: false
};

// src/runtime.ts
var INITIAL_STATE = {
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
  hasMoreTracks: false
};
var PLAYLIST_CACHE_TTL_MS = 5 * 60 * 1e3;
var LIST_CACHE_TTL_MS = 10 * 60 * 1e3;
var RECOMMEND_CACHE_TTL_MS = 30 * 60 * 1e3;
var COVER_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1e3;
var MAX_PLAYLIST_CACHE_SIZE = 24;
var MAX_COVER_CACHE_SIZE = 500;
var MAX_PERSISTED_PLAYLIST_TRACKS = 150;
var PLAYLIST_TRACK_PAGE_SIZE = 50;
var CONFIG_SAVE_DEBOUNCE_MS = 1200;
var MAX_ACTIVE_COVER_REQUESTS = 6;
var PLAYBACK_SAVE_INTERVAL_MS = 5e3;
var DATA_CACHE_SCHEMA_VERSION = 1;
var NOTIFY_DEDUPE_MS = 1600;
var DISCOVER_PLAYLIST_KEYWORDS = ["\u534E\u8BED", "\u6D41\u884C", "\u6CBB\u6108", "\u6447\u6EDA", "\u7535\u5B50", "\u6C11\u8C23", "\u53E4\u98CE", "ACG", "\u5B66\u4E60", "\u591C\u665A", "\u5F00\u8F66", "\u8F7B\u97F3\u4E50"];
var DISCOVER_PLAYLIST_MODIFIERS = ["\u7CBE\u9009", "\u5B9D\u85CF", "\u70ED\u95E8", "\u65B0\u6B4C", "\u79C1\u4EBA", "\u5FAA\u73AF", "\u653E\u677E", "\u7ECF\u5178"];
var MusicRuntime = class {
  sdk = null;
  state = { ...INITIAL_STATE };
  listeners = /* @__PURE__ */ new Set();
  audio = new Audio();
  audioBound = false;
  loginPollTimer = null;
  requestSeq = 0;
  playlistRequestSeq = 0;
  consecutiveSkips = 0;
  coverCache = /* @__PURE__ */ new Map();
  coverRequestCache = /* @__PURE__ */ new Map();
  coverQueue = [];
  activeCoverRequests = 0;
  playlistCache = /* @__PURE__ */ new Map();
  dataCache = createEmptyDataCache();
  lastPlaybackSaveAt = 0;
  tracksLoadingMore = false;
  configSaveTimer = null;
  lastNotifyMessage = "";
  lastNotifyAt = 0;
  discoverShuffleIndex = 0;
  init(sdk) {
    this.sdk = sdk;
    this.bindAudio();
    void this.loadConfig().finally(() => {
      void this.refreshLoginStatus();
    });
  }
  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }
  getState() {
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
      lyrics: [...this.state.lyrics]
    };
  }
  setState(patch) {
    this.state = { ...this.state, ...patch };
    const snapshot = this.getState();
    for (const listener of this.listeners) listener(snapshot);
  }
  async openLoginWindow() {
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
  async createQrLogin() {
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
  async checkQrLogin(key) {
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
  async sendLoginCaptcha(phone, countrycode) {
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
  async loginWithCellphone(phone, captcha, countrycode) {
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
  async logout() {
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
      error: null
    });
    this.playlistCache.clear();
    this.dataCache = createEmptyDataCache();
    void this.saveConfig();
  }
  async refreshLoginStatus() {
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
          this.loadDiscoverPlaylists()
        ]);
      }
    } catch (error) {
      this.setError(error);
    }
  }
  async loadUserPlaylists(force = false) {
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
      else this.notify("\u6B4C\u5355\u5237\u65B0\u5931\u8D25\uFF0C\u5DF2\u663E\u793A\u7F13\u5B58\u6570\u636E");
    } finally {
      if (!hasCached || force) this.setState({ loading: null });
    }
  }
  async loadTopPlaylists(force = false) {
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
      else this.notify("\u699C\u5355\u5237\u65B0\u5931\u8D25\uFF0C\u5DF2\u663E\u793A\u7F13\u5B58\u6570\u636E");
    } finally {
      if (!hasCached || force) this.setState({ loading: null });
    }
  }
  async loadDiscoverPlaylists(force = false) {
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
      else this.notify("\u53D1\u73B0\u6B4C\u5355\u5237\u65B0\u5931\u8D25\uFF0C\u5DF2\u663E\u793A\u7F13\u5B58\u6570\u636E");
    } finally {
      if (!hasCached || force) this.setState({ loading: null });
    }
  }
  async searchDiscoverPlaylists(keywords, force = false) {
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
  async shuffleDiscoverPlaylists(keywords = "") {
    const sdk = this.requireSdk();
    const query = keywords.trim();
    const currentIds = new Set(this.state.discoverPlaylists.map((playlist) => playlist.id));
    const seed = query ? `${query} ${DISCOVER_PLAYLIST_MODIFIERS[this.discoverShuffleIndex % DISCOVER_PLAYLIST_MODIFIERS.length]}` : DISCOVER_PLAYLIST_KEYWORDS[this.discoverShuffleIndex % DISCOVER_PLAYLIST_KEYWORDS.length];
    this.discoverShuffleIndex += 1;
    this.setState({ loading: "playlist-search", error: null });
    try {
      const primary = await sdk.music.searchPlaylists(seed, 50);
      const fallback = primary.length || !query ? [] : await sdk.music.searchPlaylists(query, 50);
      const merged = uniquePlaylists([...primary, ...fallback]);
      const fresh = merged.filter((playlist) => !currentIds.has(playlist.id));
      const discoverPlaylists = (fresh.length >= 6 ? fresh : rotatePlaylists(merged, this.discoverShuffleIndex * 7)).slice(0, 30);
      if (!discoverPlaylists.length) {
        this.notify("\u6682\u65F6\u6CA1\u6709\u6362\u5230\u65B0\u7684\u6B4C\u5355");
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
  async loadLikedList() {
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
  async toggleLike(songId) {
    const sdk = this.requireSdk();
    if (!this.state.loginInfo?.logged_in) {
      this.notify("\u8BF7\u5148\u767B\u5F55\u7F51\u6613\u4E91\u8D26\u53F7");
      return;
    }
    const previous = this.state.likedSongIds;
    const liked = previous.includes(songId);
    const likedSongIds = liked ? previous.filter((id) => id !== songId) : [...previous, songId];
    this.setState({ likedSongIds });
    try {
      await sdk.music.likeSong(songId, !liked);
      this.notify(liked ? "\u5DF2\u53D6\u6D88\u559C\u6B22" : "\u5DF2\u6DFB\u52A0\u5230\u559C\u6B22");
    } catch (error) {
      this.setState({ likedSongIds: previous });
      this.setError(error);
    }
  }
  async togglePlaylistSubscribe(playlist) {
    const sdk = this.requireSdk();
    if (!this.state.loginInfo?.logged_in) {
      this.notify("\u8BF7\u5148\u767B\u5F55\u7F51\u6613\u4E91\u8D26\u53F7");
      return;
    }
    const previousPlaylists = this.state.userPlaylists;
    const previousTopPlaylists = this.state.topPlaylists;
    const previousDiscoverPlaylists = this.state.discoverPlaylists;
    const previousActive = this.state.activePlaylist;
    const subscribe = !playlist.subscribed;
    const updatePlaylist = (item) => item.id === playlist.id ? { ...item, subscribed: subscribe } : item;
    this.setState({
      userPlaylists: previousPlaylists.map(updatePlaylist),
      topPlaylists: previousTopPlaylists.map(updatePlaylist),
      discoverPlaylists: previousDiscoverPlaylists.map(updatePlaylist),
      activePlaylist: previousActive?.id === playlist.id ? updatePlaylist(previousActive) : previousActive
    });
    try {
      await sdk.music.subscribePlaylist(playlist.id, subscribe);
      this.notify(subscribe ? "\u5DF2\u6536\u85CF\u6B4C\u5355" : "\u5DF2\u53D6\u6D88\u6536\u85CF\u6B4C\u5355");
      await this.loadUserPlaylists();
    } catch (error) {
      this.setState({
        userPlaylists: previousPlaylists,
        topPlaylists: previousTopPlaylists,
        discoverPlaylists: previousDiscoverPlaylists,
        activePlaylist: previousActive
      });
      this.setError(error);
    }
  }
  async loadRecommendSongs(force = false) {
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
      else this.notify("\u6BCF\u65E5\u63A8\u8350\u5237\u65B0\u5931\u8D25\uFF0C\u5DF2\u663E\u793A\u7F13\u5B58\u6570\u636E");
    } finally {
      if (!hasCached || force) this.setState({ loading: null });
    }
  }
  showQueue() {
    this.setState({ view: "playlist" });
  }
  showRecommendations() {
    this.setState({ view: "recommend" });
    if (!this.state.recommendSongs.length) {
      void this.loadRecommendSongs();
    }
  }
  showRecentSongs() {
    this.setState({ view: "recent" });
  }
  async loadPlaylist(target) {
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
        view: "playlist"
      });
    }
    try {
      const [activePlaylist, activeTracks] = playlistHint ? [playlistHint, await sdk.music.playlistTracksRange(id, 0, PLAYLIST_TRACK_PAGE_SIZE)] : await sdk.music.playlistTracks(id);
      if (request !== this.playlistRequestSeq) return;
      const entry = this.rememberPlaylist(activePlaylist, activeTracks, activeTracks.length < activePlaylist.track_count);
      this.setState({
        activePlaylist: entry.playlist,
        activeTracks: [...entry.tracks],
        playlistOffset: entry.playlistOffset,
        hasMoreTracks: entry.hasMoreTracks
      });
    } catch (error) {
      if (!cached) this.setError(error);
      else this.notify("\u6B4C\u5355\u5237\u65B0\u5931\u8D25\uFF0C\u5DF2\u663E\u793A\u7F13\u5B58\u6570\u636E");
    } finally {
      if (request === this.playlistRequestSeq && !cached) this.setState({ loading: null });
    }
  }
  async loadMoreTracks() {
    const sdk = this.requireSdk();
    const playlist = this.state.activePlaylist;
    if (!playlist || !this.state.hasMoreTracks || this.tracksLoadingMore) return;
    const playlistId = playlist.id;
    const start = this.state.activeTracks.length;
    const previousTracks = this.state.activeTracks;
    const shouldSyncQueue = this.state.queue.length === previousTracks.length && previousTracks.every((song, index) => this.state.queue[index]?.id === song.id);
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
        ...shouldSyncQueue ? { queue: activeTracks } : {},
        playlistOffset: activeTracks.length,
        hasMoreTracks
      });
      this.rememberPlaylist(currentPlaylist, activeTracks, hasMoreTracks);
    } catch (error) {
      this.setError(error);
    } finally {
      this.tracksLoadingMore = false;
      if (this.state.activePlaylist?.id === playlistId && this.state.loading === "tracks") this.setState({ loading: null });
    }
  }
  async search(keywords) {
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
        view: "playlist"
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
        sdk.music.searchArtists(query, 20).catch(() => [])
      ]);
      this.rememberSearchKeyword(query);
      this.setState({ searchResults, searchPlaylists, searchAlbums, searchArtists });
    } catch (error) {
      this.setError(error);
    } finally {
      this.setState({ loading: null });
    }
  }
  async findArtistByName(name) {
    const query = name.trim();
    if (!query) return null;
    const sdk = this.requireSdk();
    const artists = await sdk.music.searchArtists(query, 8).catch(() => []);
    const normalizedQuery = normalizeMediaName(query);
    return artists.find((artist) => normalizeMediaName(artist.name) === normalizedQuery) ?? artists[0] ?? null;
  }
  async findAlbumByName(name, artistName = "") {
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
  async playSong(song, queue) {
    const nextQueue = queue?.length ? queue : this.state.queue.length ? this.state.queue : [song];
    const index = Math.max(0, nextQueue.findIndex((item) => item.id === song.id));
    await this.startSong(song, nextQueue, index, false);
  }
  async playNext(song) {
    const queue = this.state.queue.length ? [...this.state.queue] : this.state.currentSong ? [this.state.currentSong] : [];
    const insertAt = Math.max(0, this.state.currentIndex) + 1;
    const existingIndex = queue.findIndex((item) => item.id === song.id);
    if (existingIndex >= 0) queue.splice(existingIndex, 1);
    queue.splice(Math.min(insertAt, queue.length), 0, song);
    this.setState({ queue });
    this.notify("\u5DF2\u6DFB\u52A0\u5230\u4E0B\u4E00\u9996\u64AD\u653E");
  }
  addSongsToQueue(songs) {
    const nextSongs = songs.filter((song) => song.playable !== false);
    if (!nextSongs.length) return;
    const queue = this.state.queue.length ? [...this.state.queue] : this.state.currentSong ? [this.state.currentSong] : [];
    const existingIds = new Set(queue.map((song) => song.id));
    const additions = nextSongs.filter((song) => !existingIds.has(song.id));
    if (!additions.length) {
      this.notify("\u8FD9\u4E9B\u6B4C\u66F2\u5DF2\u5728\u961F\u5217\u4E2D");
      return;
    }
    this.setState({
      queue: [...queue, ...additions],
      currentIndex: this.state.currentIndex >= 0 ? this.state.currentIndex : queue.length ? 0 : -1
    });
    this.notify("\u5DF2\u52A0\u5165\u64AD\u653E\u961F\u5217");
  }
  removeFromQueue(songId) {
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
  clearQueue() {
    const currentSong = this.state.currentSong;
    this.setState({
      queue: currentSong ? [currentSong] : [],
      currentIndex: currentSong ? 0 : -1
    });
  }
  clearSearchHistory() {
    if (!this.state.searchHistory.length) return;
    this.setState({ searchHistory: [] });
    void this.saveConfig();
  }
  async loadAlbumSongs(album) {
    const sdk = this.requireSdk();
    this.setState({ loading: "album", error: null, view: "search", mediaDetailSongs: [], mediaDetailArtists: [] });
    try {
      const [mediaDetailSongs, mediaDetailArtists] = await Promise.all([
        sdk.music.albumSongs(album.id),
        album.artist ? sdk.music.searchArtists(album.artist, 6).catch(() => []) : Promise.resolve([])
      ]);
      this.setState({ mediaDetailSongs, mediaDetailArtists });
    } catch (error) {
      this.setError(error);
    } finally {
      this.setState({ loading: null });
    }
  }
  async loadArtistSongs(artist) {
    const sdk = this.requireSdk();
    this.setState({ loading: "artist", error: null, view: "search", mediaDetailSongs: [], mediaDetailAlbums: [] });
    try {
      const [mediaDetailSongs, mediaDetailAlbums] = await Promise.all([
        sdk.music.artistSongs(artist.id),
        sdk.music.searchAlbums(artist.name, 12).catch(() => [])
      ]);
      this.setState({ mediaDetailSongs, mediaDetailAlbums });
    } catch (error) {
      this.setError(error);
    } finally {
      this.setState({ loading: null });
    }
  }
  async togglePlay() {
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
  async nextTrack(automatic = false) {
    const queue = this.state.queue;
    if (!queue.length) return;
    let nextIndex = this.state.currentIndex + 1;
    if (this.state.playMode === "shuffle" && queue.length > 1) {
      nextIndex = Math.floor(Math.random() * queue.length);
      if (nextIndex === this.state.currentIndex) nextIndex = (nextIndex + 1) % queue.length;
    } else if (nextIndex >= queue.length) {
      const activeTracks = this.state.activeTracks;
      const queueIsActivePlaylist = this.state.hasMoreTracks && queue.length === activeTracks.length && activeTracks.every((song, index) => queue[index]?.id === song.id);
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
  async prevTrack() {
    const queue = this.state.queue;
    if (!queue.length) return;
    const nextIndex = this.state.currentIndex <= 0 ? queue.length - 1 : this.state.currentIndex - 1;
    await this.startSong(queue[nextIndex], queue, nextIndex, false);
  }
  seek(time) {
    this.audio.currentTime = Math.max(0, Math.min(time, this.audio.duration || time));
    this.setState({ currentTime: this.audio.currentTime });
    this.rememberPlaybackPosition(true);
  }
  setVolume(volume) {
    const next = Math.max(0, Math.min(1, volume));
    this.audio.volume = next;
    const muted = next <= 0 ? true : this.state.muted;
    this.audio.muted = muted;
    this.setState({ volume: next, muted });
    void this.saveConfig();
  }
  toggleMute() {
    const muted = !this.state.muted;
    this.audio.muted = muted;
    this.setState({ muted });
    void this.saveConfig();
  }
  setPlayMode(playMode) {
    this.setState({ playMode });
    void this.saveConfig();
  }
  setQuality(quality) {
    this.setState({ quality });
    void this.saveConfig();
  }
  setLyricFontSize(lyricFontSize) {
    this.setState({ lyricFontSize });
    void this.saveConfig();
  }
  toggleLyricTranslation() {
    this.setState({ showLyricTranslation: !this.state.showLyricTranslation });
    void this.saveConfig();
  }
  toggleCoverBackground() {
    this.setState({ showCoverBackground: !this.state.showCoverBackground });
    void this.saveConfig();
  }
  toggleKeyboardShortcuts() {
    this.setState({ keyboardShortcutsEnabled: !this.state.keyboardShortcutsEnabled });
    void this.saveConfig();
  }
  clearError() {
    this.setState({ error: null });
  }
  getCacheStats() {
    let playlistTrackCount = 0;
    for (const entry of this.playlistCache.values()) playlistTrackCount += entry.tracks.length;
    let persistedPlaylistTrackCount = 0;
    for (const entry of this.dataCache.playlistEntries) persistedPlaylistTrackCount += entry.tracks.length;
    const persistedListCount = [
      this.dataCache.userPlaylists,
      this.dataCache.topPlaylists,
      this.dataCache.discoverPlaylists,
      this.dataCache.recommendSongs
    ].filter(Boolean).length;
    return {
      coverCount: this.coverCache.size,
      coverPendingCount: this.coverRequestCache.size,
      playlistCount: this.playlistCache.size,
      playlistTrackCount,
      persistedListCount,
      persistedCoverCount: this.dataCache.coverEntries.length,
      persistedPlaylistCount: this.dataCache.playlistEntries.length,
      persistedPlaylistTrackCount
    };
  }
  clearCoverCache() {
    this.coverCache.clear();
    this.coverRequestCache.clear();
    this.dataCache.coverEntries = [];
    void this.sdk?.music.clearCoverCache().catch(() => void 0);
    void this.saveConfig();
    this.notify("\u5C01\u9762\u7F13\u5B58\u5DF2\u6E05\u7406");
  }
  clearPlaylistCache() {
    this.playlistCache.clear();
    this.clearPersistentPlaylistData();
    void this.saveConfig();
    this.notify("\u6B4C\u5355\u6570\u636E\u7F13\u5B58\u5DF2\u6E05\u7406");
  }
  clearAllCaches() {
    this.coverCache.clear();
    this.coverRequestCache.clear();
    this.playlistCache.clear();
    this.clearPersistentDataCache();
    void this.sdk?.music.clearCoverCache().catch(() => void 0);
    void this.saveConfig();
    this.notify("\u64AD\u653E\u5668\u7F13\u5B58\u5DF2\u6E05\u7406");
  }
  async coverProxyUrl(rawUrl) {
    if (!rawUrl) return "";
    const cached = this.coverCache.get(rawUrl);
    if (cached) return cached;
    const pending = this.coverRequestCache.get(rawUrl);
    if (pending) return pending;
    const request = new Promise((resolve, reject) => {
      this.coverQueue.push({ rawUrl, resolve, reject });
      this.pumpCoverQueue();
    });
    this.coverRequestCache.set(rawUrl, request);
    return request;
  }
  cachedCoverProxyUrl(rawUrl) {
    return rawUrl ? this.coverCache.get(rawUrl) || "" : "";
  }
  dispose() {
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
  applyPlaylistCache(entry) {
    this.setState({
      activePlaylist: entry.playlist,
      activeTracks: [...entry.tracks],
      playlistOffset: entry.playlistOffset,
      hasMoreTracks: entry.hasMoreTracks
    });
  }
  rememberPlaylist(playlist, tracks, hasMoreTracks) {
    if (this.playlistCache.size >= MAX_PLAYLIST_CACHE_SIZE && !this.playlistCache.has(playlist.id)) {
      const firstKey = this.playlistCache.keys().next().value;
      if (firstKey) this.playlistCache.delete(firstKey);
    }
    const entry = {
      playlist,
      tracks: [...tracks],
      playlistOffset: tracks.length,
      hasMoreTracks,
      loadedAt: Date.now()
    };
    this.playlistCache.set(playlist.id, entry);
    this.rememberPersistedPlaylist(entry);
    this.scheduleSaveConfig();
    return entry;
  }
  applyDataCacheForUser(userId) {
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
    const patch = {};
    if (this.dataCache.userPlaylists) patch.userPlaylists = [...this.dataCache.userPlaylists.value];
    if (this.dataCache.topPlaylists) patch.topPlaylists = [...this.dataCache.topPlaylists.value];
    if (this.dataCache.discoverPlaylists) patch.discoverPlaylists = [...this.dataCache.discoverPlaylists.value];
    if (this.dataCache.recommendSongs) patch.recommendSongs = [...this.dataCache.recommendSongs.value];
    if (Object.keys(patch).length) this.setState(patch);
  }
  applyCachedList(key, cached) {
    if (!cached || !Array.isArray(cached.value)) return false;
    this.setState({ [key]: [...cached.value] });
    return true;
  }
  rememberCachedList(key, value) {
    this.ensureDataCacheUser();
    this.dataCache[key] = {
      value: [...value],
      loadedAt: Date.now()
    };
    this.scheduleSaveConfig();
  }
  rememberPersistedPlaylist(entry) {
    this.ensureDataCacheUser();
    const tracks = entry.tracks.slice(0, MAX_PERSISTED_PLAYLIST_TRACKS);
    const persisted = {
      playlist: entry.playlist,
      tracks,
      playlistOffset: tracks.length,
      hasMoreTracks: entry.hasMoreTracks || entry.tracks.length > tracks.length,
      loadedAt: entry.loadedAt
    };
    this.dataCache.playlistEntries = [
      persisted,
      ...this.dataCache.playlistEntries.filter((item) => item.playlist.id !== entry.playlist.id)
    ].slice(0, MAX_PLAYLIST_CACHE_SIZE);
  }
  rememberPersistedCover(rawUrl, proxiedUrl) {
    if (!rawUrl || !proxiedUrl) return;
    this.ensureDataCacheUser();
    const entry = {
      rawUrl,
      proxiedUrl,
      loadedAt: Date.now()
    };
    this.dataCache.coverEntries = [
      entry,
      ...this.dataCache.coverEntries.filter((item) => item.rawUrl !== rawUrl)
    ].slice(0, MAX_COVER_CACHE_SIZE);
  }
  pumpCoverQueue() {
    const sdk = this.sdk;
    if (!sdk) return;
    while (this.activeCoverRequests < MAX_ACTIVE_COVER_REQUESTS && this.coverQueue.length) {
      const task = this.coverQueue.shift();
      if (!task) return;
      this.activeCoverRequests += 1;
      sdk.music.coverProxyUrl(task.rawUrl).catch(() => task.rawUrl).then((proxied) => {
        this.coverCache.set(task.rawUrl, proxied);
        this.rememberPersistedCover(task.rawUrl, proxied);
        this.scheduleSaveConfig();
        task.resolve(proxied);
      }).catch((error) => {
        task.reject(error);
      }).finally(() => {
        this.activeCoverRequests = Math.max(0, this.activeCoverRequests - 1);
        this.coverRequestCache.delete(task.rawUrl);
        this.pumpCoverQueue();
      });
    }
  }
  restoreMemoryCachesFromDataCache() {
    this.playlistCache.clear();
    for (const entry of this.dataCache.playlistEntries) {
      this.playlistCache.set(entry.playlist.id, {
        playlist: entry.playlist,
        tracks: [...entry.tracks],
        playlistOffset: entry.playlistOffset,
        hasMoreTracks: entry.hasMoreTracks,
        loadedAt: entry.loadedAt
      });
    }
    this.coverCache.clear();
    const now = Date.now();
    this.dataCache.coverEntries = this.dataCache.coverEntries.filter((entry) => now - entry.loadedAt <= COVER_CACHE_TTL_MS).slice(0, MAX_COVER_CACHE_SIZE);
    for (const entry of this.dataCache.coverEntries) {
      this.coverCache.set(entry.rawUrl, entry.proxiedUrl);
    }
  }
  clearPersistentDataCache() {
    const userId = this.dataCache.userId;
    this.dataCache = createEmptyDataCache(userId);
  }
  clearPersistentPlaylistData() {
    this.dataCache.userPlaylists = null;
    this.dataCache.topPlaylists = null;
    this.dataCache.discoverPlaylists = null;
    this.dataCache.recommendSongs = null;
    this.dataCache.playlistEntries = [];
  }
  ensureDataCacheUser() {
    const userId = this.state.loginInfo?.user_id || this.dataCache.userId || "";
    if (this.dataCache.userId && userId && this.dataCache.userId !== userId) {
      this.dataCache = createEmptyDataCache(userId);
      this.playlistCache.clear();
      return;
    }
    if (userId && !this.dataCache.userId) this.dataCache.userId = userId;
  }
  async startSong(song, queue, index, automatic, startAt = 0) {
    const sdk = this.requireSdk();
    const request = ++this.requestSeq;
    this.setState({ loading: "song", error: null });
    try {
      const result = await sdk.music.songUrl(song.id, this.state.quality);
      if (request !== this.requestSeq) return;
      if (!result.playable || !result.url) {
        const message = friendlyErrorMessage(result.message || result.reason || "\u5F53\u524D\u8D26\u53F7\u65E0\u6CD5\u64AD\u653E\u8FD9\u9996\u6B4C");
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
        song.cover ? this.coverProxyUrl(song.cover) : Promise.resolve("")
      ]);
      if (request !== this.requestSeq) return;
      if (!automatic) this.consecutiveSkips = 0;
      this.audio.src = audioUrl;
      this.audio.volume = this.state.volume;
      this.audio.muted = this.state.muted;
      const resumeTime = clampPlaybackTime(startAt, song.duration ? song.duration / 1e3 : 0);
      if (resumeTime > 0) {
        try {
          this.audio.currentTime = resumeTime;
        } catch {
        }
      }
      await this.audio.play();
      this.consecutiveSkips = 0;
      this.setState({
        currentSong: song,
        currentCoverUrl: coverUrl,
        isPlaying: true,
        currentTime: resumeTime,
        duration: song.duration ? song.duration / 1e3 : 0,
        queue: [...queue],
        currentIndex: index,
        trial: result.trial,
        lyrics: [],
        lyricStatus: "loading",
        loading: null
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
  async loadLyrics(songId, request) {
    const sdk = this.requireSdk();
    try {
      const lyrics = await sdk.music.lyric(songId);
      if (request !== this.requestSeq || this.state.currentSong?.id !== songId) return;
      const lines = parseLrc(lyrics.lyric, lyrics.translation);
      this.setState({
        lyrics: lines,
        lyricStatus: lines.length ? "ready" : isInstrumentalLyric(lyrics.lyric) ? "instrumental" : "empty"
      });
    } catch {
      if (request === this.requestSeq) this.setState({ lyrics: [], lyricStatus: "empty" });
    }
  }
  async skipUnavailable(message) {
    this.consecutiveSkips += 1;
    const safeMessage = friendlyErrorMessage(message || "\u64AD\u653E\u5931\u8D25\uFF0C\u5DF2\u5C1D\u8BD5\u4E0B\u4E00\u9996").replace("\u53EF\u5C1D\u8BD5\u4E0B\u4E00\u9996", "\u5DF2\u5C1D\u8BD5\u4E0B\u4E00\u9996");
    if (this.consecutiveSkips >= 5) {
      this.notify("\u961F\u5217\u4E2D\u591A\u9996\u6B4C\u66F2\u4E0D\u53EF\u64AD\u653E\uFF0C\u5DF2\u505C\u6B62\u81EA\u52A8\u8DF3\u8FC7");
      this.stopAudio();
      this.setState({ error: safeMessage, isPlaying: false });
      return;
    }
    this.setState({ error: safeMessage });
    if (this.consecutiveSkips === 1) this.notify(safeMessage);
    await this.nextTrack(true);
  }
  async loadConfig() {
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
      duration: config.lastPlayback?.duration || (restoredSong?.duration ? restoredSong.duration / 1e3 : 0),
      queue: restoredSong ? [restoredSong] : [],
      currentIndex: restoredSong ? 0 : -1,
      isPlaying: false,
      trial: false,
      lyrics: [],
      lyricStatus: "idle"
    });
    if (restoredSong?.cover) {
      const coverUrl = await this.coverProxyUrl(restoredSong.cover);
      if (this.state.currentSong?.id === restoredSong.id) this.setState({ currentCoverUrl: coverUrl });
    }
  }
  async saveConfig() {
    const sdk = this.sdk;
    if (!sdk) return;
    await sdk.storage.set({
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
      dataCache: this.dataCache
    }).catch(() => void 0);
  }
  scheduleSaveConfig() {
    if (this.configSaveTimer !== null) window.clearTimeout(this.configSaveTimer);
    this.configSaveTimer = window.setTimeout(() => {
      this.configSaveTimer = null;
      void this.saveConfig();
    }, CONFIG_SAVE_DEBOUNCE_MS);
  }
  rememberRecentSong(song) {
    const recentSongs = [song, ...this.state.recentSongs.filter((item) => item.id !== song.id)].slice(0, 30);
    this.setState({ recentSongs });
    void this.saveConfig();
  }
  rememberSearchKeyword(keyword) {
    const value = keyword.trim();
    if (!value) return;
    const searchHistory = [value, ...this.state.searchHistory.filter((item) => item !== value)].slice(0, 12);
    this.setState({ searchHistory });
    void this.saveConfig();
  }
  rememberPlaybackPosition(force = false) {
    const song = this.state.currentSong;
    if (!song) return;
    const now = Date.now();
    if (!force && now - this.lastPlaybackSaveAt < PLAYBACK_SAVE_INTERVAL_MS) return;
    this.lastPlaybackSaveAt = now;
    const duration = Number.isFinite(this.state.duration) && this.state.duration > 0 ? this.state.duration : song.duration ? song.duration / 1e3 : 0;
    const currentTime = clampPlaybackTime(this.state.currentTime, duration);
    this.setState({
      lastPlayback: {
        song,
        currentTime,
        duration,
        updatedAt: now
      }
    });
    void this.saveConfig();
  }
  bindAudio() {
    if (this.audioBound) return;
    this.audio.addEventListener("timeupdate", this.handleTimeUpdate);
    this.audio.addEventListener("loadedmetadata", this.handleLoadedMetadata);
    this.audio.addEventListener("ended", this.handleEnded);
    this.audio.addEventListener("error", this.handleAudioError);
    this.audioBound = true;
  }
  unbindAudio() {
    if (!this.audioBound) return;
    this.audio.removeEventListener("timeupdate", this.handleTimeUpdate);
    this.audio.removeEventListener("loadedmetadata", this.handleLoadedMetadata);
    this.audio.removeEventListener("ended", this.handleEnded);
    this.audio.removeEventListener("error", this.handleAudioError);
    this.audioBound = false;
  }
  handleTimeUpdate = () => {
    this.setState({ currentTime: this.audio.currentTime });
    this.rememberPlaybackPosition(false);
  };
  handleLoadedMetadata = () => {
    if (Number.isFinite(this.audio.duration)) {
      this.setState({ duration: this.audio.duration });
      this.rememberPlaybackPosition(true);
    }
  };
  handleEnded = () => {
    this.rememberPlaybackPosition(true);
    if (this.state.playMode === "one" && this.state.currentSong) {
      void this.startSong(this.state.currentSong, this.state.queue, this.state.currentIndex, true);
    } else {
      void this.nextTrack(true);
    }
  };
  handleAudioError = () => {
    if (!this.audio.src) return;
    this.setState({ error: "\u64AD\u653E\u5931\u8D25\uFF0C\u53EF\u5C1D\u8BD5\u4E0B\u4E00\u9996", isPlaying: false });
  };
  stopAudio() {
    this.rememberPlaybackPosition(true);
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.setState({ isPlaying: false, currentTime: 0 });
  }
  startLoginPolling() {
    this.stopLoginPolling();
    let attempts = 0;
    this.loginPollTimer = window.setInterval(() => {
      attempts += 1;
      void this.refreshLoginStatus();
      if (attempts >= 150 || this.state.loginInfo?.logged_in) this.stopLoginPolling();
    }, 2e3);
  }
  stopLoginPolling() {
    if (this.loginPollTimer !== null) {
      window.clearInterval(this.loginPollTimer);
      this.loginPollTimer = null;
    }
  }
  setError(error) {
    const message = this.errorMessage(error);
    this.setState({ error: message, loading: null });
    this.notify(message);
  }
  errorMessage(error) {
    const raw = error instanceof Error ? error.message : String(error);
    return friendlyErrorMessage(raw);
  }
  notify(message) {
    const now = Date.now();
    if (message === this.lastNotifyMessage && now - this.lastNotifyAt < NOTIFY_DEDUPE_MS) return;
    this.lastNotifyMessage = message;
    this.lastNotifyAt = now;
    this.sdk?.ui.notify(message);
  }
  requireSdk() {
    if (!this.sdk) throw new Error("Music runtime is not initialized");
    return this.sdk;
  }
};
function normalizeConfig(raw) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_CONFIG, dataCache: createEmptyDataCache() };
  const data = raw;
  return {
    volume: typeof data.volume === "number" ? Math.max(0, Math.min(1, data.volume)) : DEFAULT_CONFIG.volume,
    muted: typeof data.muted === "boolean" ? data.muted : DEFAULT_CONFIG.muted,
    playMode: isPlayMode(data.playMode) ? data.playMode : DEFAULT_CONFIG.playMode,
    quality: isQuality(data.quality) ? data.quality : DEFAULT_CONFIG.quality,
    recentSongs: Array.isArray(data.recentSongs) ? data.recentSongs.filter(isSong).slice(0, 30) : DEFAULT_CONFIG.recentSongs,
    searchHistory: Array.isArray(data.searchHistory) ? data.searchHistory.filter((item) => typeof item === "string" && Boolean(item.trim())).slice(0, 12) : DEFAULT_CONFIG.searchHistory,
    lyricFontSize: isLyricFontSize(data.lyricFontSize) ? data.lyricFontSize : DEFAULT_CONFIG.lyricFontSize,
    showLyricTranslation: typeof data.showLyricTranslation === "boolean" ? data.showLyricTranslation : DEFAULT_CONFIG.showLyricTranslation,
    showCoverBackground: typeof data.showCoverBackground === "boolean" ? data.showCoverBackground : DEFAULT_CONFIG.showCoverBackground,
    keyboardShortcutsEnabled: typeof data.keyboardShortcutsEnabled === "boolean" ? data.keyboardShortcutsEnabled : DEFAULT_CONFIG.keyboardShortcutsEnabled,
    lastPlayback: isLastPlayback(data.lastPlayback) ? data.lastPlayback : DEFAULT_CONFIG.lastPlayback,
    dataCache: normalizeDataCache(data.dataCache)
  };
}
function createEmptyDataCache(userId = "") {
  return {
    schemaVersion: DATA_CACHE_SCHEMA_VERSION,
    userId,
    userPlaylists: null,
    topPlaylists: null,
    discoverPlaylists: null,
    recommendSongs: null,
    coverEntries: [],
    playlistEntries: []
  };
}
function cloneDataCache(cache) {
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
      loadedAt: entry.loadedAt
    }))
  };
}
function cloneCachedValue(cache) {
  return cache ? { value: [...cache.value], loadedAt: cache.loadedAt } : null;
}
function uniquePlaylists(playlists) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const playlist of playlists) {
    if (seen.has(playlist.id)) continue;
    seen.add(playlist.id);
    result.push(playlist);
  }
  return result;
}
function rotatePlaylists(playlists, offset) {
  if (!playlists.length) return [];
  const start = Math.abs(offset) % playlists.length;
  return [...playlists.slice(start), ...playlists.slice(0, start)];
}
function normalizeDataCache(value) {
  if (!value || typeof value !== "object") return createEmptyDataCache();
  const cache = value;
  if (cache.schemaVersion !== DATA_CACHE_SCHEMA_VERSION) return createEmptyDataCache(typeof cache.userId === "string" ? cache.userId : "");
  const userId = typeof cache.userId === "string" ? cache.userId : "";
  return {
    schemaVersion: DATA_CACHE_SCHEMA_VERSION,
    userId,
    userPlaylists: normalizeCachedArray(cache.userPlaylists, isPlaylist, 200),
    topPlaylists: normalizeCachedArray(cache.topPlaylists, isPlaylist, 100),
    discoverPlaylists: normalizeCachedArray(cache.discoverPlaylists, isPlaylist, 100),
    recommendSongs: normalizeCachedArray(cache.recommendSongs, isSong, 100),
    coverEntries: Array.isArray(cache.coverEntries) ? cache.coverEntries.filter(isPersistedCoverCacheEntry).slice(0, MAX_COVER_CACHE_SIZE) : [],
    playlistEntries: Array.isArray(cache.playlistEntries) ? cache.playlistEntries.filter(isPersistedPlaylistCacheEntry).slice(0, MAX_PLAYLIST_CACHE_SIZE) : []
  };
}
function normalizeCachedArray(value, guard, limit) {
  if (!value || typeof value !== "object") return null;
  const cache = value;
  if (!Array.isArray(cache.value) || typeof cache.loadedAt !== "number" || !Number.isFinite(cache.loadedAt)) return null;
  return {
    value: cache.value.filter(guard).slice(0, limit),
    loadedAt: cache.loadedAt
  };
}
function isPlayMode(value) {
  return value === "list" || value === "shuffle" || value === "one";
}
function isQuality(value) {
  return value === "hires" || value === "lossless" || value === "exhigh" || value === "standard";
}
function isLyricFontSize(value) {
  return value === "compact" || value === "normal" || value === "large";
}
function isInstrumentalLyric(value) {
  return /纯音乐|instrumental/i.test(value || "");
}
function normalizeMediaName(value) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}
function isSong(value) {
  if (!value || typeof value !== "object") return false;
  const song = value;
  return typeof song.id === "string" && typeof song.name === "string";
}
function isPlaylist(value) {
  if (!value || typeof value !== "object") return false;
  const playlist = value;
  return typeof playlist.id === "string" && typeof playlist.name === "string";
}
function isPersistedPlaylistCacheEntry(value) {
  if (!value || typeof value !== "object") return false;
  const entry = value;
  return isPlaylist(entry.playlist) && Array.isArray(entry.tracks) && entry.tracks.every(isSong) && typeof entry.playlistOffset === "number" && Number.isFinite(entry.playlistOffset) && typeof entry.hasMoreTracks === "boolean" && typeof entry.loadedAt === "number" && Number.isFinite(entry.loadedAt);
}
function isPersistedCoverCacheEntry(value) {
  if (!value || typeof value !== "object") return false;
  const entry = value;
  return typeof entry.rawUrl === "string" && typeof entry.proxiedUrl === "string" && typeof entry.loadedAt === "number" && Number.isFinite(entry.loadedAt);
}
function isLastPlayback(value) {
  if (!value || typeof value !== "object") return false;
  const playback = value;
  return isSong(playback.song) && typeof playback.currentTime === "number" && Number.isFinite(playback.currentTime) && typeof playback.duration === "number" && Number.isFinite(playback.duration);
}
function clampPlaybackTime(currentTime, duration) {
  if (!Number.isFinite(currentTime) || currentTime < 0) return 0;
  if (!Number.isFinite(duration) || duration <= 0) return Math.max(0, currentTime);
  if (duration <= 12) return 0;
  return Math.max(0, Math.min(currentTime, Math.max(0, duration - 3)));
}
function isMediaPlaybackError(message) {
  const lower = message.toLowerCase();
  return lower.includes("no supported source") || lower.includes("not supported") || lower.includes("src_not_supported") || lower.includes("media resource") || lower.includes("media element") || message.includes("\u97F3\u6E90") || message.includes("\u64AD\u653E\u5931\u8D25");
}
function isPlayInterruptedError(message) {
  const lower = message.toLowerCase();
  return lower.includes("interrupted by a call to pause") || lower.includes("interrupted by a new load request") || lower.includes("the play() request was interrupted");
}
function friendlyErrorMessage(raw) {
  const message = (raw || "").trim();
  const lower = message.toLowerCase();
  if (!message || message === "undefined" || message === "null") return "\u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5";
  if (isPlayInterruptedError(message)) {
    return "\u64AD\u653E\u5DF2\u4E2D\u65AD";
  }
  if (isMediaPlaybackError(message)) {
    return "\u64AD\u653E\u5931\u8D25\uFF0C\u53EF\u5C1D\u8BD5\u4E0B\u4E00\u9996";
  }
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("timeout") || message.includes("\u8D85\u65F6") || message.includes("\u7F51\u7EDC")) {
    return "\u7F51\u7EDC\u8FDE\u63A5\u4E0D\u7A33\u5B9A\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u540E\u91CD\u8BD5";
  }
  if (message.includes("\u4E8C\u7EF4\u7801\u5DF2\u8FC7\u671F") || lower.includes("qrcode expired") || message === "800") {
    return "\u4E8C\u7EF4\u7801\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u65B0\u626B\u7801";
  }
  if (message.includes("\u7B49\u5F85\u626B\u7801") || lower.includes("waiting scan") || message === "801") {
    return "\u8BF7\u4F7F\u7528\u7F51\u6613\u4E91\u97F3\u4E50 App \u626B\u7801\u767B\u5F55";
  }
  if (message.includes("\u5DF2\u626B\u7801") || message.includes("\u5F85\u786E\u8BA4") || lower.includes("waiting confirm") || message === "802") {
    return "\u5DF2\u626B\u7801\uFF0C\u8BF7\u5728\u624B\u673A\u4E0A\u786E\u8BA4\u767B\u5F55";
  }
  if (message.includes("\u9A8C\u8BC1\u7801") || lower.includes("captcha")) {
    if (message.includes("\u9891\u7E41") || message.includes("\u592A\u591A") || lower.includes("frequent") || lower.includes("rate")) {
      return "\u9A8C\u8BC1\u7801\u8BF7\u6C42\u592A\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5";
    }
    if (message.includes("\u9519\u8BEF") || message.includes("\u4E0D\u6B63\u786E") || lower.includes("invalid")) {
      return "\u9A8C\u8BC1\u7801\u9519\u8BEF\uFF0C\u8BF7\u68C0\u67E5\u540E\u91CD\u65B0\u8F93\u5165";
    }
    return message.length > 80 ? `${message.slice(0, 80)}...` : message;
  }
  if (lower.includes("rate") || message.includes("\u9891\u7E41") || message.includes("\u9650\u6D41")) {
    return "\u8BF7\u6C42\u592A\u9891\u7E41\u4E86\uFF0C\u8BF7\u7A0D\u7B49\u7247\u523B\u518D\u8BD5";
  }
  if (lower.includes("login") || message.includes("\u767B\u5F55") || message.includes("\u8D26\u53F7")) {
    return "\u7F51\u6613\u4E91\u8D26\u53F7\u72B6\u6001\u5F02\u5E38\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55\u540E\u518D\u8BD5";
  }
  if (message.includes("\u4F1A\u5458") || lower.includes("vip") || lower.includes("fee")) {
    return "\u5F53\u524D\u6B4C\u66F2\u9700\u8981\u4F1A\u5458\u6743\u9650\uFF0C\u53EF\u5C1D\u8BD5\u64AD\u653E\u8BD5\u542C\u7247\u6BB5\u6216\u5207\u6362\u6B4C\u66F2";
  }
  if (message.includes("\u7248\u6743") || message.includes("\u4E0B\u67B6") || lower.includes("copyright") || lower.includes("unavailable")) {
    return "\u5F53\u524D\u6B4C\u66F2\u6682\u65F6\u4E0D\u53EF\u64AD\u653E\uFF0C\u53EF\u80FD\u662F\u7248\u6743\u6216\u5730\u533A\u9650\u5236";
  }
  return message.length > 80 ? `${message.slice(0, 80)}...` : message;
}
var runtime = new MusicRuntime();

// src/styles.ts
var cssText = `
.netease-shell {
  --nm-accent: var(--accent, #ff4d4f);
  --nm-bg: color-mix(in srgb, var(--background, #151820) 78%, var(--card, #272b36));
  --nm-surface: color-mix(in srgb, var(--card, #272b36) 82%, white);
  --nm-card: color-mix(in srgb, var(--nm-surface) 76%, transparent);
  --nm-card-solid: color-mix(in srgb, var(--nm-surface) 92%, var(--background, #151820));
  --nm-elevated: color-mix(in srgb, var(--nm-surface) 84%, white);
  --nm-border: color-mix(in srgb, var(--border, #ffffff) 58%, transparent);
  --nm-soft-border: color-mix(in srgb, var(--border, #ffffff) 36%, transparent);
  --nm-text: var(--foreground, #f6f7fb);
  --nm-muted: var(--muted-foreground, #a8adbd);
  --nm-ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --nm-spring: cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
  position: relative;
  height: min(840px, 100%);
  min-height: 0;
  padding: 16px;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 14px;
  overflow: hidden;
  color: var(--nm-text);
  background-color: var(--nm-bg);
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
  border-radius: 8px;
  animation: nmShellIn 360ms var(--nm-spring);
}
.netease-shell *,
.netease-shell *::before,
.netease-shell *::after {
  box-sizing: border-box;
  letter-spacing: 0;
}
.nm-page-backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 18% 8%, color-mix(in srgb, var(--nm-accent) 18%, transparent), transparent 34%),
    radial-gradient(circle at 86% 16%, color-mix(in srgb, #5ed9c8 16%, transparent), transparent 32%),
    linear-gradient(120deg, color-mix(in srgb, var(--background, #151820) 74%, transparent), color-mix(in srgb, var(--card, #272b36) 38%, transparent) 46%, color-mix(in srgb, var(--background, #151820) 72%, transparent)),
    linear-gradient(0deg, color-mix(in srgb, var(--background, #151820) 52%, transparent), transparent 52%, color-mix(in srgb, var(--background, #151820) 42%, transparent));
  pointer-events: none;
  transition: opacity 360ms var(--nm-ease), filter 520ms var(--nm-ease);
  animation: nmBackdropDrift 18s ease-in-out infinite alternate;
}
.nm-has-cover .nm-page-backdrop {
  backdrop-filter: blur(24px) saturate(128%);
  -webkit-backdrop-filter: blur(24px) saturate(128%);
}
.nm-playing .nm-page-backdrop {
  filter: saturate(112%);
}
.app-plugin-page-top-nav .netease-shell {
  height: min(840px, calc(100% + 72px));
  margin-top: -72px;
  padding-top: 88px;
}
.app-plugin-page-bottom-nav .netease-shell {
  height: min(840px, calc(100% + 72px));
  margin-bottom: -72px;
  padding-bottom: 88px;
}
.nm-topbar,
.nm-main-grid,
.nm-main-surface,
.nm-player-bar,
.nm-expanded-content {
  position: relative;
  z-index: 1;
}
.nm-page-backdrop,
.nm-topbar,
.nm-main-grid,
.nm-main-surface,
.nm-player-bar {
  transition: filter 260ms var(--nm-ease), opacity 260ms var(--nm-ease);
}
.nm-expanded-active > .nm-page-backdrop,
.nm-expanded-active > .nm-topbar,
.nm-expanded-active > .nm-main-grid,
.nm-expanded-active > .nm-main-surface,
.nm-expanded-active > .nm-player-bar {
  filter: blur(14px) saturate(110%);
}
.nm-expanded-active > .nm-topbar,
.nm-expanded-active > .nm-main-grid,
.nm-expanded-active > .nm-main-surface,
.nm-expanded-active > .nm-player-bar {
  opacity: 0.78;
}
.nm-topbar {
  z-index: 20;
  min-height: 58px;
  display: grid;
  grid-template-columns: max-content max-content minmax(260px, 1fr);
  align-items: center;
  gap: 16px;
  animation: nmSlideIn 340ms var(--nm-spring) 40ms backwards;
}
.nm-brand {
  width: 190px;
  min-width: 190px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.nm-brand > span:last-child {
  min-width: 0;
}
.nm-brand strong {
  display: block;
  max-width: 124px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 20px;
  line-height: 1.15;
}
.nm-top-nav {
  min-width: max-content;
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--nm-soft-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--nm-elevated) 54%, transparent);
  backdrop-filter: blur(16px) saturate(124%);
  -webkit-backdrop-filter: blur(16px) saturate(124%);
  overflow-x: auto;
}
.nm-top-nav-button {
  min-height: 32px;
  padding: 0 10px !important;
  gap: 5px;
  white-space: nowrap;
  font-size: 12px !important;
  transition: transform 160ms var(--nm-spring), background 180ms var(--nm-ease), color 160ms var(--nm-ease);
}
.nm-top-nav-button:hover {
  transform: translateY(-1px);
}
.nm-topbar-right {
  min-width: 0;
  width: 100%;
  max-width: 230px;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  justify-self: end;
}
.nm-top-search {
  position: relative;
  min-width: 0;
  width: 100%;
  padding: 6px;
  animation-delay: 80ms;
}
.nm-search-suggest {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 200;
  width: 100%;
  padding: 7px;
  border: 1px solid var(--nm-border);
  border-radius: 8px;
  background: #f8fafc;
  color: var(--nm-text);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 12%, transparent),
    0 18px 42px rgba(0, 0, 0, 0.24);
  display: grid;
  gap: 4px;
  animation: nmContextIn 140ms var(--nm-spring) both;
}
.dark .nm-search-suggest {
  background: #171b24;
}
.nm-search-suggest-head {
  min-width: 0;
  padding: 2px 4px 4px 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.nm-search-suggest-title {
  color: var(--nm-muted);
  font-size: 11px;
}
.nm-search-clear-history {
  padding: 0;
  border: 0;
  background: transparent;
  color: color-mix(in srgb, var(--nm-accent) 82%, var(--nm-text));
  font-size: 11px;
  cursor: pointer;
}
.nm-search-clear-history:hover {
  text-decoration: underline;
}
.nm-search-suggest-empty {
  min-height: 30px;
  padding: 0 8px;
  color: var(--nm-muted);
  display: inline-flex;
  align-items: center;
  font-size: 12px;
}
.nm-search-suggest-item {
  width: 100%;
  min-height: 32px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  text-align: left;
  cursor: pointer;
  transition: background 140ms var(--nm-ease), transform 140ms var(--nm-spring);
}
.nm-search-suggest-item:hover {
  background: color-mix(in srgb, var(--nm-accent) 12%, transparent);
  transform: translateX(2px);
}
.nm-search-suggest-item span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}
.nm-search-suggest-item small {
  color: var(--nm-muted);
  font-size: 11px;
}
.nm-mark,
.nm-empty-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--nm-accent) 92%, white), color-mix(in srgb, var(--nm-accent) 62%, #111827));
  color: white;
  box-shadow: 0 10px 24px color-mix(in srgb, var(--nm-accent) 30%, transparent);
  flex: 0 0 auto;
  transition: transform 180ms var(--nm-ease), box-shadow 220ms var(--nm-ease);
}
.nm-brand:hover .nm-mark,
.nm-empty:hover .nm-empty-icon {
  transform: translateY(-1px) scale(1.03);
  box-shadow: 0 14px 30px color-mix(in srgb, var(--nm-accent) 34%, transparent);
}
.nm-kicker {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--nm-muted);
  font-size: 11px;
  line-height: 1.2;
  text-transform: uppercase;
}
.nm-account-panel {
  width: max-content;
  max-width: 224px;
  min-width: 0;
  justify-self: end;
  padding: 7px 8px;
  display: grid;
  grid-template-columns: 36px minmax(74px, max-content) 30px;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  border: 1px solid var(--nm-soft-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--nm-elevated) 72%, transparent);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transition: border-color 180ms var(--nm-ease), background 220ms var(--nm-ease), transform 180ms var(--nm-ease);
  animation: nmFadeIn 300ms var(--nm-ease) 90ms both;
}
.nm-topbar > .nm-account-panel {
  justify-self: start;
}
.nm-account-panel:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--nm-accent) 28%, var(--nm-soft-border));
}
.nm-account-logout {
  width: 30px;
  height: 30px;
  min-width: 30px;
  padding: 0 !important;
  justify-self: end;
}
.nm-account-copy,
.nm-head-copy,
.nm-row-copy,
.nm-now-brief > span {
  min-width: 0;
}
.nm-account-copy {
  max-width: 112px;
}
.nm-head-actions {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}
.nm-head-title-row {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.nm-title-count {
  flex: 0 0 auto;
}
.nm-head-left {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.nm-charts-head .nm-head-actions {
  margin-right: 20px;
}
.nm-account-copy strong,
.nm-title,
.nm-now-brief strong,
.nm-player-main strong {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 760;
}
.nm-account-copy small,
.nm-sub,
.nm-duration,
.nm-count,
.nm-now-brief small,
.nm-player-main small {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--nm-muted);
  font-size: 12px;
}
.nm-avatar,
.nm-row-cover,
.nm-mini-cover {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  object-fit: cover;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--nm-accent) 24%, var(--muted, #323744)), color-mix(in srgb, #5ed9c8 18%, var(--muted, #323744)));
  color: color-mix(in srgb, var(--nm-accent) 64%, white);
  flex: 0 0 auto;
  transition: transform 220ms var(--nm-spring), box-shadow 220ms var(--nm-ease), filter 220ms var(--nm-ease);
}
.nm-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
}
.nm-icon-button,
.nm-search-button,
.nm-control-button,
.nm-mode-button,
.nm-settings-button {
  width: 34px;
  height: 34px;
  padding: 0 !important;
}
.nm-main-grid {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(340px, 1fr) minmax(340px, 1fr);
  gap: 14px;
}
.nm-main-surface {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  animation: nmCardIn 360ms var(--nm-spring) 90ms backwards;
}
.nm-discovery-column {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
}
.nm-card,
.nm-player-bar,
.nm-empty {
  border: 1px solid var(--nm-border);
  border-radius: 8px;
  background: var(--nm-card);
  backdrop-filter: blur(18px) saturate(132%);
  -webkit-backdrop-filter: blur(18px) saturate(132%);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 12%, transparent),
    0 18px 44px rgba(0, 0, 0, 0.16);
  transition: border-color 220ms var(--nm-ease), background 260ms var(--nm-ease), box-shadow 260ms var(--nm-ease), transform 220ms var(--nm-ease);
}
.nm-card {
  min-width: 0;
  min-height: 0;
  padding: 12px;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 10px;
  overflow: hidden;
  animation: nmCardIn 360ms var(--nm-spring) backwards;
}
.nm-page-card {
  width: 100%;
  height: 100%;
  grid-template-rows: auto minmax(0, 1fr);
}
.nm-list-page {
  max-width: 1120px;
  margin: 0 auto;
}
.nm-home-stack {
  width: min(1120px, 100%);
  height: 100%;
  margin: 0 auto;
  padding: 10px 14px 16px 12px;
  overflow: auto;
  scroll-padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.nm-home-hero {
  flex: 0 0 auto;
  min-height: 132px;
  padding: 20px;
  border: 1px solid var(--nm-border);
  border-radius: 8px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--nm-accent) 20%, var(--nm-elevated)), color-mix(in srgb, #5ed9c8 10%, var(--nm-card)) 48%, color-mix(in srgb, var(--nm-card-solid) 74%, transparent));
  backdrop-filter: blur(18px) saturate(132%);
  -webkit-backdrop-filter: blur(18px) saturate(132%);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 18px;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 12%, transparent),
    0 18px 44px rgba(0, 0, 0, 0.14);
}
.nm-home-hero-copy {
  min-width: 0;
}
.nm-home-hero-copy strong {
  display: block;
  margin-top: 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: clamp(24px, 3vw, 38px);
  line-height: 1.08;
}
.nm-home-hero-copy > span:last-child {
  display: block;
  margin-top: 8px;
  color: var(--nm-muted);
  font-size: 13px;
}
.nm-home-hero-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}
.nm-home-section {
  flex: 0 0 auto;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--nm-soft-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--nm-elevated) 62%, transparent);
  backdrop-filter: blur(16px) saturate(124%);
  -webkit-backdrop-filter: blur(16px) saturate(124%);
  display: grid;
  gap: 10px;
  transition: border-color 180ms var(--nm-ease), background 220ms var(--nm-ease), transform 180ms var(--nm-ease);
}
.nm-home-section:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--nm-accent) 24%, var(--nm-soft-border));
}
.nm-discover-title {
  flex: 0 0 auto;
  min-width: 0;
  padding: 2px 2px 0;
  animation: nmFadeUp 280ms var(--nm-spring) 40ms both;
}
.nm-discover-title strong {
  display: block;
  font-size: 20px;
  line-height: 1.15;
}
.nm-discover-list-search {
  width: min(310px, calc(100vw - 96px));
  grid-template-columns: minmax(0, 230px) auto auto;
  justify-self: end;
}
.nm-discover-stack .nm-home-section {
  animation: nmCardIn 340ms var(--nm-spring) both;
}
.nm-discover-stack .nm-home-section:nth-of-type(1) {
  animation-delay: 80ms;
}
.nm-discover-stack .nm-home-section:nth-of-type(2) {
  animation-delay: 130ms;
}
.nm-discover-stack .nm-home-section:nth-of-type(3) {
  animation-delay: 180ms;
}
.nm-home-section-head {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.nm-home-section-head strong {
  display: block;
  font-size: 15px;
}
.nm-cover-strip {
  min-width: 0;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(132px, 148px);
  gap: 10px;
  overflow-x: auto;
  padding: 1px 2px 5px;
}
.nm-cover-card {
  min-width: 0;
  padding: 7px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  display: grid;
  gap: 6px;
  transition: background 180ms var(--nm-ease), border-color 180ms var(--nm-ease), transform 180ms var(--nm-spring), box-shadow 220ms var(--nm-ease);
}
.nm-cover-card:hover,
.nm-cover-card-active {
  background: color-mix(in srgb, var(--nm-accent) 12%, transparent);
  border-color: color-mix(in srgb, var(--nm-accent) 30%, transparent);
}
.nm-cover-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.12);
}
.nm-cover-card-image {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  object-fit: cover;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--nm-accent) 22%, var(--muted, #323744)), color-mix(in srgb, #5ed9c8 16%, var(--muted, #323744)));
}
.nm-cover-card strong,
.nm-cover-card small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nm-cover-card strong {
  font-size: 12px;
  line-height: 1.25;
}
.nm-cover-card small {
  color: var(--nm-muted);
  font-size: 11px;
}
.nm-song-strip {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 10px;
}
.nm-song-tile {
  min-width: 0;
  min-height: 50px;
  padding: 6px 7px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  transition: background 180ms var(--nm-ease), border-color 180ms var(--nm-ease), transform 180ms var(--nm-spring);
}
.nm-song-tile:hover,
.nm-song-tile-active {
  background: color-mix(in srgb, var(--nm-accent) 12%, transparent);
  border-color: color-mix(in srgb, var(--nm-accent) 30%, transparent);
}
.nm-song-tile:hover {
  transform: translateX(2px);
}
.nm-song-tile-cover {
  width: 38px;
  height: 38px;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  object-fit: cover;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--nm-accent) 24%, var(--muted, #323744)), color-mix(in srgb, #5ed9c8 18%, var(--muted, #323744)));
}
.nm-song-tile-copy {
  min-width: 0;
}
.nm-song-tile-copy strong,
.nm-song-tile-copy small {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nm-song-tile-copy strong {
  font-size: 12px;
}
.nm-song-tile-copy small,
.nm-song-tile-duration {
  color: var(--nm-muted);
  font-size: 11px;
}
.nm-song-tile-duration {
  font-variant-numeric: tabular-nums;
}
.nm-home-empty {
  min-height: 52px;
  padding: 14px;
  border: 1px dashed var(--nm-soft-border);
  border-radius: 8px;
  color: var(--nm-muted);
  display: flex;
  align-items: center;
  font-size: 12px;
}
.nm-detail-page {
  gap: 12px;
}
.nm-detail-head {
  min-width: 0;
  min-height: 86px;
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}
.nm-detail-cover {
  width: 74px;
  height: 74px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  object-fit: cover;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--nm-accent) 22%, var(--muted, #323744)), color-mix(in srgb, #5ed9c8 16%, var(--muted, #323744)));
  box-shadow: 0 12px 26px rgba(0, 0, 0, 0.18);
}
.nm-detail-copy {
  min-width: 0;
}
.nm-detail-copy strong,
.nm-detail-copy small {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nm-detail-copy strong {
  margin-top: 3px;
  font-size: 22px;
}
.nm-detail-copy small {
  margin-top: 6px;
  color: var(--nm-muted);
  font-size: 12px;
}
.nm-media-detail-page {
  grid-template-rows: auto minmax(0, 1fr);
}
.nm-media-detail-body {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr);
}
.nm-media-detail-head {
  min-width: 0;
  min-height: 86px;
  padding: 0;
  display: grid;
  grid-template-columns: auto 74px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  overflow: hidden;
  animation: nmFadeIn 260ms var(--nm-ease) backwards;
}
.nm-media-back {
  align-self: center;
}
.nm-media-detail-cover {
  width: 74px;
  height: 74px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  object-fit: cover;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--nm-accent) 22%, var(--muted, #323744)), color-mix(in srgb, #5ed9c8 16%, var(--muted, #323744)));
  color: color-mix(in srgb, var(--nm-accent) 64%, white);
  box-shadow: 0 12px 26px rgba(0, 0, 0, 0.18);
}
.nm-media-detail-copy {
  min-width: 0;
  display: block;
}
.nm-media-detail-copy strong {
  display: block;
  margin-top: 3px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 22px;
  font-weight: 820;
}
.nm-media-meta-row {
  margin-top: 5px;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.nm-media-detail-copy .nm-media-meta-row > small {
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--nm-muted);
  font-size: 12px;
}
.nm-media-tabs {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.nm-media-tab {
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--nm-soft-border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--nm-elevated) 72%, transparent);
  color: inherit;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 760;
  transition: background 160ms var(--nm-ease), border-color 160ms var(--nm-ease), color 160ms var(--nm-ease), transform 160ms var(--nm-spring);
}
.nm-media-tab:hover {
  transform: translateY(-1px);
}
.nm-media-tab small {
  color: var(--nm-muted);
  font-size: 10px;
  font-weight: 800;
}
.nm-media-tab-active {
  border-color: color-mix(in srgb, var(--nm-accent) 42%, var(--nm-soft-border));
  background: color-mix(in srgb, var(--nm-accent) 16%, transparent);
  color: color-mix(in srgb, var(--nm-accent) 86%, var(--nm-text));
}
.nm-media-tab-active small {
  color: currentColor;
}
.nm-media-detail-actions {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.nm-media-detail-actions {
  justify-self: end;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.nm-related-strip {
  min-width: 0;
  min-height: 34px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  animation: nmFadeIn 220ms var(--nm-ease) both;
}
.nm-related-title {
  color: var(--nm-muted);
  font-size: 12px;
  white-space: nowrap;
}
.nm-related-items {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
}
.nm-related-chip {
  min-width: 0;
  max-width: 150px;
  height: 30px;
  padding: 0 8px 0 4px;
  border: 1px solid var(--nm-soft-border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--nm-elevated) 58%, transparent);
  color: inherit;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: background 160ms var(--nm-ease), border-color 160ms var(--nm-ease), transform 160ms var(--nm-spring);
}
.nm-related-chip:hover {
  border-color: color-mix(in srgb, var(--nm-accent) 34%, var(--nm-soft-border));
  background: color-mix(in srgb, var(--nm-accent) 10%, transparent);
  transform: translateY(-1px);
}
.nm-related-chip span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}
.nm-related-cover {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  object-fit: cover;
  flex: 0 0 auto;
}
.nm-library-card {
  animation-delay: 90ms;
}
.nm-discovery-card {
  animation-delay: 140ms;
}
.nm-card:hover {
  border-color: color-mix(in srgb, var(--nm-accent) 22%, var(--nm-border));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 14%, transparent),
    0 22px 52px rgba(0, 0, 0, 0.18);
}
.nm-card-head {
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  animation: nmFadeIn 280ms var(--nm-ease) both;
}
.nm-card-head strong {
  display: block;
  max-width: min(360px, 48vw);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
}
.nm-searchbar {
  min-width: 0;
  padding: 8px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  border: 1px solid var(--nm-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--nm-elevated) 74%, transparent);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  animation: nmSlideIn 320ms var(--nm-spring) 120ms backwards;
  transition: border-color 180ms var(--nm-ease), background 220ms var(--nm-ease), transform 180ms var(--nm-ease);
}
.nm-searchbar:focus-within,
.nm-playlist-search:focus-within {
  border-color: color-mix(in srgb, var(--nm-accent) 46%, var(--nm-soft-border));
  background: color-mix(in srgb, var(--nm-elevated) 78%, transparent);
  transform: translateY(-1px);
}
.nm-library-body {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 8px;
}
.nm-library-body > .nm-scroll-list:only-child {
  grid-row: 1 / -1;
}
.nm-search-results {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 8px;
}
.nm-search-tabs {
  justify-self: start;
  max-width: 100%;
  overflow-x: auto;
}
.nm-search-tabs .nm-panel-tab small {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--nm-muted) 18%, transparent);
  color: currentColor;
  font-size: 10px;
  font-weight: 800;
}
.nm-playlist-search {
  min-width: 0;
  padding: 6px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 6px;
  border: 1px solid var(--nm-soft-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--nm-elevated) 58%, transparent);
  animation: nmListIn 220ms var(--nm-spring) backwards;
  transition: border-color 180ms var(--nm-ease), background 220ms var(--nm-ease), transform 180ms var(--nm-ease);
}
.nm-scroll-list {
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 2px;
  animation: nmListIn 260ms var(--nm-spring) backwards;
}
.nm-virtual-list {
  display: block;
}
.nm-virtual-item {
  margin-bottom: 5px;
}
.nm-virtual-spacer {
  pointer-events: none;
  animation: none !important;
}
.nm-list-footer {
  min-height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--nm-muted);
  font-size: 12px;
  animation: nmFadeIn 180ms var(--nm-ease) both;
}
.nm-playlist-row,
.nm-song-row {
  width: 100%;
  min-height: 58px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  display: grid;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  text-align: left;
  cursor: pointer;
  transform: translateZ(0);
  transition:
    background 180ms var(--nm-ease),
    border-color 180ms var(--nm-ease),
    box-shadow 220ms var(--nm-ease),
    transform 180ms var(--nm-spring),
    opacity 180ms var(--nm-ease);
}
.nm-scroll-list > * {
  animation: nmRowIn 260ms var(--nm-spring) backwards;
}
.nm-scroll-list > *:nth-child(1) { animation-delay: 20ms; }
.nm-scroll-list > *:nth-child(2) { animation-delay: 35ms; }
.nm-scroll-list > *:nth-child(3) { animation-delay: 50ms; }
.nm-scroll-list > *:nth-child(4) { animation-delay: 65ms; }
.nm-scroll-list > *:nth-child(5) { animation-delay: 80ms; }
.nm-scroll-list > *:nth-child(n + 6) { animation-delay: 95ms; }
.nm-virtual-list > * {
  animation: none;
}
.nm-playlist-row {
  grid-template-columns: 44px minmax(0, 1fr) auto;
}
.nm-song-row {
  grid-template-columns: 44px 28px minmax(0, 1fr) auto 34px;
}
.nm-song-row-compact {
  min-height: 54px;
}
.nm-row-cover {
  width: 44px;
  height: 44px;
  border-radius: 8px;
}
.nm-playlist-row:hover,
.nm-song-row:hover,
.nm-row-active {
  background: color-mix(in srgb, var(--nm-accent) 12%, transparent);
  border-color: color-mix(in srgb, var(--nm-accent) 34%, transparent);
}
.nm-playlist-row:hover,
.nm-song-row:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.1);
}
.nm-playlist-row:hover .nm-row-cover,
.nm-song-row:hover .nm-row-cover {
  transform: scale(1.045);
  filter: saturate(108%);
}
.nm-playlist-row:active,
.nm-song-row:active {
  transform: translateY(0) scale(0.995);
}
.nm-row-active {
  box-shadow: inset 3px 0 0 color-mix(in srgb, var(--nm-accent) 86%, white);
}
.nm-row-active .nm-row-cover {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--nm-accent) 52%, transparent);
}
.nm-skeleton-list {
  pointer-events: none;
}
.nm-skeleton-row {
  cursor: default;
}
.nm-skeleton-block,
.nm-skeleton-text,
.nm-skeleton-dot {
  position: relative;
  overflow: hidden;
  background: color-mix(in srgb, var(--nm-muted) 16%, transparent);
}
.nm-skeleton-block::after,
.nm-skeleton-text::after,
.nm-skeleton-dot::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, color-mix(in srgb, white 18%, transparent), transparent);
  animation: nmSkeletonSweep 1.2s ease-in-out infinite;
}
.nm-skeleton-text {
  display: block;
  height: 10px;
  border-radius: 999px;
}
.nm-skeleton-title {
  width: min(72%, 240px);
  margin-bottom: 8px;
}
.nm-skeleton-sub {
  width: min(48%, 180px);
}
.nm-skeleton-short {
  width: 34px;
}
.nm-skeleton-dot {
  width: 28px;
  height: 28px;
  border-radius: 8px;
}
.nm-row-action {
  width: 30px;
  height: 30px;
  padding: 0 !important;
  justify-self: end;
  transition: color 160ms var(--nm-ease), transform 160ms var(--nm-spring), background 160ms var(--nm-ease);
}
.nm-row-action:hover,
.nm-settings-button:hover,
.nm-control-button:hover,
.nm-mode-button:hover {
  transform: translateY(-1px) scale(1.04);
}
.nm-row-action:active,
.nm-settings-button:active,
.nm-control-button:active,
.nm-mode-button:active,
.nm-play-button:active,
.nm-panel-tab:active {
  transform: scale(0.95);
}
.nm-like-active {
  color: #ff4f6d !important;
  animation: nmPop 240ms var(--nm-spring);
}
.nm-subscribe-active {
  color: color-mix(in srgb, var(--nm-accent) 88%, white) !important;
  animation: nmPop 240ms var(--nm-spring);
}
.nm-panel-tabs {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px;
  border: 1px solid var(--nm-soft-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--nm-elevated) 54%, transparent);
  transition: background 180ms var(--nm-ease), border-color 180ms var(--nm-ease);
}
.nm-panel-tab {
  min-height: 28px;
  padding: 0 8px !important;
  gap: 5px;
  font-size: 12px !important;
  transition: transform 160ms var(--nm-spring), background 180ms var(--nm-ease), color 160ms var(--nm-ease);
}
.nm-panel-tab:hover {
  transform: translateY(-1px);
}
.nm-library-tabs .nm-panel-tab {
  padding: 0 7px !important;
}
.nm-index {
  color: var(--nm-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.nm-empty {
  min-height: 180px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 9px;
  color: var(--nm-muted);
  font-size: 13px;
  animation: nmEmptyIn 320ms var(--nm-spring) both;
}
.nm-empty strong {
  color: var(--nm-text);
  font-size: 14px;
}
.nm-login-panel {
  align-self: center;
  justify-self: center;
  width: min(100%, 360px);
}
.nm-login-dialog {
  width: min(420px, calc(100vw - 96px)) !important;
  align-items: stretch !important;
}
.nm-login-dialog-qr {
  width: min(420px, calc(100vw - 96px)) !important;
}
.nm-login-dialog-phone {
  width: min(420px, calc(100vw - 96px)) !important;
}
.nm-login-dialog-body {
  width: 100%;
  min-width: 0;
  display: grid;
  gap: 12px;
  justify-items: center;
}
.nm-login-tabs {
  width: min(252px, 100%);
  min-width: 0;
  justify-self: center;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  padding: 3px;
  border: 1px solid var(--nm-soft-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--nm-elevated) 58%, transparent);
}
.nm-login-tab {
  width: 100%;
  min-height: 32px;
  gap: 6px;
  padding: 0 8px !important;
  font-size: 12px !important;
  transition: transform 160ms var(--nm-spring), background 180ms var(--nm-ease), color 160ms var(--nm-ease);
}
.nm-login-tab:hover {
  transform: translateY(-1px);
}
.nm-qr-panel,
.nm-phone-panel {
  min-width: 0;
  display: grid;
  gap: 10px;
  justify-items: center;
  animation: nmFadeUp 260ms var(--nm-spring) both;
}
.nm-qr-image {
  width: 188px;
  height: 188px;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--nm-accent) 24%, var(--nm-soft-border));
  border-radius: 8px;
  background: color-mix(in srgb, white 88%, var(--nm-accent) 8%);
  color: color-mix(in srgb, var(--nm-accent) 68%, #111827);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.72),
    0 10px 24px rgba(0, 0, 0, 0.12);
  overflow: hidden;
  transition: border-color 180ms var(--nm-ease), transform 180ms var(--nm-spring), opacity 180ms var(--nm-ease);
}
.nm-qr-image img {
  width: 168px;
  height: 168px;
  display: block;
  object-fit: contain;
}
.nm-qr-loading {
  opacity: 0.72;
}
.nm-login-status {
  min-height: 18px;
  color: var(--nm-muted);
  font-size: 12px;
  line-height: 1.45;
  text-align: center;
}
.nm-login-status-error {
  color: color-mix(in srgb, #ff4f6d 84%, var(--nm-text));
}
.nm-phone-panel {
  width: 100%;
  justify-items: stretch;
  gap: 14px;
}
.nm-phone-form {
  min-width: 0;
  width: max-content;
  justify-self: center;
  display: grid;
  grid-template-columns: 92px minmax(0, 150px);
  align-items: end;
  gap: 10px;
}
.nm-phone-captcha-form {
  grid-template-columns: 92px minmax(0, 150px);
}
.nm-phone-field {
  min-width: 0;
  display: grid;
  gap: 6px;
  color: var(--nm-muted);
  font-size: 11px;
  line-height: 1;
}
.nm-phone-field > span {
  padding-left: 2px;
  font-weight: 680;
}
.nm-phone-input {
  height: 38px !important;
  min-height: 38px !important;
  padding: 0 11px !important;
  border-radius: 8px !important;
  font-size: 13px !important;
  line-height: 38px !important;
}
.nm-phone-send {
  width: 100%;
  height: 38px;
  min-height: 38px;
  padding: 0 10px !important;
  border: 1px solid var(--nm-soft-border) !important;
  border-radius: 8px !important;
  white-space: nowrap;
}
.nm-phone-status {
  min-height: 32px;
  padding: 7px 10px;
  border: 1px solid var(--nm-soft-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--nm-elevated) 54%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.nm-phone-submit {
  width: min(100%, 220px);
  height: 38px;
  min-height: 38px;
}
.nm-login-actions {
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.nm-login-hint {
  max-width: 320px;
  color: color-mix(in srgb, var(--nm-muted) 86%, transparent);
  font-size: 11px;
  line-height: 1.45;
  text-align: center;
}
.nm-player-bar {
  min-width: 0;
  padding: 5px 10px 5px;
  position: relative;
  display: grid;
  grid-template-rows: auto auto;
  row-gap: 3px;
  cursor: pointer;
  animation: nmPlayerIn 380ms var(--nm-spring) 170ms backwards;
}
.nm-player-bar:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--nm-accent) 28%, var(--nm-border));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 14%, transparent),
    0 22px 48px rgba(0, 0, 0, 0.2);
}
.nm-progress-row {
  min-width: 0;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 36px;
  align-items: center;
  gap: 4px;
}
.nm-progress {
  min-width: 0;
  height: 20px;
  display: flex;
  align-items: center;
}
.nm-time-label {
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--nm-muted);
  font-size: 11px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  text-align: center;
}
.nm-time-label:last-child {
  justify-content: center;
  text-align: center;
}
.nm-player-bar .nm-progress label,
.nm-player-bar .nm-volume label {
  --slider-height: 4px;
  width: 100%;
}
.nm-player-main {
  min-height: 38px;
  display: grid;
  grid-template-columns: minmax(220px, 1fr) auto minmax(300px, 1fr);
  align-items: center;
  gap: 10px;
}
.nm-now-brief {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.nm-mini-cover {
  width: 34px;
  height: 34px;
  border-radius: 7px;
}
.nm-playing .nm-mini-cover {
  animation: nmMiniCoverPulse 2.8s ease-in-out infinite;
}
.nm-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}
.nm-control-button {
  width: 30px;
  height: 30px;
}
.nm-player-bar .nm-mode-button {
  width: 30px;
  height: 30px;
}
.nm-play-button {
  width: 36px;
  height: 36px;
  padding: 0 !important;
  border-radius: 50%;
  box-shadow: 0 8px 18px color-mix(in srgb, var(--nm-accent) 28%, transparent);
  transition: transform 170ms var(--nm-spring), box-shadow 220ms var(--nm-ease), filter 180ms var(--nm-ease);
}
.nm-play-button:hover {
  transform: scale(1.06);
  filter: saturate(110%);
  box-shadow: 0 10px 22px color-mix(in srgb, var(--nm-accent) 36%, transparent);
}
.nm-mode-active {
  color: var(--nm-accent) !important;
}
.nm-player-tools {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  justify-self: end;
  width: auto;
}
.nm-settings-button {
  width: 30px;
  height: 30px;
  padding: 0 !important;
}
.nm-quality-group {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
  padding: 2px;
  border: 1px solid var(--nm-soft-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--nm-elevated) 58%, transparent);
}
.nm-quality-button {
  width: 100%;
  min-height: 22px;
  padding: 2px 4px !important;
  font-size: 11px !important;
  line-height: 1.2;
  transition: transform 150ms var(--nm-spring), background 180ms var(--nm-ease), color 160ms var(--nm-ease);
}
.nm-quality-button:hover {
  transform: translateY(-1px);
}
.nm-volume {
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 4px;
  color: var(--nm-muted);
  width: 100px;
  flex: 0 0 100px;
}
.nm-volume-mute {
  width: 26px;
  height: 26px;
  padding: 0 !important;
  color: var(--nm-muted) !important;
}
.nm-volume-mute:hover {
  color: var(--nm-accent) !important;
}
.nm-queue-anchor {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}
.nm-queue-button {
  color: var(--nm-muted) !important;
}
.nm-queue-popover {
  position: absolute;
  right: 0;
  bottom: calc(100% + 12px);
  z-index: 40;
  width: min(238px, calc(100vw - 44px));
  max-height: min(390px, calc(100vh - 210px));
  padding: 8px;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 6px;
  border: 1px solid color-mix(in srgb, var(--nm-accent) 22%, var(--nm-border));
  border-radius: 8px;
  background: #f8fafc;
  color: var(--nm-text);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 22%, transparent),
    0 20px 54px rgba(0, 0, 0, 0.32);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  transform-origin: right bottom;
  cursor: default;
  animation: nmQueueIn 180ms var(--nm-spring) both;
}
.dark .nm-queue-popover {
  background: #171b24;
}
.nm-queue-head {
  min-width: 0;
  min-height: 34px;
  padding: 2px 2px 4px 6px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}
.nm-queue-head strong,
.nm-queue-head small {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nm-queue-head strong {
  font-size: 13px;
}
.nm-queue-head small {
  margin-top: 2px;
  color: var(--nm-muted);
  font-size: 11px;
}
.nm-queue-clear {
  width: 28px;
  height: 28px;
  padding: 0 !important;
}
.nm-queue-list {
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-right: 2px;
}
.nm-queue-row {
  width: 100%;
  min-height: 48px;
  padding: 6px 7px;
  border: 1px solid transparent;
  border-radius: 7px;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: background 160ms var(--nm-ease), border-color 160ms var(--nm-ease), color 160ms var(--nm-ease), transform 160ms var(--nm-spring);
}
.nm-queue-row:hover,
.nm-queue-row-active {
  background: color-mix(in srgb, var(--nm-accent) 15%, var(--background, #f8fafc));
  border-color: color-mix(in srgb, var(--nm-accent) 28%, transparent);
}
.nm-queue-row:hover {
  transform: translateX(1px);
}
.nm-queue-row-active {
  color: color-mix(in srgb, var(--nm-accent) 84%, white);
}
.nm-queue-index {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: currentColor;
  font-size: 12px;
  font-weight: 780;
  font-variant-numeric: tabular-nums;
}
.nm-queue-copy {
  min-width: 0;
}
.nm-queue-copy strong,
.nm-queue-copy small {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nm-queue-copy strong {
  font-size: 13px;
  line-height: 1.25;
}
.nm-queue-copy small,
.nm-queue-duration {
  color: var(--nm-muted);
  font-size: 11px;
}
.nm-queue-copy small {
  margin-top: 3px;
}
.nm-queue-duration {
  font-variant-numeric: tabular-nums;
}
.nm-queue-empty {
  min-height: 120px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  color: var(--nm-muted);
  font-size: 12px;
}
.nm-floating-mini {
  position: absolute;
  right: 20px;
  bottom: 96px;
  z-index: 12;
  width: min(420px, calc(100% - 40px));
  min-height: 64px;
  padding: 9px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  border: 1px solid color-mix(in srgb, var(--nm-accent) 26%, var(--nm-border));
  border-radius: 8px;
  background: color-mix(in srgb, var(--nm-card-solid) 92%, var(--background, #151820));
  color: var(--nm-text);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 12%, transparent),
    0 18px 48px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(18px) saturate(132%);
  -webkit-backdrop-filter: blur(18px) saturate(132%);
  animation: nmMiniIn 220ms var(--nm-spring) both;
}
.nm-floating-mini-cover {
  width: 46px;
  height: 46px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  object-fit: cover;
}
.nm-floating-mini-copy {
  min-width: 0;
}
.nm-floating-mini-copy strong,
.nm-floating-mini-copy small {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nm-floating-mini-copy strong {
  font-size: 13px;
}
.nm-floating-mini-copy small {
  color: var(--nm-muted);
  font-size: 12px;
}
.nm-floating-mini-controls {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.nm-floating-mini-play {
  width: 32px;
  height: 32px;
  padding: 0 !important;
  border-radius: 50%;
}
.nm-settings-card {
  width: min(560px, calc(100vw - 96px)) !important;
  max-height: calc(100vh - 96px);
  align-items: stretch !important;
}
.nm-settings-dialog {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: hidden;
}
.nm-settings-section {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.nm-settings-row {
  min-width: 0;
  padding: 8px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--nm-soft-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--nm-elevated) 58%, transparent);
}
.nm-settings-copy {
  min-width: 0;
}
.nm-settings-copy strong,
.nm-settings-copy small {
  display: block;
  min-width: 0;
}
.nm-settings-copy strong {
  font-size: 13px;
}
.nm-settings-copy small {
  margin-top: 3px;
  color: var(--muted-foreground, #a8adbd);
  font-size: 12px;
}
.nm-toggle-button {
  min-width: 58px;
  justify-self: end;
}
.nm-dialog-label {
  color: var(--muted-foreground, #a8adbd);
  font-size: 12px;
}
.nm-settings-dialog .nm-quality-group {
  width: 100%;
}
.nm-settings-dialog .nm-quality-button {
  min-height: 30px;
}
.nm-cache-panel {
  min-width: 0;
  padding: 8px;
  display: grid;
  gap: 8px;
  border: 1px solid var(--nm-soft-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--nm-elevated) 58%, transparent);
  color: var(--nm-muted);
  font-size: 12px;
}
.nm-cache-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.nm-cache-button {
  min-height: 28px;
}
.nm-expanded-player {
  position: absolute;
  inset: 0;
  z-index: 9999;
  background-color: rgba(255, 255, 255, 0.24);
  background-color: color-mix(in srgb, var(--background, #151820) 28%, transparent);
  background-image: none;
  background-position: center;
  background-size: cover;
  border-radius: 8px;
  overflow: hidden;
  backdrop-filter: blur(26px) saturate(132%);
  -webkit-backdrop-filter: blur(26px) saturate(132%);
  animation: nmExpandIn 280ms var(--nm-spring);
}
.nm-expanded-closing {
  pointer-events: none;
  animation: nmExpandOut 240ms var(--nm-ease) both;
}
.nm-expanded-overlay {
  position: absolute;
  inset: 0;
  z-index: 0;
  background:
    radial-gradient(circle at 20% 18%, color-mix(in srgb, var(--nm-accent) 20%, transparent), transparent 36%),
    linear-gradient(120deg, color-mix(in srgb, var(--background, #151820) 72%, transparent), color-mix(in srgb, var(--card, #272b36) 30%, transparent) 48%, color-mix(in srgb, var(--background, #151820) 74%, transparent)),
    linear-gradient(0deg, color-mix(in srgb, var(--background, #151820) 58%, transparent), transparent 48%, color-mix(in srgb, var(--background, #151820) 46%, transparent));
  backdrop-filter: blur(26px) saturate(132%);
  -webkit-backdrop-filter: blur(26px) saturate(132%);
  animation: nmFadeIn 320ms var(--nm-ease) both;
}
.nm-expanded-closing .nm-expanded-overlay {
  animation: nmFadeOut 220ms var(--nm-ease) both;
}
.nm-expanded-content {
  height: 100%;
  padding: 16px;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 14px;
  animation: nmExpandedContentIn 360ms var(--nm-spring) 80ms both;
}
.nm-expanded-closing .nm-expanded-content {
  animation: nmExpandedContentOut 190ms var(--nm-ease) both;
}
.nm-expanded-top {
  min-height: 40px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.nm-lyrics-tools {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.nm-lyric-size-button {
  width: 28px;
  height: 28px;
  padding: 0 !important;
  font-size: 11px !important;
}
.nm-expanded-grid {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(320px, 0.95fr) minmax(360px, 1.05fr);
  gap: 18px;
}
.nm-cover-stage,
.nm-lyrics-panel {
  min-width: 0;
  min-height: 0;
}
.nm-cover-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
}
.nm-cover-wrap {
  position: relative;
  width: min(82%, 390px);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
}
.nm-vinyl {
  position: absolute;
  inset: 10%;
  border-radius: 50%;
  background:
    radial-gradient(circle at center, #111 0 10%, #2b2d33 10% 13%, #0b0c10 13% 34%, #262932 34% 35%, #090a0d 35% 100%),
    conic-gradient(from 0deg, rgba(255,255,255,0.06), transparent 18%, rgba(255,255,255,0.05) 32%, transparent 58%, rgba(255,255,255,0.04) 76%, transparent);
  transform: translateX(18%);
  opacity: 0.78;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.44);
  transition: opacity 240ms var(--nm-ease), transform 260ms var(--nm-spring);
}
.nm-vinyl-playing {
  animation: nmSpin 12s linear infinite;
}
@keyframes nmSpin {
  to { transform: translateX(18%) rotate(360deg); }
}
.nm-cover-frame {
  position: relative;
  width: 82%;
  z-index: 1;
  animation: nmCoverIn 420ms var(--nm-spring) both;
}
.nm-cover {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  object-fit: cover;
  background: color-mix(in srgb, var(--muted, #323744) 78%, transparent);
  box-shadow:
    0 24px 60px rgba(0, 0, 0, 0.42),
    0 0 0 1px color-mix(in srgb, white 16%, transparent);
  transition: transform 260ms var(--nm-spring), box-shadow 260ms var(--nm-ease), filter 260ms var(--nm-ease);
}
.nm-cover-stage:hover .nm-cover {
  transform: translateY(-2px) scale(1.012);
  filter: saturate(108%);
  box-shadow:
    0 30px 70px rgba(0, 0, 0, 0.46),
    0 0 0 1px color-mix(in srgb, white 20%, transparent);
}
.nm-cover-empty {
  color: color-mix(in srgb, var(--nm-accent) 58%, white);
}
.nm-badge {
  position: absolute;
  left: 12px;
  bottom: 12px;
  min-height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--nm-accent) 82%, #111827);
  color: white;
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 800;
  animation: nmBadgeIn 260ms var(--nm-spring) both;
}
.nm-track-meta {
  width: 100%;
  min-width: 0;
  text-align: center;
  animation: nmFadeUp 340ms var(--nm-spring) 120ms both;
}
.nm-track-meta strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: clamp(26px, 3.2vw, 42px);
  line-height: 1.08;
}
.nm-track-meta > span {
  display: block;
  margin-top: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--nm-muted);
  font-size: 14px;
}
.nm-lyrics-panel {
  overflow: auto;
  padding: 40px 10px;
  mask-image: linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%);
}
.nm-lyric-line {
  padding: 9px 12px;
  border-radius: 8px;
  color: color-mix(in srgb, var(--nm-muted) 88%, white);
  font-size: 14px;
  line-height: 1.48;
  text-align: center;
  cursor: pointer;
  transition: color 0.24s ease, background 0.24s ease, transform 0.24s ease, opacity 0.24s ease;
  opacity: 0.68;
}
.nm-lyrics-compact .nm-lyric-line {
  font-size: 12px;
}
.nm-lyrics-large .nm-lyric-line {
  font-size: 16px;
}
.nm-lyric-line small {
  display: block;
  margin-top: 4px;
  color: color-mix(in srgb, var(--nm-muted) 76%, transparent);
  font-size: 12px;
}
.nm-lyrics-compact .nm-lyric-line small {
  font-size: 11px;
}
.nm-lyrics-large .nm-lyric-line small {
  font-size: 13px;
}
.nm-lyric-active {
  color: var(--nm-text);
  background: color-mix(in srgb, var(--nm-accent) 15%, transparent);
  font-size: 18px;
  font-weight: 820;
  opacity: 1;
  transform: scale(1.02);
}
.nm-lyric-status {
  min-height: 100%;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--nm-muted);
  animation: nmFadeUp 280ms var(--nm-spring) both;
}
.nm-lyric-status-icon {
  width: 52px;
  height: 52px;
  margin-bottom: 12px;
  border: 1px solid color-mix(in srgb, var(--nm-accent) 24%, var(--nm-soft-border));
  border-radius: 50%;
  background: color-mix(in srgb, var(--nm-accent) 12%, transparent);
  color: color-mix(in srgb, var(--nm-accent) 78%, white);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.nm-lyric-status strong {
  color: var(--nm-text);
  font-size: 20px;
}
.nm-lyric-status small {
  max-width: 280px;
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.5;
}
.nm-lyric-status-loading .nm-lyric-status-icon {
  animation: nmSpin 1.2s linear infinite;
}
.nm-lyrics-compact .nm-lyric-active {
  font-size: 15px;
}
.nm-lyrics-large .nm-lyric-active {
  font-size: 22px;
}
.nm-cover-fallback {
  border: 1px solid color-mix(in srgb, white 10%, transparent);
}
.nm-context-menu {
  position: absolute;
  z-index: 30;
  min-width: 154px;
  padding: 5px;
  border: 1px solid var(--nm-border);
  border-radius: 8px;
  background: #f8fafc;
  color: var(--nm-text);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 12%, transparent),
    0 18px 46px rgba(0, 0, 0, 0.28);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  animation: nmContextIn 140ms var(--nm-spring) both;
}
.dark .nm-context-menu {
  background: #171b24;
}
.nm-context-item {
  width: 100%;
  min-height: 30px;
  padding: 0 9px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
  cursor: pointer;
  font-size: 12px;
  transition: background 140ms var(--nm-ease), color 140ms var(--nm-ease), transform 140ms var(--nm-spring);
}
.nm-context-item:hover {
  background: color-mix(in srgb, var(--nm-accent) 14%, transparent);
  color: color-mix(in srgb, var(--nm-accent) 84%, white);
  transform: translateX(1px);
}
.nm-context-submenu {
  position: relative;
  display: block;
}
.nm-context-submenu::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 100%;
  width: 10px;
}
.nm-context-submenu-trigger svg:last-child {
  margin-left: auto;
}
.nm-context-submenu-panel {
  position: absolute;
  top: -5px;
  left: calc(100% + 2px);
  z-index: 31;
  min-width: 142px;
  max-width: 210px;
  padding: 5px;
  border: 1px solid var(--nm-border);
  border-radius: 8px;
  background: #f8fafc;
  color: var(--nm-text);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 12%, transparent),
    0 18px 46px rgba(0, 0, 0, 0.28);
  opacity: 0;
  pointer-events: none;
  transform: translateX(-4px) scale(0.98);
  transform-origin: left top;
  transition: opacity 120ms var(--nm-ease), transform 140ms var(--nm-spring);
}
.dark .nm-context-submenu-panel {
  background: #171b24;
}
.nm-context-submenu:hover .nm-context-submenu-panel,
.nm-context-submenu:focus-within .nm-context-submenu-panel {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(0) scale(1);
}
.netease-shell ::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.netease-shell ::-webkit-scrollbar-track {
  background: transparent;
}
.netease-shell ::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--nm-accent) 54%, #5ed9c8);
  border-radius: 999px;
}
@keyframes nmShellIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes nmSlideIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes nmCardIn {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.992);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@keyframes nmListIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes nmRowIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes nmPlayerIn {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes nmExpandIn {
  from {
    opacity: 0;
    transform: translateY(18px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes nmExpandOut {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(18px);
  }
}
@keyframes nmExpandedContentIn {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes nmExpandedContentOut {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(12px);
  }
}
@keyframes nmCoverIn {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.96) rotate(-1deg);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1) rotate(0deg);
  }
}
@keyframes nmFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes nmFadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}
@keyframes nmFadeUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes nmEmptyIn {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.99);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@keyframes nmPop {
  0% { transform: scale(0.88); }
  65% { transform: scale(1.12); }
  100% { transform: scale(1); }
}
@keyframes nmMiniCoverPulse {
  0%, 100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--nm-accent) 0%, transparent);
  }
  50% {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--nm-accent) 18%, transparent);
  }
}
@keyframes nmBadgeIn {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@keyframes nmContextIn {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@keyframes nmMiniIn {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@keyframes nmQueueIn {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@keyframes nmSkeletonSweep {
  to {
    transform: translateX(100%);
  }
}
@keyframes nmBackdropDrift {
  from {
    transform: scale(1);
  }
  to {
    transform: scale(1.025);
  }
}
@media (max-width: 1040px) {
  .netease-shell {
    height: auto;
    min-height: 720px;
  }
  .nm-topbar {
    grid-template-columns: 1fr;
    align-items: stretch;
  }
  .nm-brand,
  .nm-top-nav,
  .nm-topbar-right {
    justify-self: stretch;
  }
  .nm-top-nav {
    width: 100%;
    min-width: 0;
    max-width: 100%;
  }
  .nm-topbar-right {
    min-width: 0;
    grid-template-columns: minmax(0, 1fr) auto;
    padding-right: 0;
  }
  .nm-main-grid,
  .nm-expanded-grid {
    grid-template-columns: 1fr;
  }
  .nm-home-hero {
    grid-template-columns: 1fr;
    align-items: start;
  }
  .nm-home-hero-actions {
    justify-content: flex-start;
  }
  .nm-player-main {
    grid-template-columns: 1fr;
  }
  .nm-player-tools {
    justify-self: stretch;
    width: 100%;
    flex-wrap: wrap;
  }
  .nm-queue-popover {
    right: 0;
  }
}
@media (max-width: 700px) {
  .nm-login-dialog {
    width: calc(100vw - 32px) !important;
    padding: 22px !important;
  }
  .nm-phone-form,
  .nm-phone-captcha-form {
    grid-template-columns: 1fr;
  }
  .nm-settings-card {
    width: calc(100vw - 32px) !important;
    padding: 22px !important;
  }
  .nm-settings-row {
    grid-template-columns: 1fr;
  }
  .nm-toggle-button {
    justify-self: start;
  }
  .nm-settings-dialog .nm-quality-group {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .netease-shell {
    padding: 12px;
  }
  .nm-topbar {
    gap: 10px;
  }
  .nm-topbar-right {
    min-width: 0;
    grid-template-columns: 1fr;
    padding-right: 0;
  }
  .nm-top-nav {
    justify-content: flex-start;
  }
  .nm-account-panel {
    width: 100%;
    max-width: none;
  }
  .nm-song-strip {
    grid-template-columns: 1fr;
  }
  .nm-detail-head {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .nm-detail-cover {
    display: none;
  }
  .nm-media-detail-head {
    grid-template-columns: auto 72px minmax(0, 1fr);
    align-items: start;
  }
  .nm-media-detail-cover {
    width: 72px;
    height: 72px;
  }
  .nm-media-detail-copy strong {
    font-size: 18px;
  }
  .nm-media-detail-actions {
    grid-column: 2 / -1;
    justify-self: start;
  }
  .nm-song-row {
    grid-template-columns: 40px minmax(0, 1fr) auto 34px;
  }
  .nm-song-row .nm-index {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .netease-shell,
  .netease-shell *,
  .netease-shell *::before,
  .netease-shell *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 1ms !important;
  }
  .nm-page-backdrop,
  .nm-vinyl-playing,
  .nm-playing .nm-mini-cover {
    animation: none !important;
  }
}
`;

// src/index.tsx
var SONG_ROW_STEP = 63;
var SONG_LIST_OVERSCAN = 6;
var SONG_LIST_END_THRESHOLD = 220;
var SONG_RENDER_CHUNK_SIZE = 50;
function createViewMemory() {
  return {
    mainView: "playlists",
    libraryView: "playlists",
    returnLibraryView: "playlists",
    searchTab: "songs",
    query: "",
    playlistQuery: "",
    activeAlbum: null,
    activeArtist: null
  };
}
var viewMemory = createViewMemory();
function resetViewMemory() {
  viewMemory = createViewMemory();
}
function setup(sdk) {
  runtime.init(sdk);
  sdk.lifecycle.onDispose(() => runtime.dispose());
  sdk.ui.registerPage({
    path: "netease-music",
    title: "\u7F51\u6613\u4E91\u97F3\u4E50",
    icon: "musicFilled",
    render: MusicPage
  });
}
function teardown() {
  runtime.dispose();
  resetViewMemory();
}
function MusicPage() {
  const [state, setState] = useState(runtime.getState());
  const [query, setQuery] = useState(viewMemory.query);
  const [playlistQuery, setPlaylistQuery] = useState(viewMemory.playlistQuery);
  const [mainView, setMainView] = useState(viewMemory.mainView);
  const [libraryView, setLibraryView] = useState(viewMemory.libraryView);
  const [returnLibraryView, setReturnLibraryView] = useState(viewMemory.returnLibraryView);
  const [searchTab, setSearchTab] = useState(viewMemory.searchTab);
  const [activeAlbum, setActiveAlbum] = useState(viewMemory.activeAlbum);
  const [activeArtist, setActiveArtist] = useState(viewMemory.activeArtist);
  const [searchFocused, setSearchFocused] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [themeColor, setThemeColor] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [expandedClosing, setExpandedClosing] = useState(false);
  const [miniOpen, setMiniOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const shellRef = useRef(null);
  const expandedCloseTimer = useRef(null);
  const loggedIn = Boolean(state.loginInfo?.logged_in);
  const detailActive = libraryView === "tracks" && Boolean(state.activePlaylist);
  const searchActive = mainView === "search";
  const playlistSourceView = libraryView === "tracks" ? returnLibraryView : mainView === "discoverPlaylists" ? "discover" : isPlaylistSourceView(mainView) ? mainView : returnLibraryView;
  const libraryPlaylists = playlistSourceView === "charts" ? state.topPlaylists : playlistSourceView === "discover" ? state.discoverPlaylists : state.userPlaylists;
  const libraryTitle = playlistSourceView === "charts" ? "\u5B98\u65B9\u699C\u5355" : playlistSourceView === "discover" ? "\u53D1\u73B0\u6B4C\u5355" : "\u6211\u7684\u6B4C\u5355";
  const libraryKicker = playlistSourceView === "charts" ? "Charts" : playlistSourceView === "discover" ? "Discover" : "My Library";
  const topNavView = detailActive ? returnLibraryView === "playlists" ? "playlists" : "discover" : mainView === "charts" || mainView === "recommend" || mainView === "discoverPlaylists" ? "discover" : mainView;
  const coverBackgroundUrl = state.showCoverBackground ? state.currentCoverUrl : "";
  const shellStyle = {
    ...coverBackgroundUrl ? { backgroundImage: `url("${coverBackgroundUrl}")` } : {},
    ...themeColor ? { "--nm-accent": themeColor } : {}
  };
  useEffect(() => runtime.subscribe(setState), []);
  useEffect(() => {
    viewMemory.mainView = mainView;
    viewMemory.libraryView = libraryView;
    viewMemory.returnLibraryView = returnLibraryView;
    viewMemory.searchTab = searchTab;
    viewMemory.query = query;
    viewMemory.playlistQuery = playlistQuery;
    viewMemory.activeAlbum = activeAlbum;
    viewMemory.activeArtist = activeArtist;
  }, [mainView, libraryView, returnLibraryView, searchTab, query, playlistQuery, activeAlbum, activeArtist]);
  useEffect(() => {
    return () => {
      if (expandedCloseTimer.current !== null) window.clearTimeout(expandedCloseTimer.current);
    };
  }, []);
  useEffect(() => {
    if (!state.currentCoverUrl) {
      setThemeColor("");
      return;
    }
    let cancelled = false;
    extractThemeColor(state.currentCoverUrl).then((color) => {
      if (!cancelled) setThemeColor(color);
    });
    return () => {
      cancelled = true;
    };
  }, [state.currentCoverUrl]);
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", close);
    };
  }, [contextMenu]);
  useEffect(() => {
    const onKeyDown = (event) => {
      if (!shellRef.current || contextMenu || !isShortcutTargetAllowed(event.target)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (!runtime.getState().keyboardShortcutsEnabled) return;
      const rect = shellRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      if (event.repeat && event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      if (event.key === " ") {
        event.preventDefault();
        void runtime.togglePlay();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        void runtime.prevTrack();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        void runtime.nextTrack();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        runtime.setVolume(runtime.getState().volume + 0.05);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        runtime.setVolume(runtime.getState().volume - 0.05);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [contextMenu]);
  const runSearch = (keyword = query) => {
    const nextQuery = keyword.trim();
    setQuery(nextQuery);
    setSearchTab("songs");
    setActiveAlbum(null);
    setActiveArtist(null);
    if (libraryView === "tracks") setLibraryView(returnLibraryView);
    setMainView("search");
    void runtime.search(nextQuery);
  };
  const openPlaylist = (playlist) => {
    if (libraryView !== "tracks") setReturnLibraryView(libraryView);
    setLibraryView("tracks");
    void runtime.loadPlaylist(playlist);
  };
  const showLibraryView = (view) => {
    setActiveAlbum(null);
    setActiveArtist(null);
    setMainView(view);
    setLibraryView(view);
    setReturnLibraryView(view);
    if (view === "charts" && !state.topPlaylists.length) void runtime.loadTopPlaylists();
    if (view === "discover" && !state.discoverPlaylists.length) void runtime.loadDiscoverPlaylists();
  };
  const showRecommendView = () => {
    setActiveAlbum(null);
    setActiveArtist(null);
    setMainView("recommend");
    if (libraryView === "tracks") setLibraryView(returnLibraryView);
    runtime.showRecommendations();
  };
  const showRecentView = () => {
    setActiveAlbum(null);
    setActiveArtist(null);
    setMainView("recent");
    if (libraryView === "tracks") setLibraryView(returnLibraryView);
    runtime.showRecentSongs();
  };
  const showDiscoverPlaylistView = () => {
    setActiveAlbum(null);
    setActiveArtist(null);
    setMainView("discoverPlaylists");
    setLibraryView("discover");
    setReturnLibraryView("discover");
    if (!state.discoverPlaylists.length) void runtime.loadDiscoverPlaylists();
  };
  const refreshLibrary = () => {
    if (playlistSourceView === "charts") {
      void runtime.loadTopPlaylists(true);
    } else if (playlistSourceView === "discover") {
      if (playlistQuery.trim()) void runtime.searchDiscoverPlaylists(playlistQuery, true);
      else void runtime.loadDiscoverPlaylists(true);
    } else {
      void runtime.loadUserPlaylists(true);
    }
  };
  const runPlaylistSearch = () => {
    void runtime.searchDiscoverPlaylists(playlistQuery, true);
  };
  const openAlbumDetail = (album) => {
    setActiveAlbum(album);
    setActiveArtist(null);
    setSearchTab("songs");
    if (libraryView === "tracks") setLibraryView(returnLibraryView);
    setMainView("albumDetail");
    void runtime.loadAlbumSongs(album);
  };
  const openArtistDetail = (artist) => {
    setActiveArtist(artist);
    setActiveAlbum(null);
    setSearchTab("songs");
    if (libraryView === "tracks") setLibraryView(returnLibraryView);
    setMainView("artistDetail");
    void runtime.loadArtistSongs(artist);
  };
  const openSongArtistDetail = (artist) => {
    if (artist.id) {
      openArtistDetail(artist);
      return;
    }
    const name = artist.name.trim();
    if (!name) return;
    setQuery(name);
    setSearchTab("artists");
    if (libraryView === "tracks") setLibraryView(returnLibraryView);
    setMainView("search");
    void runtime.findArtistByName(name).then((matched) => {
      if (matched) openArtistDetail(matched);
      else void runtime.search(name);
    });
  };
  const openSongAlbumDetail = (song) => {
    const albumName = song.album.trim();
    if (!albumName) return;
    setQuery(albumName);
    setSearchTab("albums");
    if (libraryView === "tracks") setLibraryView(returnLibraryView);
    setMainView("search");
    void runtime.findAlbumByName(albumName, song.artist).then((album) => {
      if (album) openAlbumDetail(album);
      else void runtime.search(albumName);
    });
  };
  const backToSearch = () => {
    setActiveAlbum(null);
    setActiveArtist(null);
    setMainView("search");
  };
  const searchSuggestions = buildSearchSuggestions(query, state);
  const openLoginDialog = () => setLoginOpen(true);
  const closeLoginDialog = () => setLoginOpen(false);
  const handleLoggedIn = () => {
    void runtime.refreshLoginStatus();
  };
  const openExpanded = () => {
    if (expandedCloseTimer.current !== null) {
      window.clearTimeout(expandedCloseTimer.current);
      expandedCloseTimer.current = null;
    }
    setExpandedClosing(false);
    setExpanded(true);
  };
  const closeExpanded = () => {
    if (!expanded || expandedClosing) return;
    setExpandedClosing(true);
    expandedCloseTimer.current = window.setTimeout(() => {
      setExpanded(false);
      setExpandedClosing(false);
      expandedCloseTimer.current = null;
    }, 240);
  };
  const contextMenuPoint = (event) => {
    const rect = shellRef.current?.getBoundingClientRect();
    if (!rect) return { x: event.clientX, y: event.clientY };
    return {
      x: Math.max(8, Math.min(event.clientX - rect.left, rect.width - 8)),
      y: Math.max(8, Math.min(event.clientY - rect.top, rect.height - 8))
    };
  };
  const openSongContextMenu = (event, song, queue) => {
    event.preventDefault();
    event.stopPropagation();
    const point = contextMenuPoint(event);
    setContextMenu({
      kind: "song",
      x: point.x,
      y: point.y,
      song,
      queue,
      inQueue: state.queue.some((item) => item.id === song.id),
      liked: state.likedSongIds.includes(song.id)
    });
  };
  const openPlaylistContextMenu = (event, playlist, canToggleSubscribe) => {
    event.preventDefault();
    event.stopPropagation();
    const point = contextMenuPoint(event);
    setContextMenu({
      kind: "playlist",
      x: point.x,
      y: point.y,
      playlist,
      canToggleSubscribe
    });
  };
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      ref: shellRef,
      className: ["netease-shell", coverBackgroundUrl ? "nm-has-cover" : "", expanded ? "nm-expanded-active" : "", state.isPlaying ? "nm-playing" : "", state.loading ? "nm-loading" : ""].filter(Boolean).join(" "),
      style: shellStyle,
      onContextMenu: (event) => {
        if (event.target === event.currentTarget) event.preventDefault();
      }
    },
    /* @__PURE__ */ React.createElement("style", null, cssText),
    /* @__PURE__ */ React.createElement("div", { className: "nm-page-backdrop" }),
    /* @__PURE__ */ React.createElement("header", { className: "nm-topbar" }, /* @__PURE__ */ React.createElement(AccountPanel, { state, loggedIn, onLogin: openLoginDialog }), /* @__PURE__ */ React.createElement(
      TopNav,
      {
        view: topNavView,
        onLibrary: showLibraryView,
        onRecent: showRecentView
      }
    ), /* @__PURE__ */ React.createElement("div", { className: "nm-topbar-right" }, /* @__PURE__ */ React.createElement("div", { className: "nm-searchbar nm-top-search" }, /* @__PURE__ */ React.createElement(
      TextField,
      {
        density: "compact",
        value: query,
        placeholder: "\u641C\u7D22\u6B4C\u66F2\u3001\u6B4C\u5355\u3001\u4E13\u8F91\u3001\u6B4C\u624B",
        onChange: (event) => setQuery(event.target.value),
        onFocus: () => setSearchFocused(true),
        onBlur: () => window.setTimeout(() => setSearchFocused(false), 120),
        onKeyDown: (event) => {
          if (event.key === "Enter") runSearch();
        }
      }
    ), /* @__PURE__ */ React.createElement(Button, { variant: "primary", size: "sm", className: "nm-search-button", title: "\u641C\u7D22", onClick: () => runSearch() }, /* @__PURE__ */ React.createElement(Icon, { name: "search", size: 15 })), searchFocused && (searchSuggestions.length || state.searchHistory.length) ? /* @__PURE__ */ React.createElement(
      SearchSuggestPopover,
      {
        suggestions: searchSuggestions,
        query,
        canClearHistory: state.searchHistory.length > 0,
        onSelect: (value) => {
          setSearchFocused(false);
          runSearch(value);
        },
        onClearHistory: () => runtime.clearSearchHistory()
      }
    ) : null))),
    /* @__PURE__ */ React.createElement("main", { className: "nm-main-surface" }, detailActive && state.activePlaylist ? /* @__PURE__ */ React.createElement(
      PlaylistDetailPage,
      {
        state,
        onBack: () => {
          setLibraryView(returnLibraryView);
          setMainView(returnLibraryView);
        },
        onSongContextMenu: openSongContextMenu
      }
    ) : searchActive ? /* @__PURE__ */ React.createElement(
      SearchPage,
      {
        state,
        tab: searchTab,
        onTabChange: setSearchTab,
        onOpenPlaylist: openPlaylist,
        onOpenAlbum: (album) => {
          openAlbumDetail(album);
        },
        onOpenArtist: (artist) => {
          openArtistDetail(artist);
        },
        onSongContextMenu: openSongContextMenu,
        onPlaylistContextMenu: openPlaylistContextMenu
      }
    ) : mainView === "albumDetail" && activeAlbum ? /* @__PURE__ */ React.createElement(
      AlbumDetailPage,
      {
        album: activeAlbum,
        state,
        onBack: backToSearch,
        onOpenArtist: openArtistDetail,
        onSongContextMenu: openSongContextMenu
      }
    ) : mainView === "artistDetail" && activeArtist ? /* @__PURE__ */ React.createElement(
      ArtistDetailPage,
      {
        artist: activeArtist,
        state,
        onBack: backToSearch,
        onOpenAlbum: openAlbumDetail,
        onSongContextMenu: openSongContextMenu
      }
    ) : mainView === "home" ? /* @__PURE__ */ React.createElement(
      HomePage,
      {
        state,
        loggedIn,
        onLogin: openLoginDialog,
        onOpenPlaylist: openPlaylist,
        onShowLibrary: showLibraryView,
        onShowRecommend: showRecommendView,
        onShowRecent: showRecentView,
        onSongContextMenu: openSongContextMenu,
        onPlaylistContextMenu: openPlaylistContextMenu
      }
    ) : mainView === "discover" ? /* @__PURE__ */ React.createElement(
      DiscoverPage,
      {
        state,
        onShowDiscoverPlaylists: showDiscoverPlaylistView,
        onShowCharts: () => showLibraryView("charts"),
        onShowRecommend: showRecommendView,
        onOpenPlaylist: openPlaylist,
        onSongContextMenu: openSongContextMenu,
        onPlaylistContextMenu: openPlaylistContextMenu
      }
    ) : mainView === "discoverPlaylists" || isPlaylistSourceView(mainView) ? /* @__PURE__ */ React.createElement(
      PlaylistSourcePage,
      {
        state,
        sourceView: playlistSourceView,
        title: libraryTitle,
        kicker: libraryKicker,
        playlists: libraryPlaylists,
        playlistQuery,
        onPlaylistQueryChange: setPlaylistQuery,
        onSearchPlaylists: runPlaylistSearch,
        onRefresh: mainView === "discoverPlaylists" ? () => runtime.shuffleDiscoverPlaylists(playlistQuery) : refreshLibrary,
        onBack: mainView === "charts" || mainView === "discoverPlaylists" ? () => showLibraryView("discover") : void 0,
        onOpenPlaylist: openPlaylist,
        onPlaylistContextMenu: openPlaylistContextMenu
      }
    ) : mainView === "recommend" ? /* @__PURE__ */ React.createElement(
      SongCollectionPage,
      {
        title: "\u6BCF\u65E5\u63A8\u8350",
        kicker: "Daily Mix",
        count: state.recommendSongs.length,
        loading: state.loading === "recommend",
        songs: state.recommendSongs,
        currentSong: state.currentSong,
        likedSongIds: state.likedSongIds,
        emptyTitle: "\u6682\u65E0\u6BCF\u65E5\u63A8\u8350",
        emptyBody: "\u767B\u5F55\u540E\u5237\u65B0\u6BCF\u65E5\u63A8\u8350\u3002",
        onBack: () => showLibraryView("discover"),
        action: /* @__PURE__ */ React.createElement(Button, { variant: "ghost", size: "sm", className: "nm-icon-button", title: "\u5237\u65B0\u6BCF\u65E5\u63A8\u8350", onClick: () => runtime.loadRecommendSongs(true) }, /* @__PURE__ */ React.createElement(Icon, { name: "reset", size: 14 })),
        onSongContextMenu: openSongContextMenu
      }
    ) : /* @__PURE__ */ React.createElement(
      SongCollectionPage,
      {
        title: "\u6700\u8FD1\u64AD\u653E",
        kicker: "History",
        count: state.recentSongs.length,
        songs: state.recentSongs,
        currentSong: state.currentSong,
        likedSongIds: state.likedSongIds,
        emptyTitle: "\u6682\u65E0\u6700\u8FD1\u64AD\u653E",
        emptyBody: "\u64AD\u653E\u6B4C\u66F2\u540E\u4F1A\u5728\u8FD9\u91CC\u663E\u793A\u3002",
        onSongContextMenu: openSongContextMenu
      }
    )),
    /* @__PURE__ */ React.createElement(PlayerBar, { state, onExpand: openExpanded, onMini: () => setMiniOpen(true), onSongContextMenu: openSongContextMenu }),
    /* @__PURE__ */ React.createElement(LoginDialog, { open: loginOpen, onClose: closeLoginDialog, onLoggedIn: handleLoggedIn }),
    contextMenu ? /* @__PURE__ */ React.createElement(
      ContextMenu,
      {
        menu: contextMenu,
        onClose: () => setContextMenu(null),
        onOpenPlaylist: openPlaylist,
        onOpenArtist: openSongArtistDetail,
        onOpenAlbum: openSongAlbumDetail
      }
    ) : null,
    expanded ? /* @__PURE__ */ React.createElement(ExpandedPlayer, { state, closing: expandedClosing, onClose: closeExpanded }) : null,
    miniOpen ? /* @__PURE__ */ React.createElement(MiniPlayer, { state, onClose: () => setMiniOpen(false) }) : null
  );
}
function isPlaylistSourceView(view) {
  return view === "playlists" || view === "charts" || view === "discover";
}
function TopNav({
  view,
  onLibrary,
  onRecent
}) {
  const items = [
    { value: "playlists", label: "\u6211\u7684", icon: "playlist", onClick: () => onLibrary("playlists") },
    { value: "discover", label: "\u53D1\u73B0", icon: "search", onClick: () => onLibrary("discover") },
    { value: "recent", label: "\u6700\u8FD1", icon: "clock", onClick: onRecent }
  ];
  return /* @__PURE__ */ React.createElement("nav", { className: "nm-top-nav", "aria-label": "\u7F51\u6613\u4E91\u97F3\u4E50\u5BFC\u822A" }, items.map((item) => /* @__PURE__ */ React.createElement(
    Button,
    {
      key: item.value,
      variant: view === item.value ? "primary" : "ghost",
      size: "sm",
      className: "nm-top-nav-button",
      onClick: item.onClick
    },
    /* @__PURE__ */ React.createElement(Icon, { name: item.icon, size: 14 }),
    item.label
  )));
}
function SearchSuggestPopover({
  suggestions,
  query,
  canClearHistory,
  onSelect,
  onClearHistory
}) {
  const title = query.trim() ? "\u641C\u7D22\u5EFA\u8BAE" : "\u641C\u7D22\u5386\u53F2";
  return /* @__PURE__ */ React.createElement("div", { className: "nm-search-suggest", onMouseDown: (event) => event.preventDefault() }, /* @__PURE__ */ React.createElement("span", { className: "nm-search-suggest-head" }, /* @__PURE__ */ React.createElement("span", { className: "nm-search-suggest-title" }, title), canClearHistory ? /* @__PURE__ */ React.createElement("button", { className: "nm-search-clear-history", onClick: onClearHistory }, "\u6E05\u9664\u5386\u53F2") : null), suggestions.map((item) => /* @__PURE__ */ React.createElement("button", { key: item.type + "-" + item.value, className: "nm-search-suggest-item", onClick: () => onSelect(item.value) }, /* @__PURE__ */ React.createElement(Icon, { name: item.icon, size: 14 }), /* @__PURE__ */ React.createElement("span", null, item.label), /* @__PURE__ */ React.createElement("small", null, item.type))), !suggestions.length ? /* @__PURE__ */ React.createElement("span", { className: "nm-search-suggest-empty" }, "\u6682\u65E0\u641C\u7D22\u5EFA\u8BAE") : null);
}
function HomePage({
  state,
  loggedIn,
  onLogin,
  onOpenPlaylist,
  onShowLibrary,
  onShowRecommend,
  onShowRecent,
  onSongContextMenu,
  onPlaylistContextMenu
}) {
  const currentSong = state.currentSong;
  return /* @__PURE__ */ React.createElement("div", { className: "nm-home-stack" }, /* @__PURE__ */ React.createElement("section", { className: "nm-home-hero" }, /* @__PURE__ */ React.createElement("div", { className: "nm-home-hero-copy" }, /* @__PURE__ */ React.createElement("span", { className: "nm-kicker" }, "Now Playing"), /* @__PURE__ */ React.createElement("strong", null, currentSong?.name ?? "\u7F51\u6613\u4E91\u97F3\u4E50"), /* @__PURE__ */ React.createElement("span", null, currentSong?.artist ?? "\u4ECE\u6B4C\u5355\u3001\u699C\u5355\u6216\u641C\u7D22\u7ED3\u679C\u5F00\u59CB\u64AD\u653E\u3002")), /* @__PURE__ */ React.createElement("div", { className: "nm-home-hero-actions" }, /* @__PURE__ */ React.createElement(Button, { variant: "primary", size: "sm", onClick: onShowRecommend }, /* @__PURE__ */ React.createElement(Icon, { name: "heart", size: 14 }), "\u6BCF\u65E5\u63A8\u8350"), /* @__PURE__ */ React.createElement(Button, { variant: "ghost", size: "sm", onClick: () => onShowLibrary("discover") }, /* @__PURE__ */ React.createElement(Icon, { name: "search", size: 14 }), "\u53D1\u73B0\u6B4C\u5355"), !loggedIn ? /* @__PURE__ */ React.createElement(Button, { variant: "ghost", size: "sm", onClick: onLogin }, /* @__PURE__ */ React.createElement(Icon, { name: "signIn", size: 14 }), "\u767B\u5F55") : null)), /* @__PURE__ */ React.createElement(
    SongShelf,
    {
      title: "\u6BCF\u65E5\u63A8\u8350",
      kicker: "Daily Mix",
      songs: state.recommendSongs,
      currentSong: state.currentSong,
      emptyTitle: loggedIn ? "\u6682\u65E0\u6BCF\u65E5\u63A8\u8350" : "\u767B\u5F55\u540E\u67E5\u770B\u6BCF\u65E5\u63A8\u8350",
      onOpenMore: onShowRecommend,
      onSongContextMenu
    }
  ), /* @__PURE__ */ React.createElement(
    PlaylistShelf,
    {
      title: "\u6211\u7684\u6B4C\u5355",
      kicker: "My Library",
      playlists: state.userPlaylists,
      loginNickname: state.loginInfo?.nickname || "",
      activeId: state.activePlaylist?.id,
      emptyTitle: loggedIn ? "\u6682\u65E0\u6B4C\u5355" : "\u767B\u5F55\u540E\u540C\u6B65\u6211\u7684\u6B4C\u5355",
      onOpenMore: () => onShowLibrary("playlists"),
      onOpen: onOpenPlaylist,
      onPlaylistContextMenu
    }
  ), /* @__PURE__ */ React.createElement(
    PlaylistShelf,
    {
      title: "\u53D1\u73B0\u6B4C\u5355",
      kicker: "Discover",
      playlists: state.discoverPlaylists,
      loginNickname: state.loginInfo?.nickname || "",
      activeId: state.activePlaylist?.id,
      emptyTitle: "\u6682\u65E0\u53D1\u73B0\u6B4C\u5355",
      onOpenMore: () => onShowLibrary("discover"),
      onOpen: onOpenPlaylist,
      onPlaylistContextMenu
    }
  ), /* @__PURE__ */ React.createElement(
    PlaylistShelf,
    {
      title: "\u5B98\u65B9\u699C\u5355",
      kicker: "Charts",
      playlists: state.topPlaylists,
      loginNickname: state.loginInfo?.nickname || "",
      activeId: state.activePlaylist?.id,
      emptyTitle: "\u6682\u65E0\u699C\u5355",
      onOpenMore: () => onShowLibrary("charts"),
      onOpen: onOpenPlaylist,
      onPlaylistContextMenu
    }
  ), /* @__PURE__ */ React.createElement(
    SongShelf,
    {
      title: "\u6700\u8FD1\u64AD\u653E",
      kicker: "History",
      songs: state.recentSongs,
      currentSong: state.currentSong,
      emptyTitle: "\u6682\u65E0\u6700\u8FD1\u64AD\u653E",
      onOpenMore: onShowRecent,
      onSongContextMenu
    }
  ));
}
function DiscoverPage({
  state,
  onShowDiscoverPlaylists,
  onShowCharts,
  onShowRecommend,
  onOpenPlaylist,
  onSongContextMenu,
  onPlaylistContextMenu
}) {
  const loggedIn = Boolean(state.loginInfo?.logged_in);
  return /* @__PURE__ */ React.createElement("div", { className: "nm-home-stack nm-discover-stack" }, /* @__PURE__ */ React.createElement("div", { className: "nm-discover-title" }, /* @__PURE__ */ React.createElement("span", { className: "nm-kicker" }, "Discover"), /* @__PURE__ */ React.createElement("strong", null, "\u53D1\u73B0")), /* @__PURE__ */ React.createElement(
    SongShelf,
    {
      title: "\u6BCF\u65E5\u63A8\u8350",
      kicker: "Daily Mix",
      songs: state.recommendSongs,
      currentSong: state.currentSong,
      emptyTitle: loggedIn ? "\u6682\u65E0\u6BCF\u65E5\u63A8\u8350" : "\u767B\u5F55\u540E\u67E5\u770B\u6BCF\u65E5\u63A8\u8350",
      onOpenMore: onShowRecommend,
      onSongContextMenu
    }
  ), /* @__PURE__ */ React.createElement(
    PlaylistShelf,
    {
      title: "\u53D1\u73B0\u6B4C\u5355",
      kicker: "Playlists",
      playlists: state.discoverPlaylists,
      loginNickname: state.loginInfo?.nickname || "",
      activeId: state.activePlaylist?.id,
      emptyTitle: "\u6682\u65E0\u53D1\u73B0\u6B4C\u5355",
      onOpenMore: onShowDiscoverPlaylists,
      onOpen: onOpenPlaylist,
      onPlaylistContextMenu
    }
  ), /* @__PURE__ */ React.createElement(
    PlaylistShelf,
    {
      title: "\u5B98\u65B9\u699C\u5355",
      kicker: "Charts",
      playlists: state.topPlaylists,
      loginNickname: state.loginInfo?.nickname || "",
      activeId: state.activePlaylist?.id,
      emptyTitle: "\u6682\u65E0\u699C\u5355",
      onOpenMore: onShowCharts,
      onOpen: onOpenPlaylist,
      onPlaylistContextMenu
    }
  ));
}
function PlaylistSourcePage({
  state,
  sourceView,
  title,
  kicker,
  playlists,
  playlistQuery,
  onPlaylistQueryChange,
  onSearchPlaylists,
  onRefresh,
  onBack,
  onOpenPlaylist,
  onPlaylistContextMenu
}) {
  const requiresLogin = sourceView === "playlists" && !state.loginInfo?.logged_in;
  return /* @__PURE__ */ React.createElement("section", { className: "nm-card nm-page-card nm-list-page " + (sourceView === "charts" ? "nm-charts-page" : sourceView === "discover" ? "nm-discover-list-page" : "") }, /* @__PURE__ */ React.createElement("div", { className: "nm-card-head " + (sourceView === "charts" ? "nm-charts-head" : "") }, /* @__PURE__ */ React.createElement("span", { className: "nm-head-left" }, onBack ? /* @__PURE__ */ React.createElement(Button, { variant: "ghost", size: "sm", className: "nm-icon-button", title: "\u8FD4\u56DE\u53D1\u73B0", onClick: onBack }, /* @__PURE__ */ React.createElement(Icon, { name: "arrowLeft", size: 15 })) : null, /* @__PURE__ */ React.createElement("span", { className: "nm-head-copy" }, /* @__PURE__ */ React.createElement("span", { className: "nm-kicker" }, kicker), /* @__PURE__ */ React.createElement("strong", null, title))), /* @__PURE__ */ React.createElement("span", { className: "nm-head-actions" }, sourceView === "discover" ? /* @__PURE__ */ React.createElement("span", { className: "nm-playlist-search nm-discover-list-search" }, /* @__PURE__ */ React.createElement(
    TextField,
    {
      density: "compact",
      value: playlistQuery,
      placeholder: "\u641C\u7D22\u6B4C\u5355",
      onChange: (event) => onPlaylistQueryChange(event.target.value),
      onKeyDown: (event) => {
        if (event.key === "Enter") onSearchPlaylists();
      }
    }
  ), /* @__PURE__ */ React.createElement(Button, { variant: "primary", size: "sm", className: "nm-search-button", title: "\u641C\u7D22\u6B4C\u5355", onClick: onSearchPlaylists }, /* @__PURE__ */ React.createElement(Icon, { name: "search", size: 15 })), /* @__PURE__ */ React.createElement(Button, { variant: "ghost", size: "sm", className: "nm-icon-button", title: "\u6362\u4E00\u6279\u6B4C\u5355", onClick: onRefresh }, /* @__PURE__ */ React.createElement(Icon, { name: "reset", size: 15 }))) : /* @__PURE__ */ React.createElement(Button, { variant: "ghost", size: "sm", className: "nm-icon-button", title: "\u5237\u65B0", onClick: onRefresh }, /* @__PURE__ */ React.createElement(Icon, { name: "reset", size: 15 })))), requiresLogin ? /* @__PURE__ */ React.createElement(LoginPanel, null) : /* @__PURE__ */ React.createElement("div", { className: "nm-library-body" }, /* @__PURE__ */ React.createElement(
    PlaylistList,
    {
      playlists,
      activeId: state.activePlaylist?.id,
      loginNickname: state.loginInfo?.nickname || "",
      loading: state.loading === "playlists" || state.loading === "toplists" || state.loading === "discover-playlists" || state.loading === "playlist-search",
      onOpen: onOpenPlaylist,
      onPlaylistContextMenu
    }
  )));
}
function PlaylistDetailPage({
  state,
  onBack,
  onSongContextMenu
}) {
  const playlist = state.activePlaylist;
  return /* @__PURE__ */ React.createElement("section", { className: "nm-card nm-page-card nm-detail-page" }, /* @__PURE__ */ React.createElement("div", { className: "nm-detail-head" }, /* @__PURE__ */ React.createElement(Button, { variant: "ghost", size: "sm", className: "nm-icon-button", title: "\u8FD4\u56DE", onClick: onBack }, /* @__PURE__ */ React.createElement(Icon, { name: "arrowLeft", size: 16 })), playlist?.cover ? /* @__PURE__ */ React.createElement(CoverImage, { src: playlist.cover, kind: "playlist", className: "nm-detail-cover" }) : null, /* @__PURE__ */ React.createElement("span", { className: "nm-detail-copy" }, /* @__PURE__ */ React.createElement("span", { className: "nm-kicker" }, "Playlist Tracks"), /* @__PURE__ */ React.createElement("strong", null, playlist?.name ?? "\u6B4C\u5355"), /* @__PURE__ */ React.createElement("small", null, state.loading === "playlist" ? "\u52A0\u8F7D\u4E2D..." : state.activeTracks.length + " / " + (playlist?.track_count ?? state.activeTracks.length) + " \u9996", playlist?.creator ? " \xB7 " + playlist.creator : ""))), /* @__PURE__ */ React.createElement(
    SongList,
    {
      songs: state.activeTracks,
      currentSong: state.currentSong,
      likedSongIds: state.likedSongIds,
      loading: state.loading === "playlist",
      loadingMore: state.loading === "tracks",
      hasMore: state.hasMoreTracks,
      resetKey: playlist?.id,
      onEndReached: () => runtime.loadMoreTracks(),
      onSongContextMenu
    }
  ));
}
function AlbumDetailPage({
  album,
  state,
  onBack,
  onOpenArtist,
  onSongContextMenu
}) {
  const songs = state.mediaDetailSongs;
  const loading = state.loading === "album";
  const [tab, setTab] = useState("songs");
  const subtitle = [
    album.artist,
    album.song_count ? album.song_count + " \u9996" : "",
    formatPublishDate(album.publish_time)
  ].filter(Boolean).join(" \xB7 ");
  useEffect(() => {
    setTab("songs");
  }, [album.id]);
  return /* @__PURE__ */ React.createElement("section", { className: "nm-card nm-page-card nm-detail-page nm-media-detail-page" }, /* @__PURE__ */ React.createElement(
    MediaDetailHeader,
    {
      cover: album.cover,
      coverKind: "song",
      kicker: "Album",
      title: album.name,
      subtitle: subtitle || "\u4E13\u8F91\u6B4C\u66F2",
      onBack,
      songs,
      loading,
      tabs: [
        { value: "songs", label: "\u4E13\u8F91\u6B4C\u66F2", count: songs.length },
        { value: "artists", label: "\u76F8\u5173\u6B4C\u624B", count: state.mediaDetailArtists.length }
      ],
      activeTab: tab,
      onTabChange: (value) => setTab(value)
    }
  ), /* @__PURE__ */ React.createElement("div", { className: "nm-media-detail-body" }, tab === "artists" ? /* @__PURE__ */ React.createElement(ArtistList, { artists: state.mediaDetailArtists, onOpen: onOpenArtist }) : /* @__PURE__ */ React.createElement(
    SongList,
    {
      songs,
      currentSong: state.currentSong,
      likedSongIds: state.likedSongIds,
      loading,
      resetKey: "album-" + album.id,
      emptyTitle: "\u6682\u65E0\u4E13\u8F91\u6B4C\u66F2",
      emptyBody: "\u8BE5\u4E13\u8F91\u6682\u65F6\u6CA1\u6709\u53EF\u5C55\u793A\u7684\u6B4C\u66F2\u3002",
      onSongContextMenu
    }
  )));
}
function ArtistDetailPage({
  artist,
  state,
  onBack,
  onOpenAlbum,
  onSongContextMenu
}) {
  const songs = state.mediaDetailSongs;
  const loading = state.loading === "artist";
  const [tab, setTab] = useState("songs");
  useEffect(() => {
    setTab("songs");
  }, [artist.id]);
  return /* @__PURE__ */ React.createElement("section", { className: "nm-card nm-page-card nm-detail-page nm-media-detail-page" }, /* @__PURE__ */ React.createElement(
    MediaDetailHeader,
    {
      cover: artist.cover,
      coverKind: "avatar",
      kicker: "Artist",
      title: artist.name,
      subtitle: loading ? "\u6B63\u5728\u52A0\u8F7D\u70ED\u95E8\u6B4C\u66F2..." : songs.length ? "\u70ED\u95E8\u6B4C\u66F2 \xB7 " + songs.length + " \u9996" : "\u70ED\u95E8\u6B4C\u66F2",
      onBack,
      songs,
      loading,
      tabs: [
        { value: "songs", label: "\u70ED\u95E8\u6B4C\u66F2", count: songs.length },
        { value: "albums", label: "\u76F8\u5173\u4E13\u8F91", count: state.mediaDetailAlbums.length }
      ],
      activeTab: tab,
      onTabChange: (value) => setTab(value)
    }
  ), /* @__PURE__ */ React.createElement("div", { className: "nm-media-detail-body" }, tab === "albums" ? /* @__PURE__ */ React.createElement(AlbumList, { albums: state.mediaDetailAlbums, onOpen: onOpenAlbum }) : /* @__PURE__ */ React.createElement(
    SongList,
    {
      songs,
      currentSong: state.currentSong,
      likedSongIds: state.likedSongIds,
      loading,
      resetKey: "artist-" + artist.id,
      emptyTitle: "\u6682\u65E0\u6B4C\u624B\u6B4C\u66F2",
      emptyBody: "\u8BE5\u6B4C\u624B\u6682\u65F6\u6CA1\u6709\u53EF\u5C55\u793A\u7684\u70ED\u95E8\u6B4C\u66F2\u3002",
      onSongContextMenu
    }
  )));
}
function MediaDetailHeader({
  cover,
  coverKind,
  kicker,
  title,
  subtitle,
  songs,
  loading,
  tabs,
  activeTab,
  onTabChange,
  onBack
}) {
  const canUseSongs = songs.length > 0 && !loading;
  return /* @__PURE__ */ React.createElement("div", { className: "nm-media-detail-head" }, /* @__PURE__ */ React.createElement(Button, { variant: "ghost", size: "sm", className: "nm-icon-button nm-media-back", title: "\u8FD4\u56DE\u641C\u7D22", onClick: onBack }, /* @__PURE__ */ React.createElement(Icon, { name: "arrowLeft", size: 16 })), /* @__PURE__ */ React.createElement(CoverImage, { src: cover, kind: coverKind, className: "nm-media-detail-cover" }), /* @__PURE__ */ React.createElement("span", { className: "nm-media-detail-copy" }, /* @__PURE__ */ React.createElement("span", { className: "nm-kicker" }, kicker), /* @__PURE__ */ React.createElement("strong", null, title), /* @__PURE__ */ React.createElement("span", { className: "nm-media-meta-row" }, /* @__PURE__ */ React.createElement("small", null, subtitle), /* @__PURE__ */ React.createElement("span", { className: "nm-media-tabs" }, tabs.map((item) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: item.value,
      className: "nm-media-tab " + (activeTab === item.value ? "nm-media-tab-active" : ""),
      onClick: () => onTabChange(item.value)
    },
    item.label,
    /* @__PURE__ */ React.createElement("small", null, item.count)
  ))))), /* @__PURE__ */ React.createElement("span", { className: "nm-media-detail-actions" }, /* @__PURE__ */ React.createElement(
    Button,
    {
      variant: "primary",
      size: "sm",
      disabled: !canUseSongs,
      onClick: () => {
        if (songs[0]) void runtime.playSong(songs[0], songs);
      }
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "playFilled", size: 14 }),
    "\u64AD\u653E\u5168\u90E8"
  )));
}
function SearchPage({
  state,
  tab,
  onTabChange,
  onOpenPlaylist,
  onOpenAlbum,
  onOpenArtist,
  onSongContextMenu,
  onPlaylistContextMenu
}) {
  return /* @__PURE__ */ React.createElement("section", { className: "nm-card nm-page-card nm-list-page" }, /* @__PURE__ */ React.createElement("div", { className: "nm-card-head" }, /* @__PURE__ */ React.createElement("span", { className: "nm-head-copy" }, /* @__PURE__ */ React.createElement("span", { className: "nm-kicker" }, "Search Results"), /* @__PURE__ */ React.createElement("strong", null, "\u641C\u7D22\u7ED3\u679C")), /* @__PURE__ */ React.createElement("span", { className: "nm-count" }, state.loading ? "..." : state.searchResults.length)), /* @__PURE__ */ React.createElement(
    SearchResults,
    {
      state,
      tab,
      onTabChange,
      onOpenPlaylist,
      onOpenAlbum,
      onOpenArtist,
      onSongContextMenu,
      onPlaylistContextMenu
    }
  ));
}
function SongCollectionPage({
  title,
  kicker,
  count,
  songs,
  currentSong,
  likedSongIds,
  loading = false,
  emptyTitle,
  emptyBody,
  onBack,
  action,
  onSongContextMenu
}) {
  return /* @__PURE__ */ React.createElement("section", { className: "nm-card nm-page-card nm-list-page" }, /* @__PURE__ */ React.createElement("div", { className: "nm-card-head" }, /* @__PURE__ */ React.createElement("span", { className: "nm-head-left" }, onBack ? /* @__PURE__ */ React.createElement(Button, { variant: "ghost", size: "sm", className: "nm-icon-button", title: "\u8FD4\u56DE\u53D1\u73B0", onClick: onBack }, /* @__PURE__ */ React.createElement(Icon, { name: "arrowLeft", size: 15 })) : null, /* @__PURE__ */ React.createElement("span", { className: "nm-head-copy" }, /* @__PURE__ */ React.createElement("span", { className: "nm-kicker" }, kicker), /* @__PURE__ */ React.createElement("span", { className: "nm-head-title-row" }, /* @__PURE__ */ React.createElement("strong", null, title), /* @__PURE__ */ React.createElement("span", { className: "nm-count nm-title-count" }, loading ? "..." : count)))), /* @__PURE__ */ React.createElement("span", { className: "nm-head-actions" }, action)), /* @__PURE__ */ React.createElement(SongList, { songs, currentSong, likedSongIds, loading, emptyTitle, emptyBody, onSongContextMenu }));
}
function PlaylistShelf({
  title,
  kicker,
  playlists,
  activeId,
  loginNickname,
  emptyTitle,
  onOpenMore,
  onOpen,
  onPlaylistContextMenu
}) {
  const visible = playlists.slice(0, 10);
  return /* @__PURE__ */ React.createElement("section", { className: "nm-home-section" }, /* @__PURE__ */ React.createElement("div", { className: "nm-home-section-head" }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("span", { className: "nm-kicker" }, kicker), /* @__PURE__ */ React.createElement("strong", null, title)), onOpenMore ? /* @__PURE__ */ React.createElement(Button, { variant: "ghost", size: "sm", onClick: onOpenMore }, "\u67E5\u770B\u5168\u90E8") : null), visible.length ? /* @__PURE__ */ React.createElement("div", { className: "nm-cover-strip" }, visible.map((playlist) => {
    const canToggleSubscribe = playlist.subscribed || Boolean(loginNickname) && playlist.creator !== loginNickname;
    return /* @__PURE__ */ React.createElement(
      "div",
      {
        key: playlist.id,
        role: "button",
        tabIndex: 0,
        className: "nm-cover-card " + (activeId === playlist.id ? "nm-cover-card-active" : ""),
        onClick: () => onOpen(playlist),
        onContextMenu: (event) => onPlaylistContextMenu(event, playlist, canToggleSubscribe),
        onKeyDown: (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen(playlist);
          }
        }
      },
      /* @__PURE__ */ React.createElement(CoverImage, { src: playlist.cover, kind: "playlist", className: "nm-cover-card-image" }),
      /* @__PURE__ */ React.createElement("strong", null, playlist.name),
      /* @__PURE__ */ React.createElement("small", null, playlist.track_count, " \u9996")
    );
  })) : /* @__PURE__ */ React.createElement("div", { className: "nm-home-empty" }, emptyTitle));
}
function SongShelf({
  title,
  kicker,
  songs,
  currentSong,
  emptyTitle,
  onOpenMore,
  onSongContextMenu
}) {
  const visible = songs.slice(0, 10);
  return /* @__PURE__ */ React.createElement("section", { className: "nm-home-section" }, /* @__PURE__ */ React.createElement("div", { className: "nm-home-section-head" }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("span", { className: "nm-kicker" }, kicker), /* @__PURE__ */ React.createElement("strong", null, title)), /* @__PURE__ */ React.createElement(Button, { variant: "ghost", size: "sm", onClick: onOpenMore }, "\u67E5\u770B\u5168\u90E8")), visible.length ? /* @__PURE__ */ React.createElement("div", { className: "nm-song-strip" }, visible.map((song, index) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: song.id + "-" + index,
      role: "button",
      tabIndex: 0,
      className: "nm-song-tile " + (currentSong?.id === song.id ? "nm-song-tile-active" : ""),
      onClick: () => void runtime.playSong(song, songs),
      onContextMenu: (event) => onSongContextMenu(event, song, songs),
      onKeyDown: (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          void runtime.playSong(song, songs);
        }
      }
    },
    /* @__PURE__ */ React.createElement(CoverImage, { src: song.cover, kind: "song", className: "nm-song-tile-cover" }),
    /* @__PURE__ */ React.createElement("span", { className: "nm-song-tile-copy" }, /* @__PURE__ */ React.createElement("strong", null, song.name), /* @__PURE__ */ React.createElement("small", null, song.artist)),
    /* @__PURE__ */ React.createElement("span", { className: "nm-song-tile-duration" }, formatDuration(song.duration))
  ))) : /* @__PURE__ */ React.createElement("div", { className: "nm-home-empty" }, emptyTitle));
}
function SearchResults({
  state,
  tab,
  onTabChange,
  onOpenPlaylist,
  onOpenAlbum,
  onOpenArtist,
  onSongContextMenu,
  onPlaylistContextMenu
}) {
  const tabs = [
    { value: "songs", label: "\u5355\u66F2", count: state.searchResults.length },
    { value: "playlists", label: "\u6B4C\u5355", count: state.searchPlaylists.length },
    { value: "albums", label: "\u4E13\u8F91", count: state.searchAlbums.length },
    { value: "artists", label: "\u6B4C\u624B", count: state.searchArtists.length }
  ];
  return /* @__PURE__ */ React.createElement("div", { className: "nm-search-results" }, /* @__PURE__ */ React.createElement("span", { className: "nm-panel-tabs nm-search-tabs" }, tabs.map((item) => /* @__PURE__ */ React.createElement(
    Button,
    {
      key: item.value,
      variant: tab === item.value ? "primary" : "ghost",
      size: "sm",
      className: "nm-panel-tab",
      onClick: () => onTabChange(item.value)
    },
    item.label,
    /* @__PURE__ */ React.createElement("small", null, item.count)
  ))), tab === "songs" ? /* @__PURE__ */ React.createElement(SongList, { songs: state.searchResults, currentSong: state.currentSong, likedSongIds: state.likedSongIds, loading: state.loading === "search" || state.loading === "album" || state.loading === "artist", emptyTitle: "\u6682\u65E0\u641C\u7D22\u7ED3\u679C", emptyBody: "\u8F93\u5165\u5173\u952E\u8BCD\u540E\u6309\u56DE\u8F66\u6216\u70B9\u51FB\u641C\u7D22\u3002", onSongContextMenu }) : tab === "playlists" ? /* @__PURE__ */ React.createElement(PlaylistList, { playlists: state.searchPlaylists, activeId: state.activePlaylist?.id, loginNickname: state.loginInfo?.nickname || "", loading: state.loading === "search", onOpen: onOpenPlaylist, onPlaylistContextMenu }) : tab === "albums" ? /* @__PURE__ */ React.createElement(AlbumList, { albums: state.searchAlbums, onOpen: onOpenAlbum }) : /* @__PURE__ */ React.createElement(ArtistList, { artists: state.searchArtists, onOpen: onOpenArtist }));
}
function AlbumList({ albums, onOpen }) {
  if (!albums.length) return /* @__PURE__ */ React.createElement(EmptyState, { icon: "music", title: "\u6682\u65E0\u4E13\u8F91", body: "\u6362\u4E2A\u5173\u952E\u8BCD\u518D\u8BD5\u3002" });
  return /* @__PURE__ */ React.createElement("div", { className: "nm-scroll-list" }, albums.map((album) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: album.id,
      role: "button",
      tabIndex: 0,
      className: "nm-playlist-row",
      onClick: () => onOpen(album),
      onKeyDown: (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(album);
        }
      }
    },
    /* @__PURE__ */ React.createElement(CoverImage, { src: album.cover, kind: "song", className: "nm-row-cover" }),
    /* @__PURE__ */ React.createElement("span", { className: "nm-row-copy" }, /* @__PURE__ */ React.createElement("span", { className: "nm-title" }, album.name), /* @__PURE__ */ React.createElement("span", { className: "nm-sub" }, album.artist, album.song_count ? " \xB7 " + album.song_count + " \u9996" : "")),
    /* @__PURE__ */ React.createElement(Icon, { name: "music", size: 16 })
  )));
}
function ArtistList({ artists, onOpen }) {
  if (!artists.length) return /* @__PURE__ */ React.createElement(EmptyState, { icon: "user", title: "\u6682\u65E0\u6B4C\u624B", body: "\u6362\u4E2A\u5173\u952E\u8BCD\u518D\u8BD5\u3002" });
  return /* @__PURE__ */ React.createElement("div", { className: "nm-scroll-list" }, artists.map((artist) => /* @__PURE__ */ React.createElement(
    "div",
    {
      key: artist.id,
      role: "button",
      tabIndex: 0,
      className: "nm-playlist-row",
      onClick: () => onOpen(artist),
      onKeyDown: (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(artist);
        }
      }
    },
    /* @__PURE__ */ React.createElement(CoverImage, { src: artist.cover, kind: "avatar", className: "nm-row-cover" }),
    /* @__PURE__ */ React.createElement("span", { className: "nm-row-copy" }, /* @__PURE__ */ React.createElement("span", { className: "nm-title" }, artist.name), /* @__PURE__ */ React.createElement("span", { className: "nm-sub" }, "\u70ED\u95E8\u6B4C\u66F2")),
    /* @__PURE__ */ React.createElement(Icon, { name: "user", size: 16 })
  )));
}
function ContextMenu({
  menu,
  onClose,
  onOpenPlaylist,
  onOpenArtist,
  onOpenAlbum
}) {
  const songArtists = menu.kind === "song" ? songContextArtists(menu.song) : [];
  const songAlbum = menu.kind === "song" ? menu.song.album.trim() : "";
  const item = (label, onClick, icon) => /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "nm-context-item",
      onClick: (event) => {
        event.stopPropagation();
        onClick();
        onClose();
      }
    },
    icon ? /* @__PURE__ */ React.createElement(Icon, { name: icon, size: 14 }) : null,
    label
  );
  const artistMenu = () => {
    if (!songArtists.length) return null;
    if (songArtists.length === 1) return item("\u67E5\u770B\u6B4C\u624B", () => onOpenArtist(songArtists[0]), "user");
    return /* @__PURE__ */ React.createElement("span", { className: "nm-context-submenu" }, /* @__PURE__ */ React.createElement("button", { className: "nm-context-item nm-context-submenu-trigger", onClick: (event) => event.stopPropagation() }, /* @__PURE__ */ React.createElement(Icon, { name: "user", size: 14 }), "\u67E5\u770B\u6B4C\u624B", /* @__PURE__ */ React.createElement(Icon, { name: "caretRight", size: 13 })), /* @__PURE__ */ React.createElement("span", { className: "nm-context-submenu-panel" }, songArtists.map((artist, index) => /* @__PURE__ */ React.createElement(
      "button",
      {
        key: (artist.id || artist.name) + "-" + index,
        className: "nm-context-item",
        onClick: (event) => {
          event.stopPropagation();
          onOpenArtist(artist);
          onClose();
        }
      },
      /* @__PURE__ */ React.createElement(Icon, { name: "user", size: 14 }),
      artist.name
    ))));
  };
  return /* @__PURE__ */ React.createElement("div", { className: "nm-context-menu", style: { left: menu.x, top: menu.y }, onClick: (event) => event.stopPropagation() }, menu.kind === "song" ? /* @__PURE__ */ React.createElement(React.Fragment, null, item("\u64AD\u653E", () => void runtime.playSong(menu.song, menu.queue), "play"), item("\u4E0B\u4E00\u9996\u64AD\u653E", () => void runtime.playNext(menu.song), "skipForward"), artistMenu(), songAlbum ? item("\u67E5\u770B\u4E13\u8F91", () => onOpenAlbum(menu.song), "music") : null, item(menu.liked ? "\u53D6\u6D88\u559C\u6B22" : "\u559C\u6B22", () => void runtime.toggleLike(menu.song.id), menu.liked ? "heartFilled" : "heart"), menu.inQueue ? item("\u4ECE\u961F\u5217\u79FB\u9664", () => runtime.removeFromQueue(menu.song.id), "close") : null, menu.inQueue ? item("\u6E05\u7A7A\u961F\u5217", () => runtime.clearQueue(), "playlist") : null) : /* @__PURE__ */ React.createElement(React.Fragment, null, item("\u6253\u5F00\u6B4C\u5355", () => onOpenPlaylist(menu.playlist), "playlist"), menu.canToggleSubscribe ? item(menu.playlist.subscribed ? "\u53D6\u6D88\u6536\u85CF" : "\u6536\u85CF\u6B4C\u5355", () => void runtime.togglePlaylistSubscribe(menu.playlist), menu.playlist.subscribed ? "bookmarkFilled" : "bookmark") : null));
}
function AccountPanel({ state, loggedIn, onLogin }) {
  const login = state.loginInfo;
  const badge = login?.is_svip ? "SVIP" : login?.is_vip ? "VIP" : "\u5DF2\u767B\u5F55";
  if (!loggedIn) {
    return /* @__PURE__ */ React.createElement(Button, { variant: "primary", size: "sm", onClick: onLogin }, /* @__PURE__ */ React.createElement(Icon, { name: "signIn", size: 14 }), "\u767B\u5F55");
  }
  return /* @__PURE__ */ React.createElement("div", { className: "nm-account-panel" }, /* @__PURE__ */ React.createElement(CoverImage, { src: login?.avatar || "", kind: "avatar", className: "nm-avatar" }), /* @__PURE__ */ React.createElement("span", { className: "nm-account-copy" }, /* @__PURE__ */ React.createElement("strong", null, login?.nickname || "\u7F51\u6613\u4E91\u8D26\u53F7"), /* @__PURE__ */ React.createElement("small", null, badge)), /* @__PURE__ */ React.createElement(Button, { variant: "ghost", size: "sm", className: "nm-account-logout", title: "\u767B\u51FA", onClick: () => runtime.logout() }, /* @__PURE__ */ React.createElement(Icon, { name: "signOut", size: 14 })));
}
function LoginPanel() {
  return /* @__PURE__ */ React.createElement("div", { className: "nm-empty nm-login-panel" }, /* @__PURE__ */ React.createElement("span", { className: "nm-empty-icon" }, /* @__PURE__ */ React.createElement(Icon, { name: "music", size: 22 })), /* @__PURE__ */ React.createElement("strong", null, "\u7F51\u6613\u4E91\u97F3\u4E50"), /* @__PURE__ */ React.createElement("span", null, "\u767B\u5F55\u540E\u4F1A\u5728\u8FD9\u91CC\u663E\u793A\u4F60\u7684\u6B4C\u5355\u3002"));
}
function LoginDialog({ open, onClose, onLoggedIn }) {
  const [tab, setTab] = useState("qr");
  const [qrKey, setQrKey] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [qrStatus, setQrStatus] = useState("");
  const [qrMessage, setQrMessage] = useState("\u6B63\u5728\u751F\u6210\u4E8C\u7EF4\u7801...");
  const [qrLoading, setQrLoading] = useState(false);
  const [qrNonce, setQrNonce] = useState(0);
  const [countrycode, setCountrycode] = useState("86");
  const [phone, setPhone] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [captchaCooldown, setCaptchaCooldown] = useState(0);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState("");
  useEffect(() => {
    if (!open) {
      setQrKey("");
      setQrImage("");
      setQrStatus("");
      setQrMessage("\u6B63\u5728\u751F\u6210\u4E8C\u7EF4\u7801...");
      setQrLoading(false);
      setPhoneLoading(false);
      setPhoneMessage("");
    }
  }, [open]);
  useEffect(() => {
    if (!open || tab !== "qr") return;
    let cancelled = false;
    let pollTimer = null;
    const loadQr = async () => {
      setQrLoading(true);
      setQrKey("");
      setQrImage("");
      setQrStatus("");
      setQrMessage("\u6B63\u5728\u751F\u6210\u4E8C\u7EF4\u7801...");
      try {
        const qr = await runtime.createQrLogin();
        if (cancelled) return;
        setQrKey(qr.unikey);
        setQrImage(qr.qr_image);
        setQrStatus("801");
        setQrMessage("\u8BF7\u4F7F\u7528\u7F51\u6613\u4E91\u97F3\u4E50 App \u626B\u7801\u767B\u5F55");
        pollTimer = window.setInterval(() => {
          void runtime.checkQrLogin(qr.unikey).then((result) => {
            if (cancelled) return;
            setQrStatus(String(result.code));
            setQrMessage(qrLoginMessage(result.code, result.message));
            if (result.logged_in || result.code === 803) {
              if (pollTimer !== null) window.clearInterval(pollTimer);
              pollTimer = null;
              onLoggedIn();
              onClose();
            } else if (result.code === 800 && pollTimer !== null) {
              window.clearInterval(pollTimer);
              pollTimer = null;
            }
          }).catch((error) => {
            if (cancelled) return;
            if (pollTimer !== null) window.clearInterval(pollTimer);
            pollTimer = null;
            setQrStatus("error");
            setQrMessage(error instanceof Error ? error.message : String(error));
          });
        }, 2e3);
      } catch (error) {
        if (!cancelled) {
          setQrStatus("error");
          setQrMessage(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) setQrLoading(false);
      }
    };
    void loadQr();
    return () => {
      cancelled = true;
      if (pollTimer !== null) window.clearInterval(pollTimer);
    };
  }, [open, tab, qrNonce]);
  useEffect(() => {
    if (!open || captchaCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCaptchaCooldown((value) => Math.max(0, value - 1));
    }, 1e3);
    return () => window.clearInterval(timer);
  }, [open, captchaCooldown]);
  const sendCaptcha = () => {
    const trimmedPhone = phone.trim();
    const trimmedCountrycode = countrycode.trim() || "86";
    if (!trimmedPhone) {
      setPhoneMessage("\u8BF7\u8F93\u5165\u624B\u673A\u53F7");
      return;
    }
    setPhoneLoading(true);
    setPhoneMessage("");
    void runtime.sendLoginCaptcha(trimmedPhone, trimmedCountrycode).then((result) => {
      if (result.code && result.code !== 200) {
        setPhoneMessage(result.message || "\u9A8C\u8BC1\u7801\u53D1\u9001\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
        return;
      }
      setPhoneMessage("\u9A8C\u8BC1\u7801\u5DF2\u53D1\u9001\uFF0C\u8BF7\u67E5\u770B\u624B\u673A\u77ED\u4FE1");
      setCaptchaCooldown(60);
    }).catch((error) => {
      setPhoneMessage(error instanceof Error ? error.message : String(error));
    }).finally(() => {
      setPhoneLoading(false);
    });
  };
  const loginWithPhone = () => {
    const trimmedPhone = phone.trim();
    const trimmedCaptcha = captcha.trim();
    const trimmedCountrycode = countrycode.trim() || "86";
    if (!trimmedPhone) {
      setPhoneMessage("\u8BF7\u8F93\u5165\u624B\u673A\u53F7");
      return;
    }
    if (!trimmedCaptcha) {
      setPhoneMessage("\u8BF7\u8F93\u5165\u77ED\u4FE1\u9A8C\u8BC1\u7801");
      return;
    }
    setPhoneLoading(true);
    setPhoneMessage("");
    void runtime.loginWithCellphone(trimmedPhone, trimmedCaptcha, trimmedCountrycode).then(() => {
      onLoggedIn();
      onClose();
    }).catch((error) => {
      setPhoneMessage(error instanceof Error ? error.message : String(error));
    }).finally(() => {
      setPhoneLoading(false);
    });
  };
  return /* @__PURE__ */ React.createElement(Dialog, { open, onClose, title: "\u767B\u5F55\u7F51\u6613\u4E91\u97F3\u4E50", className: "nm-login-dialog nm-login-dialog-" + tab }, /* @__PURE__ */ React.createElement("div", { className: "nm-login-dialog-body" }, /* @__PURE__ */ React.createElement("div", { className: "nm-login-tabs" }, /* @__PURE__ */ React.createElement(Button, { variant: tab === "qr" ? "primary" : "ghost", size: "sm", className: "nm-login-tab", onClick: () => setTab("qr") }, /* @__PURE__ */ React.createElement(Icon, { name: "grid", size: 14 }), "\u4E8C\u7EF4\u7801\u767B\u5F55"), /* @__PURE__ */ React.createElement(Button, { variant: tab === "phone" ? "primary" : "ghost", size: "sm", className: "nm-login-tab", onClick: () => setTab("phone") }, /* @__PURE__ */ React.createElement(Icon, { name: "user", size: 14 }), "\u624B\u673A\u53F7\u767B\u5F55")), tab === "qr" ? /* @__PURE__ */ React.createElement("div", { className: "nm-qr-panel" }, /* @__PURE__ */ React.createElement("div", { className: "nm-qr-image " + (qrLoading ? "nm-qr-loading" : "") }, qrImage ? /* @__PURE__ */ React.createElement("img", { src: qrImage, alt: "\u7F51\u6613\u4E91\u97F3\u4E50\u767B\u5F55\u4E8C\u7EF4\u7801" }) : /* @__PURE__ */ React.createElement(Icon, { name: "grid", size: 42 })), /* @__PURE__ */ React.createElement("span", { className: "nm-login-status " + (qrStatus === "800" || qrStatus === "error" ? "nm-login-status-error" : "") }, qrLoading ? "\u6B63\u5728\u751F\u6210\u4E8C\u7EF4\u7801..." : qrLoginMessage(qrStatus, qrMessage)), /* @__PURE__ */ React.createElement("div", { className: "nm-login-actions" }, /* @__PURE__ */ React.createElement(Button, { variant: "ghost", size: "sm", onClick: () => setQrNonce((value) => value + 1), disabled: qrLoading }, /* @__PURE__ */ React.createElement(Icon, { name: "reset", size: 14 }), "\u5237\u65B0\u4E8C\u7EF4\u7801")), qrKey ? /* @__PURE__ */ React.createElement("span", { className: "nm-login-hint" }, "\u4E8C\u7EF4\u7801\u4EC5\u7528\u4E8E\u7F51\u6613\u4E91\u97F3\u4E50\u5B98\u65B9\u6388\u6743\u767B\u5F55\uFF0C\u4E0D\u4F1A\u5728\u63D2\u4EF6\u4E2D\u4FDD\u5B58 Cookie\u3002") : null) : /* @__PURE__ */ React.createElement("div", { className: "nm-phone-panel" }, /* @__PURE__ */ React.createElement("div", { className: "nm-phone-form" }, /* @__PURE__ */ React.createElement("label", { className: "nm-phone-field nm-phone-country" }, /* @__PURE__ */ React.createElement("span", null, "\u533A\u53F7"), /* @__PURE__ */ React.createElement(
    TextField,
    {
      density: "compact",
      className: "nm-phone-input",
      value: countrycode,
      placeholder: "86",
      inputMode: "numeric",
      maxLength: 4,
      autoComplete: "tel-country-code",
      onChange: (event) => setCountrycode(event.target.value)
    }
  )), /* @__PURE__ */ React.createElement("label", { className: "nm-phone-field" }, /* @__PURE__ */ React.createElement("span", null, "\u624B\u673A\u53F7"), /* @__PURE__ */ React.createElement(
    TextField,
    {
      density: "compact",
      className: "nm-phone-input",
      value: phone,
      placeholder: "\u8BF7\u8F93\u5165\u624B\u673A\u53F7",
      inputMode: "tel",
      maxLength: 11,
      autoComplete: "tel-national",
      onChange: (event) => setPhone(event.target.value)
    }
  ))), /* @__PURE__ */ React.createElement("div", { className: "nm-phone-form nm-phone-captcha-form" }, /* @__PURE__ */ React.createElement("label", { className: "nm-phone-field" }, /* @__PURE__ */ React.createElement("span", null, "\u9A8C\u8BC1\u7801"), /* @__PURE__ */ React.createElement(
    TextField,
    {
      density: "compact",
      className: "nm-phone-input",
      value: captcha,
      placeholder: "\u8BF7\u8F93\u5165\u77ED\u4FE1\u9A8C\u8BC1\u7801",
      inputMode: "numeric",
      maxLength: 4,
      autoComplete: "one-time-code",
      onChange: (event) => setCaptcha(event.target.value),
      onKeyDown: (event) => {
        if (event.key === "Enter") loginWithPhone();
      }
    }
  )), /* @__PURE__ */ React.createElement(Button, { className: "nm-phone-send", variant: "ghost", size: "sm", onClick: sendCaptcha, disabled: phoneLoading || captchaCooldown > 0 }, captchaCooldown > 0 ? captchaCooldown + "s" : "\u53D1\u9001\u9A8C\u8BC1\u7801")), phoneMessage ? /* @__PURE__ */ React.createElement("span", { className: "nm-login-status nm-phone-status " + (phoneMessage.includes("\u5931\u8D25") || phoneMessage.includes("error") ? "nm-login-status-error" : "") }, phoneMessage) : null, /* @__PURE__ */ React.createElement("div", { className: "nm-login-actions" }, /* @__PURE__ */ React.createElement(Button, { variant: "primary", size: "sm", className: "nm-phone-submit", onClick: loginWithPhone, disabled: phoneLoading }, /* @__PURE__ */ React.createElement(Icon, { name: "signIn", size: 14 }), phoneLoading ? "\u767B\u5F55\u4E2D..." : "\u767B\u5F55")))));
}
function PlaylistList({
  playlists,
  activeId,
  loginNickname,
  loading = false,
  onOpen,
  onPlaylistContextMenu
}) {
  if (loading && !playlists.length) return /* @__PURE__ */ React.createElement(SkeletonList, { kind: "playlist" });
  if (!playlists.length) return /* @__PURE__ */ React.createElement(EmptyState, { icon: "playlist", title: "\u6682\u65E0\u6B4C\u5355", body: "\u5237\u65B0\u8D26\u53F7\u72B6\u6001\u540E\u518D\u8BD5\u3002" });
  return /* @__PURE__ */ React.createElement("div", { className: "nm-scroll-list" }, playlists.map((playlist) => /* @__PURE__ */ React.createElement(PlaylistRow, { key: playlist.id, playlist, active: activeId === playlist.id, loginNickname, onOpen, onPlaylistContextMenu })));
}
function PlaylistRow({
  playlist,
  active,
  loginNickname,
  onOpen,
  onPlaylistContextMenu
}) {
  const canToggleSubscribe = playlist.subscribed || Boolean(loginNickname) && playlist.creator !== loginNickname;
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      role: "button",
      tabIndex: 0,
      className: "nm-playlist-row " + (active ? "nm-row-active" : ""),
      onClick: () => onOpen(playlist),
      onContextMenu: (event) => onPlaylistContextMenu(event, playlist, canToggleSubscribe),
      onKeyDown: (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(playlist);
        }
      }
    },
    /* @__PURE__ */ React.createElement(CoverImage, { src: playlist.cover, kind: "playlist", className: "nm-row-cover" }),
    /* @__PURE__ */ React.createElement("span", { className: "nm-row-copy" }, /* @__PURE__ */ React.createElement("span", { className: "nm-title" }, playlist.name), /* @__PURE__ */ React.createElement("span", { className: "nm-sub" }, playlist.track_count, " \u9996", playlist.creator ? " \xB7 " + playlist.creator : "")),
    canToggleSubscribe ? /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "ghost",
        size: "sm",
        className: "nm-row-action nm-subscribe-button " + (playlist.subscribed ? "nm-subscribe-active" : ""),
        title: playlist.subscribed ? "\u53D6\u6D88\u6536\u85CF\u6B4C\u5355" : "\u6536\u85CF\u6B4C\u5355",
        onClick: (event) => {
          event.stopPropagation();
          void runtime.togglePlaylistSubscribe(playlist);
        }
      },
      /* @__PURE__ */ React.createElement(Icon, { name: playlist.subscribed ? "bookmarkFilled" : "bookmark", size: 15 })
    ) : /* @__PURE__ */ React.createElement(Icon, { name: "playlist", size: 16 })
  );
}
function SongList({
  songs,
  currentSong,
  likedSongIds,
  loading = false,
  loadingMore = false,
  hasMore = false,
  resetKey,
  onEndReached,
  onSongContextMenu,
  emptyTitle = "\u6682\u65E0\u6B4C\u66F2",
  emptyBody = "\u641C\u7D22\u6B4C\u66F2\u6216\u9009\u62E9\u4E00\u4E2A\u6B4C\u5355\u3002"
}) {
  const { scrollRef, scrollTop, viewportHeight, handleScroll, lastLoadLenRef } = useVirtualSongList(resetKey);
  const viewport = viewportHeight || SONG_ROW_STEP * 8;
  const startIndex = Math.max(0, Math.floor(scrollTop / SONG_ROW_STEP) - SONG_LIST_OVERSCAN);
  const endIndex = Math.min(songs.length, Math.ceil((scrollTop + viewport) / SONG_ROW_STEP) + SONG_LIST_OVERSCAN);
  const visibleSongs = songs.slice(startIndex, endIndex);
  const topSpacer = startIndex * SONG_ROW_STEP;
  const bottomSpacer = Math.max(0, (songs.length - endIndex) * SONG_ROW_STEP);
  const onScroll = () => {
    handleScroll();
    const el = scrollRef.current;
    if (!el || !onEndReached || !hasMore || loadingMore || loading) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceToBottom <= SONG_LIST_END_THRESHOLD && lastLoadLenRef.current !== songs.length) {
      lastLoadLenRef.current = songs.length;
      onEndReached();
    }
  };
  if (loading && !songs.length) return /* @__PURE__ */ React.createElement(SkeletonList, { kind: "song" });
  if (!songs.length) return /* @__PURE__ */ React.createElement(EmptyState, { icon: "music", title: emptyTitle, body: emptyBody });
  return /* @__PURE__ */ React.createElement("div", { ref: scrollRef, className: "nm-scroll-list nm-virtual-list", onScroll }, /* @__PURE__ */ React.createElement("div", { className: "nm-virtual-spacer", style: { height: topSpacer } }), visibleSongs.map((song, index) => /* @__PURE__ */ React.createElement("div", { key: song.id + "-" + (startIndex + index), className: "nm-virtual-item" }, /* @__PURE__ */ React.createElement(SongRow, { song, index: startIndex + index, currentSong, queue: songs, liked: likedSongIds.includes(song.id), onSongContextMenu }))), /* @__PURE__ */ React.createElement("div", { className: "nm-virtual-spacer", style: { height: bottomSpacer } }), hasMore ? /* @__PURE__ */ React.createElement(ListLoadFooter, { loading: loadingMore }) : null);
}
function SkeletonList({ kind }) {
  return /* @__PURE__ */ React.createElement("div", { className: "nm-scroll-list nm-skeleton-list", "aria-hidden": "true" }, Array.from({ length: 7 }).map((_, index) => /* @__PURE__ */ React.createElement("div", { key: index, className: kind === "song" ? "nm-song-row nm-skeleton-row" : "nm-playlist-row nm-skeleton-row" }, /* @__PURE__ */ React.createElement("span", { className: "nm-row-cover nm-skeleton-block" }), kind === "song" ? /* @__PURE__ */ React.createElement("span", { className: "nm-index nm-skeleton-text nm-skeleton-short" }) : null, /* @__PURE__ */ React.createElement("span", { className: "nm-row-copy" }, /* @__PURE__ */ React.createElement("span", { className: "nm-skeleton-text nm-skeleton-title" }), /* @__PURE__ */ React.createElement("span", { className: "nm-skeleton-text nm-skeleton-sub" })), kind === "song" ? /* @__PURE__ */ React.createElement("span", { className: "nm-duration nm-skeleton-text nm-skeleton-short" }) : null, /* @__PURE__ */ React.createElement("span", { className: "nm-row-action nm-skeleton-dot" }))));
}
function useVirtualSongList(resetKey) {
  const scrollRef = useRef(null);
  const frameRef = useRef(null);
  const lastLoadLenRef = useRef(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setViewportHeight(el.clientHeight);
    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, []);
  useEffect(() => {
    lastLoadLenRef.current = 0;
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
    setScrollTop(0);
  }, [resetKey]);
  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
  }, []);
  const handleScroll = () => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const el = scrollRef.current;
      if (!el) return;
      const nextTop = el.scrollTop;
      setScrollTop(
        (previous) => Math.floor(previous / SONG_ROW_STEP) === Math.floor(nextTop / SONG_ROW_STEP) ? previous : nextTop
      );
    });
  };
  return { scrollRef, scrollTop, viewportHeight, handleScroll, lastLoadLenRef };
}
function ListLoadFooter({ loading }) {
  return /* @__PURE__ */ React.createElement("div", { className: "nm-list-footer" }, /* @__PURE__ */ React.createElement(Icon, { name: loading ? "reset" : "chevronDown", size: 14 }), /* @__PURE__ */ React.createElement("span", null, loading ? "\u6B63\u5728\u52A0\u8F7D..." : "\u7EE7\u7EED\u5411\u4E0B\u6EDA\u52A8"));
}
function useProgressiveRenderCount(songs, minimumCount = 0) {
  const signature = songs.length + ":" + (songs[0]?.id || "") + ":" + (songs[songs.length - 1]?.id || "");
  const safeMinimum = Math.min(songs.length, Math.max(0, minimumCount));
  const [renderCount, setRenderCount] = useState(() => Math.min(songs.length, Math.max(SONG_RENDER_CHUNK_SIZE, safeMinimum)));
  useEffect(() => {
    const firstChunk = Math.min(songs.length, Math.max(SONG_RENDER_CHUNK_SIZE, safeMinimum));
    setRenderCount(firstChunk);
    if (songs.length <= firstChunk) return;
    let frame = 0;
    let cancelled = false;
    const reveal = () => {
      if (cancelled) return;
      setRenderCount((current) => {
        const next = Math.min(songs.length, current + SONG_RENDER_CHUNK_SIZE);
        if (next < songs.length) frame = window.requestAnimationFrame(reveal);
        return next;
      });
    };
    frame = window.requestAnimationFrame(reveal);
    return () => {
      cancelled = true;
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [signature, safeMinimum]);
  return Math.min(renderCount, songs.length);
}
function SongRow({
  song,
  index,
  currentSong,
  queue,
  liked,
  onSongContextMenu,
  compact = false
}) {
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      role: "button",
      tabIndex: 0,
      className: ["nm-song-row", compact ? "nm-song-row-compact" : "", currentSong?.id === song.id ? "nm-row-active" : ""].filter(Boolean).join(" "),
      onClick: () => runtime.playSong(song, queue),
      onContextMenu: (event) => onSongContextMenu(event, song, queue),
      onKeyDown: (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          void runtime.playSong(song, queue);
        }
      }
    },
    /* @__PURE__ */ React.createElement(CoverImage, { src: song.cover, kind: "song", className: "nm-row-cover" }),
    /* @__PURE__ */ React.createElement("span", { className: "nm-index" }, String(index + 1).padStart(2, "0")),
    /* @__PURE__ */ React.createElement("span", { className: "nm-row-copy" }, /* @__PURE__ */ React.createElement("span", { className: "nm-title" }, song.name), /* @__PURE__ */ React.createElement("span", { className: "nm-sub" }, song.artist, song.album ? " \xB7 " + song.album : "")),
    /* @__PURE__ */ React.createElement("span", { className: "nm-duration" }, formatDuration(song.duration)),
    /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: "ghost",
        size: "sm",
        className: "nm-row-action nm-like-button " + (liked ? "nm-like-active" : ""),
        title: liked ? "\u53D6\u6D88\u559C\u6B22" : "\u559C\u6B22",
        onClick: (event) => {
          event.stopPropagation();
          void runtime.toggleLike(song.id);
        }
      },
      /* @__PURE__ */ React.createElement(Icon, { name: liked ? "heartFilled" : "heart", size: 15 })
    )
  );
}
function PlayerBar({
  state,
  onExpand,
  onMini,
  onSongContextMenu
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const queueRef = useRef(null);
  const stopBarInteraction = (event) => event.stopPropagation();
  const handleBarClick = (event) => {
    const target = event.target;
    if (target?.closest("button, input, label, a, [role='button'], .nm-progress-row, .nm-controls, .nm-player-tools")) return;
    onExpand();
  };
  useEffect(() => {
    if (!queueOpen) return;
    const close = (event) => {
      if (queueRef.current?.contains(event.target)) return;
      setQueueOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setQueueOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [queueOpen]);
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("section", { className: "nm-player-bar", onClick: handleBarClick }, /* @__PURE__ */ React.createElement("div", { className: "nm-progress-row", onClick: stopBarInteraction }, /* @__PURE__ */ React.createElement("span", { className: "nm-time-label" }, formatTime(state.currentTime)), /* @__PURE__ */ React.createElement("div", { className: "nm-progress" }, /* @__PURE__ */ React.createElement(
    Slider,
    {
      min: 0,
      max: Math.max(1, state.duration),
      step: 1,
      value: Math.min(state.currentTime, Math.max(1, state.duration)),
      onChange: (value) => runtime.seek(value)
    }
  )), /* @__PURE__ */ React.createElement("span", { className: "nm-time-label" }, formatTime(state.duration))), /* @__PURE__ */ React.createElement("div", { className: "nm-player-main" }, /* @__PURE__ */ React.createElement("div", { className: "nm-now-brief" }, state.currentCoverUrl ? /* @__PURE__ */ React.createElement("img", { className: "nm-mini-cover", src: state.currentCoverUrl, alt: "" }) : /* @__PURE__ */ React.createElement("span", { className: "nm-mini-cover nm-cover-fallback" }, /* @__PURE__ */ React.createElement(Icon, { name: "music", size: 18 })), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("strong", null, state.currentSong?.name ?? "\u672A\u64AD\u653E"), /* @__PURE__ */ React.createElement("small", null, state.currentSong?.artist ?? "\u7F51\u6613\u4E91\u97F3\u4E50"))), /* @__PURE__ */ React.createElement("div", { className: "nm-controls", onClick: stopBarInteraction }, /* @__PURE__ */ React.createElement(Button, { variant: "ghost", size: "sm", className: "nm-control-button", title: "\u4E0A\u4E00\u9996", onClick: () => runtime.prevTrack() }, /* @__PURE__ */ React.createElement(Icon, { name: "skipBackFilled", size: 17 })), /* @__PURE__ */ React.createElement(Button, { variant: "primary", size: "lg", className: "nm-play-button", title: "\u64AD\u653E\u6216\u6682\u505C", onClick: () => runtime.togglePlay() }, /* @__PURE__ */ React.createElement(Icon, { name: state.isPlaying ? "pauseFilled" : "playFilled", size: 20 })), /* @__PURE__ */ React.createElement(Button, { variant: "ghost", size: "sm", className: "nm-control-button", title: "\u4E0B\u4E00\u9996", onClick: () => runtime.nextTrack() }, /* @__PURE__ */ React.createElement(Icon, { name: "skipForwardFilled", size: 17 })), /* @__PURE__ */ React.createElement(ModeButton, { mode: state.playMode })), /* @__PURE__ */ React.createElement("div", { className: "nm-player-tools", onClick: stopBarInteraction }, state.currentSong ? /* @__PURE__ */ React.createElement(
    Button,
    {
      variant: "ghost",
      size: "sm",
      className: "nm-settings-button nm-like-button " + (state.likedSongIds.includes(state.currentSong.id) ? "nm-like-active" : ""),
      title: state.likedSongIds.includes(state.currentSong.id) ? "\u53D6\u6D88\u559C\u6B22" : "\u559C\u6B22",
      onClick: () => state.currentSong && runtime.toggleLike(state.currentSong.id)
    },
    /* @__PURE__ */ React.createElement(Icon, { name: state.likedSongIds.includes(state.currentSong.id) ? "heartFilled" : "heart", size: 15 })
  ) : null, /* @__PURE__ */ React.createElement(Button, { variant: "ghost", size: "sm", className: "nm-settings-button", title: "\u64AD\u653E\u5668\u8BBE\u7F6E", onClick: () => setSettingsOpen(true) }, /* @__PURE__ */ React.createElement(Icon, { name: "settings", size: 15 })), onMini ? /* @__PURE__ */ React.createElement(Button, { variant: "ghost", size: "sm", className: "nm-settings-button", title: "\u8FF7\u4F60\u6A21\u5F0F", onClick: onMini }, /* @__PURE__ */ React.createElement(Icon, { name: "musicFilled", size: 15 })) : null, /* @__PURE__ */ React.createElement("label", { className: "nm-volume" }, /* @__PURE__ */ React.createElement(
    Button,
    {
      variant: "ghost",
      size: "sm",
      className: "nm-volume-mute",
      title: state.muted ? "\u53D6\u6D88\u9759\u97F3" : "\u9759\u97F3",
      onClick: (event) => {
        event.preventDefault();
        runtime.toggleMute();
      }
    },
    /* @__PURE__ */ React.createElement(Icon, { name: state.muted ? "speakerMuteFilled" : "speakerFilled", size: 14 })
  ), /* @__PURE__ */ React.createElement(Slider, { min: 0, max: 1, step: 0.01, value: state.volume, onChange: (value) => runtime.setVolume(value) })), /* @__PURE__ */ React.createElement("div", { ref: queueRef, className: "nm-queue-anchor" }, /* @__PURE__ */ React.createElement(
    Button,
    {
      variant: queueOpen ? "primary" : "ghost",
      size: "sm",
      className: "nm-settings-button nm-queue-button",
      title: "\u64AD\u653E\u961F\u5217",
      onClick: () => setQueueOpen((open) => !open)
    },
    /* @__PURE__ */ React.createElement(Icon, { name: "playlist", size: 16 })
  ), queueOpen ? /* @__PURE__ */ React.createElement(QueuePopover, { state, onSongContextMenu }) : null)))), /* @__PURE__ */ React.createElement(SettingsDialog, { open: settingsOpen, onClose: () => setSettingsOpen(false), state }));
}
function QueuePopover({
  state,
  onSongContextMenu
}) {
  const activeIndex = state.currentSong ? state.queue.findIndex((song) => song.id === state.currentSong?.id) : -1;
  const activeSongId = activeIndex >= 0 ? state.queue[activeIndex]?.id || "" : "";
  const activeRowRef = useRef(null);
  const lastLocatedSongRef = useRef("");
  const renderCount = useProgressiveRenderCount(state.queue, activeIndex >= 0 ? activeIndex + 1 : 0);
  const visibleSongs = state.queue.slice(0, renderCount);
  const playQueuedSong = (song) => {
    void runtime.playSong(song, state.queue);
  };
  useEffect(() => {
    if (!activeSongId || activeIndex >= renderCount) return;
    const frame = window.requestAnimationFrame(() => {
      const behavior = lastLocatedSongRef.current ? "smooth" : "auto";
      activeRowRef.current?.scrollIntoView({ block: "center", behavior });
      lastLocatedSongRef.current = activeSongId;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeSongId, activeIndex, renderCount]);
  return /* @__PURE__ */ React.createElement("section", { className: "nm-queue-popover", onClick: (event) => event.stopPropagation() }, /* @__PURE__ */ React.createElement("header", { className: "nm-queue-head" }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("strong", null, "\u64AD\u653E\u961F\u5217"), /* @__PURE__ */ React.createElement("small", null, state.queue.length ? state.queue.length + " \u9996" : "\u6682\u65E0\u6B4C\u66F2")), state.queue.length ? /* @__PURE__ */ React.createElement(Button, { variant: "ghost", size: "sm", className: "nm-queue-clear", title: "\u6E05\u7A7A\u961F\u5217", onClick: () => runtime.clearQueue() }, /* @__PURE__ */ React.createElement(Icon, { name: "trash", size: 14 })) : null), state.queue.length ? /* @__PURE__ */ React.createElement("div", { className: "nm-queue-list" }, visibleSongs.map((song, index) => /* @__PURE__ */ React.createElement(
    QueuePopoverRow,
    {
      key: song.id + "-" + index,
      song,
      index,
      active: state.currentSong?.id === song.id,
      activeRef: state.currentSong?.id === song.id ? activeRowRef : void 0,
      queue: state.queue,
      onPlay: playQueuedSong,
      onSongContextMenu
    }
  ))) : /* @__PURE__ */ React.createElement("div", { className: "nm-queue-empty" }, /* @__PURE__ */ React.createElement(Icon, { name: "playlist", size: 24 }), /* @__PURE__ */ React.createElement("span", null, "\u4ECE\u6B4C\u5355\u6216\u641C\u7D22\u7ED3\u679C\u4E2D\u9009\u62E9\u6B4C\u66F2")));
}
function QueuePopoverRow({
  song,
  index,
  active,
  activeRef,
  queue,
  onPlay,
  onSongContextMenu
}) {
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      role: "button",
      ref: activeRef,
      tabIndex: 0,
      className: "nm-queue-row " + (active ? "nm-queue-row-active" : ""),
      onClick: () => onPlay(song),
      onContextMenu: (event) => onSongContextMenu(event, song, queue),
      onKeyDown: (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPlay(song);
        }
      }
    },
    /* @__PURE__ */ React.createElement("span", { className: "nm-queue-index" }, active ? /* @__PURE__ */ React.createElement(Icon, { name: "playFilled", size: 13 }) : index + 1),
    /* @__PURE__ */ React.createElement("span", { className: "nm-queue-copy" }, /* @__PURE__ */ React.createElement("strong", null, song.name), /* @__PURE__ */ React.createElement("small", null, song.artist)),
    /* @__PURE__ */ React.createElement("span", { className: "nm-queue-duration" }, formatDuration(song.duration))
  );
}
function MiniPlayer({ state, onClose }) {
  return /* @__PURE__ */ React.createElement("section", { className: "nm-floating-mini", onClick: (event) => event.stopPropagation() }, state.currentCoverUrl ? /* @__PURE__ */ React.createElement("img", { className: "nm-floating-mini-cover", src: state.currentCoverUrl, alt: "" }) : /* @__PURE__ */ React.createElement("span", { className: "nm-floating-mini-cover nm-cover-fallback" }, /* @__PURE__ */ React.createElement(Icon, { name: "music", size: 18 })), /* @__PURE__ */ React.createElement("span", { className: "nm-floating-mini-copy" }, /* @__PURE__ */ React.createElement("strong", null, state.currentSong?.name ?? "\u672A\u64AD\u653E"), /* @__PURE__ */ React.createElement("small", null, state.currentSong?.artist ?? "\u9009\u62E9\u6B4C\u66F2\u5F00\u59CB\u64AD\u653E")), /* @__PURE__ */ React.createElement("span", { className: "nm-floating-mini-controls" }, /* @__PURE__ */ React.createElement(Button, { variant: "ghost", size: "sm", className: "nm-control-button", title: "\u4E0A\u4E00\u9996", onClick: () => runtime.prevTrack() }, /* @__PURE__ */ React.createElement(Icon, { name: "skipBackFilled", size: 15 })), /* @__PURE__ */ React.createElement(Button, { variant: "primary", size: "sm", className: "nm-floating-mini-play", title: "\u64AD\u653E\u6216\u6682\u505C", onClick: () => runtime.togglePlay() }, /* @__PURE__ */ React.createElement(Icon, { name: state.isPlaying ? "pauseFilled" : "playFilled", size: 16 })), /* @__PURE__ */ React.createElement(Button, { variant: "ghost", size: "sm", className: "nm-control-button", title: "\u4E0B\u4E00\u9996", onClick: () => runtime.nextTrack() }, /* @__PURE__ */ React.createElement(Icon, { name: "skipForwardFilled", size: 15 })), /* @__PURE__ */ React.createElement(Button, { variant: "ghost", size: "sm", className: "nm-control-button", title: "\u5173\u95ED\u8FF7\u4F60\u6A21\u5F0F", onClick: onClose }, /* @__PURE__ */ React.createElement(Icon, { name: "close", size: 15 }))));
}
function SettingsDialog({ open, onClose, state }) {
  const [cacheStats, setCacheStats] = useState(() => runtime.getCacheStats());
  useEffect(() => {
    if (open) setCacheStats(runtime.getCacheStats());
  }, [open]);
  const refreshCacheStats = () => setCacheStats(runtime.getCacheStats());
  const clearCoverCache = () => {
    runtime.clearCoverCache();
    refreshCacheStats();
  };
  const clearPlaylistCache = () => {
    runtime.clearPlaylistCache();
    refreshCacheStats();
  };
  const clearAllCaches = () => {
    runtime.clearAllCaches();
    refreshCacheStats();
  };
  return /* @__PURE__ */ React.createElement(Dialog, { open, onClose, title: "\u64AD\u653E\u5668\u8BBE\u7F6E", className: "nm-settings-card" }, /* @__PURE__ */ React.createElement("div", { className: "nm-settings-dialog" }, /* @__PURE__ */ React.createElement("div", { className: "nm-settings-section" }, /* @__PURE__ */ React.createElement("span", { className: "nm-dialog-label" }, "\u80CC\u666F"), /* @__PURE__ */ React.createElement("div", { className: "nm-settings-row" }, /* @__PURE__ */ React.createElement("span", { className: "nm-settings-copy" }, /* @__PURE__ */ React.createElement("strong", null, "\u663E\u793A\u5F53\u524D\u6B4C\u66F2\u5C01\u9762"), /* @__PURE__ */ React.createElement("small", null, "\u5173\u95ED\u540E\u4FDD\u7559\u4E3B\u9898\u8272\uFF0C\u4E0D\u518D\u628A\u5C01\u9762\u94FA\u5230\u80CC\u666F\u5361\u7247\u3002")), /* @__PURE__ */ React.createElement(
    Button,
    {
      variant: state.showCoverBackground ? "primary" : "ghost",
      size: "sm",
      className: "nm-toggle-button",
      onClick: () => runtime.toggleCoverBackground()
    },
    state.showCoverBackground ? "\u5F00\u542F" : "\u5173\u95ED"
  ))), /* @__PURE__ */ React.createElement("div", { className: "nm-settings-section" }, /* @__PURE__ */ React.createElement("span", { className: "nm-dialog-label" }, "\u5FEB\u6377\u952E"), /* @__PURE__ */ React.createElement("div", { className: "nm-settings-row" }, /* @__PURE__ */ React.createElement("span", { className: "nm-settings-copy" }, /* @__PURE__ */ React.createElement("strong", null, "\u542F\u7528\u9875\u9762\u5FEB\u6377\u952E"), /* @__PURE__ */ React.createElement("small", null, "\u7A7A\u683C\u64AD\u653E/\u6682\u505C\uFF0C\u5DE6\u53F3\u5207\u6B4C\uFF0C\u4E0A\u4E0B\u8C03\u6574\u97F3\u91CF\uFF0C\u4EC5\u63D2\u4EF6\u9875\u9762\u5185\u751F\u6548\u3002")), /* @__PURE__ */ React.createElement(
    Button,
    {
      variant: state.keyboardShortcutsEnabled ? "primary" : "ghost",
      size: "sm",
      className: "nm-toggle-button",
      onClick: () => runtime.toggleKeyboardShortcuts()
    },
    state.keyboardShortcutsEnabled ? "\u5F00\u542F" : "\u5173\u95ED"
  ))), /* @__PURE__ */ React.createElement("div", { className: "nm-settings-section" }, /* @__PURE__ */ React.createElement("span", { className: "nm-dialog-label" }, "\u7F13\u5B58"), /* @__PURE__ */ React.createElement("div", { className: "nm-cache-panel" }, /* @__PURE__ */ React.createElement("span", null, "\u5C01\u9762\u7F13\u5B58 \u5F53\u524D ", cacheStats.coverCount, " \u9879", cacheStats.coverPendingCount ? "\uFF0C\u52A0\u8F7D\u4E2D " + cacheStats.coverPendingCount + " \u9879" : ""), /* @__PURE__ */ React.createElement("span", null, "\u6B4C\u5355\u7F13\u5B58 \u5F53\u524D ", cacheStats.playlistCount, " \u4E2A / ", cacheStats.playlistTrackCount, " \u9996"), /* @__PURE__ */ React.createElement("span", null, "\u5217\u8868\u7F13\u5B58 ", cacheStats.persistedListCount, " \u7EC4"), /* @__PURE__ */ React.createElement("span", { className: "nm-cache-actions" }, /* @__PURE__ */ React.createElement(Button, { variant: "ghost", size: "sm", className: "nm-cache-button", onClick: clearCoverCache }, "\u6E05\u5C01\u9762"), /* @__PURE__ */ React.createElement(Button, { variant: "ghost", size: "sm", className: "nm-cache-button", onClick: clearPlaylistCache }, "\u6E05\u6B4C\u5355"), /* @__PURE__ */ React.createElement(Button, { variant: "primary", size: "sm", className: "nm-cache-button", onClick: clearAllCaches }, "\u5168\u90E8\u6E05\u7406")))), /* @__PURE__ */ React.createElement("div", { className: "nm-settings-section" }, /* @__PURE__ */ React.createElement("span", { className: "nm-dialog-label" }, "\u97F3\u8D28"), /* @__PURE__ */ React.createElement(QualityGroup, { value: state.quality }))));
}
function ExpandedPlayer({ state, closing, onClose }) {
  const activeRef = useRef(null);
  const activeLyric = activeLyricIndex(state.lyrics, state.currentTime);
  const showTrialBadge = state.trial && !hasMusicMembership(state.loginInfo);
  const coverBackgroundUrl = state.showCoverBackground ? state.currentCoverUrl : "";
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeLyric]);
  return /* @__PURE__ */ React.createElement(
    "section",
    {
      className: "nm-expanded-player " + (closing ? "nm-expanded-closing" : ""),
      style: coverBackgroundUrl ? { backgroundImage: 'url("' + coverBackgroundUrl + '")' } : void 0
    },
    /* @__PURE__ */ React.createElement("div", { className: "nm-expanded-overlay" }),
    /* @__PURE__ */ React.createElement("div", { className: "nm-expanded-content" }, /* @__PURE__ */ React.createElement("header", { className: "nm-expanded-top" }, /* @__PURE__ */ React.createElement(Button, { variant: "ghost", size: "sm", className: "nm-icon-button", title: "\u6536\u8D77", onClick: onClose }, /* @__PURE__ */ React.createElement(Icon, { name: "chevronDown", size: 18 })), /* @__PURE__ */ React.createElement("span", { className: "nm-kicker" }, "Now Playing"), /* @__PURE__ */ React.createElement("span", { className: "nm-lyrics-tools" }, /* @__PURE__ */ React.createElement(
      Button,
      {
        variant: state.showLyricTranslation ? "primary" : "ghost",
        size: "sm",
        className: "nm-panel-tab",
        title: "\u663E\u793A\u7FFB\u8BD1",
        onClick: () => runtime.toggleLyricTranslation()
      },
      "\u8BD1"
    ), ["compact", "normal", "large"].map((size) => /* @__PURE__ */ React.createElement(
      Button,
      {
        key: size,
        variant: state.lyricFontSize === size ? "primary" : "ghost",
        size: "sm",
        className: "nm-lyric-size-button",
        title: size === "compact" ? "\u5C0F\u5B57\u53F7" : size === "large" ? "\u5927\u5B57\u53F7" : "\u6807\u51C6\u5B57\u53F7",
        onClick: () => runtime.setLyricFontSize(size)
      },
      size === "compact" ? "\u5C0F" : size === "large" ? "\u5927" : "\u4E2D"
    )))), /* @__PURE__ */ React.createElement("div", { className: "nm-expanded-grid" }, /* @__PURE__ */ React.createElement("section", { className: "nm-cover-stage" }, /* @__PURE__ */ React.createElement("div", { className: "nm-cover-wrap" }, /* @__PURE__ */ React.createElement("div", { className: "nm-vinyl " + (state.isPlaying ? "nm-vinyl-playing" : "") }), /* @__PURE__ */ React.createElement("div", { className: "nm-cover-frame" }, state.currentCoverUrl ? /* @__PURE__ */ React.createElement("img", { className: "nm-cover", src: state.currentCoverUrl, alt: "" }) : /* @__PURE__ */ React.createElement("span", { className: "nm-cover nm-cover-empty" }, /* @__PURE__ */ React.createElement(Icon, { name: "music", size: 72 })), showTrialBadge ? /* @__PURE__ */ React.createElement("span", { className: "nm-badge" }, "\u8BD5\u542C\u7247\u6BB5") : null)), /* @__PURE__ */ React.createElement("div", { className: "nm-track-meta" }, /* @__PURE__ */ React.createElement("strong", null, state.currentSong?.name ?? "\u672A\u64AD\u653E"), /* @__PURE__ */ React.createElement("span", null, state.currentSong?.artist ?? "\u9009\u62E9\u4E00\u9996\u6B4C\u66F2\u5F00\u59CB\u64AD\u653E"))), /* @__PURE__ */ React.createElement("section", { className: "nm-lyrics-panel nm-lyrics-" + state.lyricFontSize }, state.lyrics.length ? state.lyrics.map((line, index) => /* @__PURE__ */ React.createElement(
      "div",
      {
        key: line.time + "-" + index,
        ref: index === activeLyric ? activeRef : void 0,
        className: "nm-lyric-line " + (index === activeLyric ? "nm-lyric-active" : ""),
        role: "button",
        tabIndex: 0,
        title: "\u8DF3\u8F6C\u5230\u8FD9\u4E00\u53E5",
        onClick: () => runtime.seek(line.time),
        onKeyDown: (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            runtime.seek(line.time);
          }
        }
      },
      /* @__PURE__ */ React.createElement("div", null, line.text),
      state.showLyricTranslation && line.translation ? /* @__PURE__ */ React.createElement("small", null, line.translation) : null
    )) : /* @__PURE__ */ React.createElement(LyricStatusState, { state }))), /* @__PURE__ */ React.createElement(PlayerBar, { state, onExpand: () => void 0 }))
  );
}
function LyricStatusState({ state }) {
  const meta = state.lyricStatus === "loading" ? { icon: "reset", title: "\u6B63\u5728\u52A0\u8F7D\u6B4C\u8BCD", body: "\u6B4C\u8BCD\u4F1A\u5728\u64AD\u653E\u5F00\u59CB\u540E\u81EA\u52A8\u540C\u6B65\u3002" } : state.lyricStatus === "instrumental" ? { icon: "music", title: "\u7EAF\u97F3\u4E50", body: "\u8FD9\u9996\u6B4C\u6CA1\u6709\u6B4C\u8BCD\uFF0C\u4E13\u5FC3\u542C\u65CB\u5F8B\u5C31\u597D\u3002" } : state.currentSong ? { icon: "music", title: "\u6682\u65E0\u6B4C\u8BCD", body: "\u5F53\u524D\u6B4C\u66F2\u6682\u65F6\u6CA1\u6709\u53EF\u5C55\u793A\u7684\u6B4C\u8BCD\u3002" } : { icon: "music", title: "\u672A\u64AD\u653E", body: "\u9009\u62E9\u4E00\u9996\u6B4C\u66F2\u540E\u4F1A\u663E\u793A\u6B4C\u8BCD\u3002" };
  return /* @__PURE__ */ React.createElement("div", { className: "nm-lyric-status " + (state.lyricStatus === "loading" ? "nm-lyric-status-loading" : "") }, /* @__PURE__ */ React.createElement("span", { className: "nm-lyric-status-icon" }, /* @__PURE__ */ React.createElement(Icon, { name: meta.icon, size: 22 })), /* @__PURE__ */ React.createElement("strong", null, meta.title), /* @__PURE__ */ React.createElement("small", null, meta.body));
}
function ModeButton({ mode }) {
  const meta = mode === "shuffle" ? { icon: "shuffle", title: "\u968F\u673A\u64AD\u653E", next: "one" } : mode === "one" ? { icon: "repeatOnce", title: "\u5355\u66F2\u5FAA\u73AF", next: "list" } : { icon: "repeat", title: "\u5217\u8868\u5FAA\u73AF", next: "shuffle" };
  return /* @__PURE__ */ React.createElement(Button, { variant: "ghost", size: "sm", className: "nm-mode-button " + (mode !== "list" ? "nm-mode-active" : ""), title: meta.title, onClick: () => runtime.setPlayMode(meta.next) }, /* @__PURE__ */ React.createElement(Icon, { name: meta.icon, size: 15 }));
}
function QualityGroup({ value }) {
  return /* @__PURE__ */ React.createElement("div", { className: "nm-quality-group" }, [
    { value: "standard", label: "\u6807\u51C6" },
    { value: "exhigh", label: "\u8F83\u9AD8" },
    { value: "lossless", label: "\u65E0\u635F" },
    { value: "hires", label: "Hi-Res" }
  ].map((option) => /* @__PURE__ */ React.createElement(
    Button,
    {
      key: option.value,
      variant: option.value === value ? "primary" : "ghost",
      size: "sm",
      className: "nm-quality-button",
      onClick: () => runtime.setQuality(option.value)
    },
    option.label
  )));
}
function isShortcutTargetAllowed(target) {
  if (!(target instanceof Element)) return true;
  return !target.closest("input, textarea, select, button, label, [contenteditable='true'], [role='button']");
}
function hasMusicMembership(loginInfo) {
  if (!loginInfo?.logged_in) return false;
  return Boolean(loginInfo.is_vip || loginInfo.is_svip || (loginInfo.vip_type ?? 0) > 0 || (loginInfo.vip_level ?? 0) > 0);
}
function qrLoginMessage(code, fallback) {
  const normalized = String(code || "");
  if (normalized === "800") return "\u4E8C\u7EF4\u7801\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u65B0\u626B\u7801";
  if (normalized === "801") return "\u8BF7\u4F7F\u7528\u7F51\u6613\u4E91\u97F3\u4E50 App \u626B\u7801\u767B\u5F55";
  if (normalized === "802") return "\u5DF2\u626B\u7801\uFF0C\u8BF7\u5728\u624B\u673A\u4E0A\u786E\u8BA4\u767B\u5F55";
  if (normalized === "803") return "\u767B\u5F55\u6210\u529F\uFF0C\u6B63\u5728\u5237\u65B0\u8D26\u53F7\u4FE1\u606F";
  return fallback || "\u7B49\u5F85\u626B\u7801\u786E\u8BA4";
}
function CoverImage({ src, kind, className }) {
  const [cover, setCover] = useState(() => ({
    src: src || "",
    url: src ? runtime.cachedCoverProxyUrl(src) : ""
  }));
  useEffect(() => {
    let cancelled = false;
    if (!src) {
      setCover({ src: "", url: "" });
      return;
    }
    const cached = runtime.cachedCoverProxyUrl(src);
    if (cached) {
      setCover({ src, url: cached });
      return;
    }
    setCover({ src, url: "" });
    runtime.coverProxyUrl(src).then((next) => {
      if (!cancelled) setCover({ src, url: next });
    });
    return () => {
      cancelled = true;
    };
  }, [src]);
  if (cover.src === src && cover.url) return /* @__PURE__ */ React.createElement("img", { className, src: cover.url, alt: "", loading: "lazy", decoding: "async" });
  return /* @__PURE__ */ React.createElement("span", { className: className + " nm-cover-fallback" }, /* @__PURE__ */ React.createElement(Icon, { name: kind === "playlist" ? "playlist" : kind === "avatar" ? "user" : "music", size: kind === "avatar" ? 17 : 16 }));
}
function EmptyState({ icon, title, body }) {
  return /* @__PURE__ */ React.createElement("div", { className: "nm-empty" }, /* @__PURE__ */ React.createElement("span", { className: "nm-empty-icon" }, /* @__PURE__ */ React.createElement(Icon, { name: icon, size: 20 })), /* @__PURE__ */ React.createElement("strong", null, title), /* @__PURE__ */ React.createElement("span", null, body));
}
async function extractThemeColor(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = 32;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve("");
          return;
        }
        ctx.drawImage(image, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 16) {
          const alpha = data[i + 3];
          if (alpha < 180) continue;
          const pr = data[i];
          const pg = data[i + 1];
          const pb = data[i + 2];
          const max = Math.max(pr, pg, pb);
          const min = Math.min(pr, pg, pb);
          if (max < 45 || max > 238 || max - min < 18) continue;
          r += pr;
          g += pg;
          b += pb;
          count += 1;
        }
        if (!count) {
          resolve("");
          return;
        }
        resolve(rgbToHex(Math.round(r / count), Math.round(g / count), Math.round(b / count)));
      } catch {
        resolve("");
      }
    };
    image.onerror = () => resolve("");
    image.src = src;
  });
}
function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0")).join("")}`;
}
function formatDuration(ms) {
  return formatTime(Math.round(ms / 1e3));
}
function formatPublishDate(value) {
  if (!value) return "";
  const timestamp = value > 1e11 ? value : value * 1e3;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function songContextArtists(song) {
  const artists = [];
  const seen = /* @__PURE__ */ new Set();
  const add = (artist) => {
    const name = artist?.name?.trim();
    if (!name) return;
    const key = (artist?.id || name).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    artists.push({ id: artist?.id || "", name, cover: artist?.cover || "" });
  };
  for (const artist of song.artists || []) add(artist);
  if (!artists.length) {
    for (const name of (song.artist || "").split(/\s*(?:\/|、|,|，|&|feat\.?|ft\.?)\s*/i)) add({ name });
  }
  return artists;
}
function buildSearchSuggestions(query, state) {
  const keyword = query.trim().toLowerCase();
  const items = [];
  const push = (value, type, icon) => {
    const normalized = value.trim();
    if (!normalized) return;
    if (keyword && !normalized.toLowerCase().includes(keyword)) return;
    if (items.some((item) => item.value === normalized)) return;
    items.push({ value: normalized, label: normalized, type, icon });
  };
  for (const value of state.searchHistory) push(value, "\u5386\u53F2", "clock");
  if (!keyword) return items.slice(0, 8);
  for (const song of [...state.searchResults, ...state.recentSongs, ...state.recommendSongs]) {
    push(song.name, "\u5355\u66F2", "music");
    push(song.artist, "\u6B4C\u624B", "user");
    if (song.album) push(song.album, "\u4E13\u8F91", "music");
  }
  for (const playlist of [...state.userPlaylists, ...state.discoverPlaylists, ...state.topPlaylists, ...state.searchPlaylists]) {
    push(playlist.name, "\u6B4C\u5355", "playlist");
  }
  for (const album of [...state.searchAlbums, ...state.mediaDetailAlbums]) push(album.name, "\u4E13\u8F91", "music");
  for (const artist of [...state.searchArtists, ...state.mediaDetailArtists]) push(artist.name, "\u6B4C\u624B", "user");
  return items.slice(0, 8);
}
function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = String(total % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}
export {
  setup,
  teardown
};
