import React, { Button, Dialog, Icon, Slider, TextField, useEffect, useRef, useState } from "sdk";
import { activeLyricIndex } from "./lyrics";
import { runtime } from "./runtime";
import { cssText } from "./styles";
import type { Album, Artist, PlayerState, PluginSdk, Playlist, Song } from "./types";

type CoverKind = "song" | "playlist" | "avatar";
type PlaylistSourceView = "playlists" | "charts" | "discover";
type LibraryView = PlaylistSourceView | "tracks";
type MainView = "home" | PlaylistSourceView | "discoverPlaylists" | "recommend" | "recent" | "search" | "albumDetail" | "artistDetail";
type SearchTab = "songs" | "playlists" | "albums" | "artists";
type LoginTab = "qr" | "phone";
const SONG_ROW_STEP = 63;
const SONG_LIST_OVERSCAN = 6;
const SONG_LIST_END_THRESHOLD = 220;
const SONG_RENDER_CHUNK_SIZE = 50;
type ContextMenuState =
  | { kind: "song"; x: number; y: number; song: Song; queue: Song[]; inQueue: boolean; liked: boolean }
  | { kind: "playlist"; x: number; y: number; playlist: Playlist; canToggleSubscribe: boolean };

// ── Page view memory ─────────────────────────────────────────────
// MusicPage keeps its navigation state in component state, which is
// lost whenever the page unmounts (switching to another app page and
// back). Keep a module-level copy so the page returns to the exact
// view the user left, not the default. Playback/data already survive
// via the `runtime` singleton; this covers the UI navigation side.
type ViewMemory = {
  mainView: MainView;
  libraryView: LibraryView;
  returnLibraryView: PlaylistSourceView;
  searchTab: SearchTab;
  query: string;
  playlistQuery: string;
  activeAlbum: Album | null;
  activeArtist: Artist | null;
};

function createViewMemory(): ViewMemory {
  return {
    mainView: "playlists",
    libraryView: "playlists",
    returnLibraryView: "playlists",
    searchTab: "songs",
    query: "",
    playlistQuery: "",
    activeAlbum: null,
    activeArtist: null,
  };
}

let viewMemory = createViewMemory();

function resetViewMemory(): void {
  viewMemory = createViewMemory();
}

export function setup(sdk: PluginSdk) {
  runtime.init(sdk);
  sdk.lifecycle.onDispose(() => runtime.dispose());

  sdk.ui.registerPage({
    path: "netease-music",
    title: "网易云音乐",
    icon: "musicFilled",
    render: MusicPage,
  });
}

export function teardown() {
  runtime.dispose();
  resetViewMemory();
}

function MusicPage() {
  const [state, setState] = useState<PlayerState>(runtime.getState());
  const [query, setQuery] = useState(viewMemory.query);
  const [playlistQuery, setPlaylistQuery] = useState(viewMemory.playlistQuery);
  const [mainView, setMainView] = useState<MainView>(viewMemory.mainView);
  const [libraryView, setLibraryView] = useState<LibraryView>(viewMemory.libraryView);
  const [returnLibraryView, setReturnLibraryView] = useState<PlaylistSourceView>(viewMemory.returnLibraryView);
  const [searchTab, setSearchTab] = useState<SearchTab>(viewMemory.searchTab);
  const [activeAlbum, setActiveAlbum] = useState<Album | null>(viewMemory.activeAlbum);
  const [activeArtist, setActiveArtist] = useState<Artist | null>(viewMemory.activeArtist);
  const [searchFocused, setSearchFocused] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [themeColor, setThemeColor] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [expandedClosing, setExpandedClosing] = useState(false);
  const [miniOpen, setMiniOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const expandedCloseTimer = useRef<number | null>(null);
  const loggedIn = Boolean(state.loginInfo?.logged_in);
  const detailActive = libraryView === "tracks" && Boolean(state.activePlaylist);
  const searchActive = mainView === "search";
  const playlistSourceView = libraryView === "tracks" ? returnLibraryView : mainView === "discoverPlaylists" ? "discover" : isPlaylistSourceView(mainView) ? mainView : returnLibraryView;
  const libraryPlaylists =
    playlistSourceView === "charts"
      ? state.topPlaylists
      : playlistSourceView === "discover"
        ? state.discoverPlaylists
        : state.userPlaylists;
  const libraryTitle = playlistSourceView === "charts" ? "官方榜单" : playlistSourceView === "discover" ? "发现歌单" : "我的歌单";
  const libraryKicker = playlistSourceView === "charts" ? "Charts" : playlistSourceView === "discover" ? "Discover" : "My Library";
  const topNavView = detailActive
    ? returnLibraryView === "playlists"
      ? "playlists"
      : "discover"
    : mainView === "charts" || mainView === "recommend" || mainView === "discoverPlaylists"
      ? "discover"
      : mainView;
  const coverBackgroundUrl = state.showCoverBackground ? state.currentCoverUrl : "";
  const shellStyle: any = {
    ...(coverBackgroundUrl ? { backgroundImage: `url("${coverBackgroundUrl}")` } : {}),
    ...(themeColor ? { "--nm-accent": themeColor } : {}),
  };

  useEffect(() => runtime.subscribe(setState), []);

  // Persist the navigation state to the module-level store so it survives
  // unmounting when the user switches to another app page and back.
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
    const onKeyDown = (event: any) => {
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

  const openPlaylist = (playlist: Playlist) => {
    if (libraryView !== "tracks") setReturnLibraryView(libraryView);
    setLibraryView("tracks");
    void runtime.loadPlaylist(playlist);
  };

  const showLibraryView = (view: PlaylistSourceView) => {
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

  const openAlbumDetail = (album: Album) => {
    setActiveAlbum(album);
    setActiveArtist(null);
    setSearchTab("songs");
    if (libraryView === "tracks") setLibraryView(returnLibraryView);
    setMainView("albumDetail");
    void runtime.loadAlbumSongs(album);
  };

  const openArtistDetail = (artist: Artist) => {
    setActiveArtist(artist);
    setActiveAlbum(null);
    setSearchTab("songs");
    if (libraryView === "tracks") setLibraryView(returnLibraryView);
    setMainView("artistDetail");
    void runtime.loadArtistSongs(artist);
  };

  const openSongArtistDetail = (artist: Artist) => {
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

  const openSongAlbumDetail = (song: Song) => {
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

  const contextMenuPoint = (event: any) => {
    const rect = shellRef.current?.getBoundingClientRect();
    if (!rect) return { x: event.clientX, y: event.clientY };

    return {
      x: Math.max(8, Math.min(event.clientX - rect.left, rect.width - 8)),
      y: Math.max(8, Math.min(event.clientY - rect.top, rect.height - 8)),
    };
  };

  const openSongContextMenu = (event: any, song: Song, queue: Song[]) => {
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
      liked: state.likedSongIds.includes(song.id),
    });
  };

  const openPlaylistContextMenu = (event: any, playlist: Playlist, canToggleSubscribe: boolean) => {
    event.preventDefault();
    event.stopPropagation();
    const point = contextMenuPoint(event);
    setContextMenu({
      kind: "playlist",
      x: point.x,
      y: point.y,
      playlist,
      canToggleSubscribe,
    });
  };

  return (
    <div
      ref={shellRef}
      className={["netease-shell", coverBackgroundUrl ? "nm-has-cover" : "", expanded ? "nm-expanded-active" : "", state.isPlaying ? "nm-playing" : "", state.loading ? "nm-loading" : ""].filter(Boolean).join(" ")}
      style={shellStyle}
      onContextMenu={(event: any) => {
        if (event.target === event.currentTarget) event.preventDefault();
      }}
    >
      <style>{cssText}</style>
      <div className="nm-page-backdrop" />

      <header className="nm-topbar">
        <AccountPanel state={state} loggedIn={loggedIn} onLogin={openLoginDialog} />
        <TopNav
          view={topNavView}
          onLibrary={showLibraryView}
          onRecent={showRecentView}
        />
        <div className="nm-topbar-right">
          <div className="nm-searchbar nm-top-search">
            <TextField
              density="compact"
              value={query}
              placeholder="搜索歌曲、歌单、专辑、歌手"
              onChange={(event: any) => setQuery(event.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
              onKeyDown={(event: any) => {
                if (event.key === "Enter") runSearch();
              }}
            />
            <Button variant="primary" size="sm" className="nm-search-button" title="搜索" onClick={() => runSearch()}>
              <Icon name="search" size={15} />
            </Button>
            {searchFocused && (searchSuggestions.length || state.searchHistory.length) ? (
              <SearchSuggestPopover
                suggestions={searchSuggestions}
                query={query}
                canClearHistory={state.searchHistory.length > 0}
                onSelect={(value) => {
                  setSearchFocused(false);
                  runSearch(value);
                }}
                onClearHistory={() => runtime.clearSearchHistory()}
              />
            ) : null}
          </div>
        </div>
      </header>

      <main className="nm-main-surface">
        {detailActive && state.activePlaylist ? (
          <PlaylistDetailPage
            state={state}
            onBack={() => {
              setLibraryView(returnLibraryView);
              setMainView(returnLibraryView);
            }}
            onSongContextMenu={openSongContextMenu}
          />
        ) : searchActive ? (
          <SearchPage
            state={state}
            tab={searchTab}
            onTabChange={setSearchTab}
            onOpenPlaylist={openPlaylist}
            onOpenAlbum={(album) => {
              openAlbumDetail(album);
            }}
            onOpenArtist={(artist) => {
              openArtistDetail(artist);
            }}
            onSongContextMenu={openSongContextMenu}
            onPlaylistContextMenu={openPlaylistContextMenu}
          />
        ) : mainView === "albumDetail" && activeAlbum ? (
          <AlbumDetailPage
            album={activeAlbum}
            state={state}
            onBack={backToSearch}
            onOpenArtist={openArtistDetail}
            onSongContextMenu={openSongContextMenu}
          />
        ) : mainView === "artistDetail" && activeArtist ? (
          <ArtistDetailPage
            artist={activeArtist}
            state={state}
            onBack={backToSearch}
            onOpenAlbum={openAlbumDetail}
            onSongContextMenu={openSongContextMenu}
          />
        ) : mainView === "home" ? (
          <HomePage
            state={state}
            loggedIn={loggedIn}
            onLogin={openLoginDialog}
            onOpenPlaylist={openPlaylist}
            onShowLibrary={showLibraryView}
            onShowRecommend={showRecommendView}
            onShowRecent={showRecentView}
            onSongContextMenu={openSongContextMenu}
            onPlaylistContextMenu={openPlaylistContextMenu}
          />
        ) : mainView === "discover" ? (
          <DiscoverPage
            state={state}
            onShowDiscoverPlaylists={showDiscoverPlaylistView}
            onShowCharts={() => showLibraryView("charts")}
            onShowRecommend={showRecommendView}
            onOpenPlaylist={openPlaylist}
            onSongContextMenu={openSongContextMenu}
            onPlaylistContextMenu={openPlaylistContextMenu}
          />
        ) : mainView === "discoverPlaylists" || isPlaylistSourceView(mainView) ? (
          <PlaylistSourcePage
            state={state}
            sourceView={playlistSourceView}
            title={libraryTitle}
            kicker={libraryKicker}
            playlists={libraryPlaylists}
            playlistQuery={playlistQuery}
            onPlaylistQueryChange={setPlaylistQuery}
            onSearchPlaylists={runPlaylistSearch}
            onRefresh={mainView === "discoverPlaylists" ? () => runtime.shuffleDiscoverPlaylists(playlistQuery) : refreshLibrary}
            onBack={mainView === "charts" || mainView === "discoverPlaylists" ? () => showLibraryView("discover") : undefined}
            onOpenPlaylist={openPlaylist}
            onPlaylistContextMenu={openPlaylistContextMenu}
          />
        ) : mainView === "recommend" ? (
          <SongCollectionPage
            title="每日推荐"
            kicker="Daily Mix"
            count={state.recommendSongs.length}
            loading={state.loading === "recommend"}
            songs={state.recommendSongs}
            currentSong={state.currentSong}
            likedSongIds={state.likedSongIds}
            emptyTitle="暂无每日推荐"
            emptyBody="登录后刷新每日推荐。"
            onBack={() => showLibraryView("discover")}
            action={
              <Button variant="ghost" size="sm" className="nm-icon-button" title="刷新每日推荐" onClick={() => runtime.loadRecommendSongs(true)}>
                <Icon name="reset" size={14} />
              </Button>
            }
            onSongContextMenu={openSongContextMenu}
          />
        ) : (
          <SongCollectionPage
            title="最近播放"
            kicker="History"
            count={state.recentSongs.length}
            songs={state.recentSongs}
            currentSong={state.currentSong}
            likedSongIds={state.likedSongIds}
            emptyTitle="暂无最近播放"
            emptyBody="播放歌曲后会在这里显示。"
            onSongContextMenu={openSongContextMenu}
          />
        )}
      </main>

      <PlayerBar state={state} onExpand={openExpanded} onMini={() => setMiniOpen(true)} onSongContextMenu={openSongContextMenu} />
      <LoginDialog open={loginOpen} onClose={closeLoginDialog} onLoggedIn={handleLoggedIn} />
      {contextMenu ? (
        <ContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onOpenPlaylist={openPlaylist}
          onOpenArtist={openSongArtistDetail}
          onOpenAlbum={openSongAlbumDetail}
        />
      ) : null}
      {expanded ? <ExpandedPlayer state={state} closing={expandedClosing} onClose={closeExpanded} /> : null}
      {miniOpen ? <MiniPlayer state={state} onClose={() => setMiniOpen(false)} /> : null}
    </div>
  );
}

function isPlaylistSourceView(view: MainView): view is PlaylistSourceView {
  return view === "playlists" || view === "charts" || view === "discover";
}

function TopNav({
  view,
  onLibrary,
  onRecent,
}: {
  view: MainView | "tracks";
  onLibrary: (view: PlaylistSourceView) => void;
  onRecent: () => void;
}) {
  const items: Array<{ value: MainView; label: string; icon: string; onClick: () => void }> = [
    { value: "playlists", label: "我的", icon: "playlist", onClick: () => onLibrary("playlists") },
    { value: "discover", label: "发现", icon: "search", onClick: () => onLibrary("discover") },
    { value: "recent", label: "最近", icon: "clock", onClick: onRecent },
  ];

  return (
    <nav className="nm-top-nav" aria-label="网易云音乐导航">
      {items.map((item) => (
        <Button
          key={item.value}
          variant={view === item.value ? "primary" : "ghost"}
          size="sm"
          className="nm-top-nav-button"
          onClick={item.onClick}
        >
          <Icon name={item.icon} size={14} />
          {item.label}
        </Button>
      ))}
    </nav>
  );
}

function SearchSuggestPopover({
  suggestions,
  query,
  canClearHistory,
  onSelect,
  onClearHistory,
}: {
  suggestions: Array<{ value: string; label: string; type: string; icon: string }>;
  query: string;
  canClearHistory: boolean;
  onSelect: (value: string) => void;
  onClearHistory: () => void;
}) {
  const title = query.trim() ? "搜索建议" : "搜索历史";

  return (
    <div className="nm-search-suggest" onMouseDown={(event: any) => event.preventDefault()}>
      <span className="nm-search-suggest-head">
        <span className="nm-search-suggest-title">{title}</span>
        {canClearHistory ? (
          <button className="nm-search-clear-history" onClick={onClearHistory}>
            清除历史
          </button>
        ) : null}
      </span>
      {suggestions.map((item) => (
        <button key={item.type + "-" + item.value} className="nm-search-suggest-item" onClick={() => onSelect(item.value)}>
          <Icon name={item.icon} size={14} />
          <span>{item.label}</span>
          <small>{item.type}</small>
        </button>
      ))}
      {!suggestions.length ? <span className="nm-search-suggest-empty">暂无搜索建议</span> : null}
    </div>
  );
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
  onPlaylistContextMenu,
}: {
  state: PlayerState;
  loggedIn: boolean;
  onLogin: () => void;
  onOpenPlaylist: (playlist: Playlist) => void;
  onShowLibrary: (view: PlaylistSourceView) => void;
  onShowRecommend: () => void;
  onShowRecent: () => void;
  onSongContextMenu: (event: any, song: Song, queue: Song[]) => void;
  onPlaylistContextMenu: (event: any, playlist: Playlist, canToggleSubscribe: boolean) => void;
}) {
  const currentSong = state.currentSong;

  return (
    <div className="nm-home-stack">
      <section className="nm-home-hero">
        <div className="nm-home-hero-copy">
          <span className="nm-kicker">Now Playing</span>
          <strong>{currentSong?.name ?? "网易云音乐"}</strong>
          <span>{currentSong?.artist ?? "从歌单、榜单或搜索结果开始播放。"}</span>
        </div>
        <div className="nm-home-hero-actions">
          <Button variant="primary" size="sm" onClick={onShowRecommend}>
            <Icon name="heart" size={14} />
            每日推荐
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onShowLibrary("discover")}>
            <Icon name="search" size={14} />
            发现歌单
          </Button>
          {!loggedIn ? (
            <Button variant="ghost" size="sm" onClick={onLogin}>
              <Icon name="signIn" size={14} />
              登录
            </Button>
          ) : null}
        </div>
      </section>

      <SongShelf
        title="每日推荐"
        kicker="Daily Mix"
        songs={state.recommendSongs}
        currentSong={state.currentSong}
        emptyTitle={loggedIn ? "暂无每日推荐" : "登录后查看每日推荐"}
        onOpenMore={onShowRecommend}
        onSongContextMenu={onSongContextMenu}
      />
      <PlaylistShelf
        title="我的歌单"
        kicker="My Library"
        playlists={state.userPlaylists}
        loginNickname={state.loginInfo?.nickname || ""}
        activeId={state.activePlaylist?.id}
        emptyTitle={loggedIn ? "暂无歌单" : "登录后同步我的歌单"}
        onOpenMore={() => onShowLibrary("playlists")}
        onOpen={onOpenPlaylist}
        onPlaylistContextMenu={onPlaylistContextMenu}
      />
      <PlaylistShelf
        title="发现歌单"
        kicker="Discover"
        playlists={state.discoverPlaylists}
        loginNickname={state.loginInfo?.nickname || ""}
        activeId={state.activePlaylist?.id}
        emptyTitle="暂无发现歌单"
        onOpenMore={() => onShowLibrary("discover")}
        onOpen={onOpenPlaylist}
        onPlaylistContextMenu={onPlaylistContextMenu}
      />
      <PlaylistShelf
        title="官方榜单"
        kicker="Charts"
        playlists={state.topPlaylists}
        loginNickname={state.loginInfo?.nickname || ""}
        activeId={state.activePlaylist?.id}
        emptyTitle="暂无榜单"
        onOpenMore={() => onShowLibrary("charts")}
        onOpen={onOpenPlaylist}
        onPlaylistContextMenu={onPlaylistContextMenu}
      />
      <SongShelf
        title="最近播放"
        kicker="History"
        songs={state.recentSongs}
        currentSong={state.currentSong}
        emptyTitle="暂无最近播放"
        onOpenMore={onShowRecent}
        onSongContextMenu={onSongContextMenu}
      />
    </div>
  );
}

function DiscoverPage({
  state,
  onShowDiscoverPlaylists,
  onShowCharts,
  onShowRecommend,
  onOpenPlaylist,
  onSongContextMenu,
  onPlaylistContextMenu,
}: {
  state: PlayerState;
  onShowDiscoverPlaylists: () => void;
  onShowCharts: () => void;
  onShowRecommend: () => void;
  onOpenPlaylist: (playlist: Playlist) => void;
  onSongContextMenu: (event: any, song: Song, queue: Song[]) => void;
  onPlaylistContextMenu: (event: any, playlist: Playlist, canToggleSubscribe: boolean) => void;
}) {
  const loggedIn = Boolean(state.loginInfo?.logged_in);

  return (
    <div className="nm-home-stack nm-discover-stack">
      <div className="nm-discover-title">
        <span className="nm-kicker">Discover</span>
        <strong>发现</strong>
      </div>

      <SongShelf
        title="每日推荐"
        kicker="Daily Mix"
        songs={state.recommendSongs}
        currentSong={state.currentSong}
        emptyTitle={loggedIn ? "暂无每日推荐" : "登录后查看每日推荐"}
        onOpenMore={onShowRecommend}
        onSongContextMenu={onSongContextMenu}
      />
      <PlaylistShelf
        title="发现歌单"
        kicker="Playlists"
        playlists={state.discoverPlaylists}
        loginNickname={state.loginInfo?.nickname || ""}
        activeId={state.activePlaylist?.id}
        emptyTitle="暂无发现歌单"
        onOpenMore={onShowDiscoverPlaylists}
        onOpen={onOpenPlaylist}
        onPlaylistContextMenu={onPlaylistContextMenu}
      />
      <PlaylistShelf
        title="官方榜单"
        kicker="Charts"
        playlists={state.topPlaylists}
        loginNickname={state.loginInfo?.nickname || ""}
        activeId={state.activePlaylist?.id}
        emptyTitle="暂无榜单"
        onOpenMore={onShowCharts}
        onOpen={onOpenPlaylist}
        onPlaylistContextMenu={onPlaylistContextMenu}
      />
    </div>
  );
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
  onPlaylistContextMenu,
}: {
  state: PlayerState;
  sourceView: PlaylistSourceView;
  title: string;
  kicker: string;
  playlists: Playlist[];
  playlistQuery: string;
  onPlaylistQueryChange: (value: string) => void;
  onSearchPlaylists: () => void;
  onRefresh: () => void;
  onBack?: () => void;
  onOpenPlaylist: (playlist: Playlist) => void;
  onPlaylistContextMenu: (event: any, playlist: Playlist, canToggleSubscribe: boolean) => void;
}) {
  const requiresLogin = sourceView === "playlists" && !state.loginInfo?.logged_in;

  return (
    <section className={"nm-card nm-page-card nm-list-page " + (sourceView === "charts" ? "nm-charts-page" : sourceView === "discover" ? "nm-discover-list-page" : "")}>
      <div className={"nm-card-head " + (sourceView === "charts" ? "nm-charts-head" : "")}>
        <span className="nm-head-left">
          {onBack ? (
            <Button variant="ghost" size="sm" className="nm-icon-button" title="返回发现" onClick={onBack}>
              <Icon name="arrowLeft" size={15} />
            </Button>
          ) : null}
          <span className="nm-head-copy">
            <span className="nm-kicker">{kicker}</span>
            <strong>{title}</strong>
          </span>
        </span>
        <span className="nm-head-actions">
          {sourceView === "discover" ? (
            <span className="nm-playlist-search nm-discover-list-search">
              <TextField
                density="compact"
                value={playlistQuery}
                placeholder="搜索歌单"
                onChange={(event: any) => onPlaylistQueryChange(event.target.value)}
                onKeyDown={(event: any) => {
                  if (event.key === "Enter") onSearchPlaylists();
                }}
              />
              <Button variant="primary" size="sm" className="nm-search-button" title="搜索歌单" onClick={onSearchPlaylists}>
                <Icon name="search" size={15} />
              </Button>
              <Button variant="ghost" size="sm" className="nm-icon-button" title="换一批歌单" onClick={onRefresh}>
                <Icon name="reset" size={15} />
              </Button>
            </span>
          ) : (
            <Button variant="ghost" size="sm" className="nm-icon-button" title="刷新" onClick={onRefresh}>
              <Icon name="reset" size={15} />
            </Button>
          )}
        </span>
      </div>
      {requiresLogin ? (
        <LoginPanel />
      ) : (
        <div className="nm-library-body">
          <PlaylistList
            playlists={playlists}
            activeId={state.activePlaylist?.id}
            loginNickname={state.loginInfo?.nickname || ""}
            loading={state.loading === "playlists" || state.loading === "toplists" || state.loading === "discover-playlists" || state.loading === "playlist-search"}
            onOpen={onOpenPlaylist}
            onPlaylistContextMenu={onPlaylistContextMenu}
          />
        </div>
      )}
    </section>
  );
}

function PlaylistDetailPage({
  state,
  onBack,
  onSongContextMenu,
}: {
  state: PlayerState;
  onBack: () => void;
  onSongContextMenu: (event: any, song: Song, queue: Song[]) => void;
}) {
  const playlist = state.activePlaylist;

  return (
    <section className="nm-card nm-page-card nm-detail-page">
      <div className="nm-detail-head">
        <Button variant="ghost" size="sm" className="nm-icon-button" title="返回" onClick={onBack}>
          <Icon name="arrowLeft" size={16} />
        </Button>
        {playlist?.cover ? <CoverImage src={playlist.cover} kind="playlist" className="nm-detail-cover" /> : null}
        <span className="nm-detail-copy">
          <span className="nm-kicker">Playlist Tracks</span>
          <strong>{playlist?.name ?? "歌单"}</strong>
          <small>
            {state.loading === "playlist" ? "加载中..." : state.activeTracks.length + " / " + (playlist?.track_count ?? state.activeTracks.length) + " 首"}
            {playlist?.creator ? " · " + playlist.creator : ""}
          </small>
        </span>
      </div>
      <SongList
        songs={state.activeTracks}
        currentSong={state.currentSong}
        likedSongIds={state.likedSongIds}
        loading={state.loading === "playlist"}
        loadingMore={state.loading === "tracks"}
        hasMore={state.hasMoreTracks}
        resetKey={playlist?.id}
        onEndReached={() => runtime.loadMoreTracks()}
        onSongContextMenu={onSongContextMenu}
      />
    </section>
  );
}

function AlbumDetailPage({
  album,
  state,
  onBack,
  onOpenArtist,
  onSongContextMenu,
}: {
  album: Album;
  state: PlayerState;
  onBack: () => void;
  onOpenArtist: (artist: Artist) => void;
  onSongContextMenu: (event: any, song: Song, queue: Song[]) => void;
}) {
  const songs = state.mediaDetailSongs;
  const loading = state.loading === "album";
  const [tab, setTab] = useState<"songs" | "artists">("songs");
  const subtitle = [
    album.artist,
    album.song_count ? album.song_count + " 首" : "",
    formatPublishDate(album.publish_time),
  ].filter(Boolean).join(" · ");

  useEffect(() => {
    setTab("songs");
  }, [album.id]);

  return (
    <section className="nm-card nm-page-card nm-detail-page nm-media-detail-page">
      <MediaDetailHeader
        cover={album.cover}
        coverKind="song"
        kicker="Album"
        title={album.name}
        subtitle={subtitle || "专辑歌曲"}
        onBack={onBack}
        songs={songs}
        loading={loading}
        tabs={[
          { value: "songs", label: "专辑歌曲", count: songs.length },
          { value: "artists", label: "相关歌手", count: state.mediaDetailArtists.length },
        ]}
        activeTab={tab}
        onTabChange={(value) => setTab(value as "songs" | "artists")}
      />
      <div className="nm-media-detail-body">
        {tab === "artists" ? (
          <ArtistList artists={state.mediaDetailArtists} onOpen={onOpenArtist} />
        ) : (
          <SongList
            songs={songs}
            currentSong={state.currentSong}
            likedSongIds={state.likedSongIds}
            loading={loading}
            resetKey={"album-" + album.id}
            emptyTitle="暂无专辑歌曲"
            emptyBody="该专辑暂时没有可展示的歌曲。"
            onSongContextMenu={onSongContextMenu}
          />
        )}
      </div>
    </section>
  );
}

function ArtistDetailPage({
  artist,
  state,
  onBack,
  onOpenAlbum,
  onSongContextMenu,
}: {
  artist: Artist;
  state: PlayerState;
  onBack: () => void;
  onOpenAlbum: (album: Album) => void;
  onSongContextMenu: (event: any, song: Song, queue: Song[]) => void;
}) {
  const songs = state.mediaDetailSongs;
  const loading = state.loading === "artist";
  const [tab, setTab] = useState<"songs" | "albums">("songs");

  useEffect(() => {
    setTab("songs");
  }, [artist.id]);

  return (
    <section className="nm-card nm-page-card nm-detail-page nm-media-detail-page">
      <MediaDetailHeader
        cover={artist.cover}
        coverKind="avatar"
        kicker="Artist"
        title={artist.name}
        subtitle={loading ? "正在加载热门歌曲..." : songs.length ? "热门歌曲 · " + songs.length + " 首" : "热门歌曲"}
        onBack={onBack}
        songs={songs}
        loading={loading}
        tabs={[
          { value: "songs", label: "热门歌曲", count: songs.length },
          { value: "albums", label: "相关专辑", count: state.mediaDetailAlbums.length },
        ]}
        activeTab={tab}
        onTabChange={(value) => setTab(value as "songs" | "albums")}
      />
      <div className="nm-media-detail-body">
        {tab === "albums" ? (
          <AlbumList albums={state.mediaDetailAlbums} onOpen={onOpenAlbum} />
        ) : (
          <SongList
            songs={songs}
            currentSong={state.currentSong}
            likedSongIds={state.likedSongIds}
            loading={loading}
            resetKey={"artist-" + artist.id}
            emptyTitle="暂无歌手歌曲"
            emptyBody="该歌手暂时没有可展示的热门歌曲。"
            onSongContextMenu={onSongContextMenu}
          />
        )}
      </div>
    </section>
  );
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
  onBack,
}: {
  cover: string;
  coverKind: CoverKind;
  kicker: string;
  title: string;
  subtitle: string;
  songs: Song[];
  loading: boolean;
  tabs: Array<{ value: string; label: string; count: number }>;
  activeTab: string;
  onTabChange: (value: string) => void;
  onBack: () => void;
}) {
  const canUseSongs = songs.length > 0 && !loading;

  return (
    <div className="nm-media-detail-head">
      <Button variant="ghost" size="sm" className="nm-icon-button nm-media-back" title="返回搜索" onClick={onBack}>
        <Icon name="arrowLeft" size={16} />
      </Button>
      <CoverImage src={cover} kind={coverKind} className="nm-media-detail-cover" />
      <span className="nm-media-detail-copy">
        <span className="nm-kicker">{kicker}</span>
        <strong>{title}</strong>
        <span className="nm-media-meta-row">
          <small>{subtitle}</small>
          <span className="nm-media-tabs">
            {tabs.map((item) => (
              <button
                key={item.value}
                className={"nm-media-tab " + (activeTab === item.value ? "nm-media-tab-active" : "")}
                onClick={() => onTabChange(item.value)}
              >
                {item.label}
                <small>{item.count}</small>
              </button>
            ))}
          </span>
        </span>
      </span>
      <span className="nm-media-detail-actions">
        <Button
          variant="primary"
          size="sm"
          disabled={!canUseSongs}
          onClick={() => {
            if (songs[0]) void runtime.playSong(songs[0], songs);
          }}
        >
          <Icon name="playFilled" size={14} />
          播放全部
        </Button>
      </span>
    </div>
  );
}

function SearchPage({
  state,
  tab,
  onTabChange,
  onOpenPlaylist,
  onOpenAlbum,
  onOpenArtist,
  onSongContextMenu,
  onPlaylistContextMenu,
}: {
  state: PlayerState;
  tab: SearchTab;
  onTabChange: (tab: SearchTab) => void;
  onOpenPlaylist: (playlist: Playlist) => void;
  onOpenAlbum: (album: Album) => void;
  onOpenArtist: (artist: Artist) => void;
  onSongContextMenu: (event: any, song: Song, queue: Song[]) => void;
  onPlaylistContextMenu: (event: any, playlist: Playlist, canToggleSubscribe: boolean) => void;
}) {
  return (
    <section className="nm-card nm-page-card nm-list-page">
      <div className="nm-card-head">
        <span className="nm-head-copy">
          <span className="nm-kicker">Search Results</span>
          <strong>搜索结果</strong>
        </span>
        <span className="nm-count">{state.loading ? "..." : state.searchResults.length}</span>
      </div>
      <SearchResults
        state={state}
        tab={tab}
        onTabChange={onTabChange}
        onOpenPlaylist={onOpenPlaylist}
        onOpenAlbum={onOpenAlbum}
        onOpenArtist={onOpenArtist}
        onSongContextMenu={onSongContextMenu}
        onPlaylistContextMenu={onPlaylistContextMenu}
      />
    </section>
  );
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
  onSongContextMenu,
}: {
  title: string;
  kicker: string;
  count: number;
  songs: Song[];
  currentSong: Song | null;
  likedSongIds: string[];
  loading?: boolean;
  emptyTitle: string;
  emptyBody: string;
  onBack?: () => void;
  action?: any;
  onSongContextMenu: (event: any, song: Song, queue: Song[]) => void;
}) {
  return (
    <section className="nm-card nm-page-card nm-list-page">
      <div className="nm-card-head">
        <span className="nm-head-left">
          {onBack ? (
            <Button variant="ghost" size="sm" className="nm-icon-button" title="返回发现" onClick={onBack}>
              <Icon name="arrowLeft" size={15} />
            </Button>
          ) : null}
          <span className="nm-head-copy">
            <span className="nm-kicker">{kicker}</span>
            <span className="nm-head-title-row">
              <strong>{title}</strong>
              <span className="nm-count nm-title-count">{loading ? "..." : count}</span>
            </span>
          </span>
        </span>
        <span className="nm-head-actions">
          {action}
        </span>
      </div>
      <SongList songs={songs} currentSong={currentSong} likedSongIds={likedSongIds} loading={loading} emptyTitle={emptyTitle} emptyBody={emptyBody} onSongContextMenu={onSongContextMenu} />
    </section>
  );
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
  onPlaylistContextMenu,
}: {
  title: string;
  kicker: string;
  playlists: Playlist[];
  activeId?: string;
  loginNickname: string;
  emptyTitle: string;
  onOpenMore?: () => void;
  onOpen: (playlist: Playlist) => void;
  onPlaylistContextMenu: (event: any, playlist: Playlist, canToggleSubscribe: boolean) => void;
}) {
  const visible = playlists.slice(0, 10);

  return (
    <section className="nm-home-section">
      <div className="nm-home-section-head">
        <span>
          <span className="nm-kicker">{kicker}</span>
          <strong>{title}</strong>
        </span>
        {onOpenMore ? (
          <Button variant="ghost" size="sm" onClick={onOpenMore}>
            查看全部
          </Button>
        ) : null}
      </div>
      {visible.length ? (
        <div className="nm-cover-strip">
          {visible.map((playlist) => {
            const canToggleSubscribe = playlist.subscribed || (Boolean(loginNickname) && playlist.creator !== loginNickname);
            return (
              <div
                key={playlist.id}
                role="button"
                tabIndex={0}
                className={"nm-cover-card " + (activeId === playlist.id ? "nm-cover-card-active" : "")}
                onClick={() => onOpen(playlist)}
                onContextMenu={(event: any) => onPlaylistContextMenu(event, playlist, canToggleSubscribe)}
                onKeyDown={(event: any) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen(playlist);
                  }
                }}
              >
                <CoverImage src={playlist.cover} kind="playlist" className="nm-cover-card-image" />
                <strong>{playlist.name}</strong>
                <small>{playlist.track_count} 首</small>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="nm-home-empty">{emptyTitle}</div>
      )}
    </section>
  );
}

function SongShelf({
  title,
  kicker,
  songs,
  currentSong,
  emptyTitle,
  onOpenMore,
  onSongContextMenu,
}: {
  title: string;
  kicker: string;
  songs: Song[];
  currentSong: Song | null;
  emptyTitle: string;
  onOpenMore: () => void;
  onSongContextMenu: (event: any, song: Song, queue: Song[]) => void;
}) {
  const visible = songs.slice(0, 10);

  return (
    <section className="nm-home-section">
      <div className="nm-home-section-head">
        <span>
          <span className="nm-kicker">{kicker}</span>
          <strong>{title}</strong>
        </span>
        <Button variant="ghost" size="sm" onClick={onOpenMore}>
          查看全部
        </Button>
      </div>
      {visible.length ? (
        <div className="nm-song-strip">
          {visible.map((song, index) => (
            <div
              key={song.id + "-" + index}
              role="button"
              tabIndex={0}
              className={"nm-song-tile " + (currentSong?.id === song.id ? "nm-song-tile-active" : "")}
              onClick={() => void runtime.playSong(song, songs)}
              onContextMenu={(event: any) => onSongContextMenu(event, song, songs)}
              onKeyDown={(event: any) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  void runtime.playSong(song, songs);
                }
              }}
            >
              <CoverImage src={song.cover} kind="song" className="nm-song-tile-cover" />
              <span className="nm-song-tile-copy">
                <strong>{song.name}</strong>
                <small>{song.artist}</small>
              </span>
              <span className="nm-song-tile-duration">{formatDuration(song.duration)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="nm-home-empty">{emptyTitle}</div>
      )}
    </section>
  );
}

function LibraryTabs({ view, onChange }: { view: PlaylistSourceView; onChange: (view: PlaylistSourceView) => void }) {
  const items: Array<{ value: PlaylistSourceView; label: string; icon: string }> = [
    { value: "playlists", label: "我的", icon: "playlist" },
    { value: "charts", label: "榜单", icon: "ranking" },
    { value: "discover", label: "发现", icon: "search" },
  ];

  return (
    <span className="nm-panel-tabs nm-library-tabs">
      {items.map((item) => (
        <Button
          key={item.value}
          variant={view === item.value ? "primary" : "ghost"}
          size="sm"
          className="nm-panel-tab"
          onClick={() => onChange(item.value)}
        >
          <Icon name={item.icon} size={14} />
          {item.label}
        </Button>
      ))}
    </span>
  );
}

function DiscoveryTabs({ view }: { view: "recommend" | "recent" }) {
  return (
    <span className="nm-panel-tabs">
      <Button variant={view === "recommend" ? "primary" : "ghost"} size="sm" className="nm-panel-tab" onClick={() => runtime.showRecommendations()}>
        <Icon name="heart" size={14} />
        每日推荐
      </Button>
      <Button variant={view === "recent" ? "primary" : "ghost"} size="sm" className="nm-panel-tab" onClick={() => runtime.showRecentSongs()}>
        <Icon name="clock" size={14} />
        最近
      </Button>
    </span>
  );
}

function SearchResults({
  state,
  tab,
  onTabChange,
  onOpenPlaylist,
  onOpenAlbum,
  onOpenArtist,
  onSongContextMenu,
  onPlaylistContextMenu,
}: {
  state: PlayerState;
  tab: SearchTab;
  onTabChange: (tab: SearchTab) => void;
  onOpenPlaylist: (playlist: Playlist) => void;
  onOpenAlbum: (album: Album) => void;
  onOpenArtist: (artist: Artist) => void;
  onSongContextMenu: (event: any, song: Song, queue: Song[]) => void;
  onPlaylistContextMenu: (event: any, playlist: Playlist, canToggleSubscribe: boolean) => void;
}) {
  const tabs: Array<{ value: SearchTab; label: string; count: number }> = [
    { value: "songs", label: "单曲", count: state.searchResults.length },
    { value: "playlists", label: "歌单", count: state.searchPlaylists.length },
    { value: "albums", label: "专辑", count: state.searchAlbums.length },
    { value: "artists", label: "歌手", count: state.searchArtists.length },
  ];

  return (
    <div className="nm-search-results">
      <span className="nm-panel-tabs nm-search-tabs">
        {tabs.map((item) => (
          <Button
            key={item.value}
            variant={tab === item.value ? "primary" : "ghost"}
            size="sm"
            className="nm-panel-tab"
            onClick={() => onTabChange(item.value)}
          >
            {item.label}
            <small>{item.count}</small>
          </Button>
        ))}
      </span>
      {tab === "songs" ? (
        <SongList songs={state.searchResults} currentSong={state.currentSong} likedSongIds={state.likedSongIds} loading={state.loading === "search" || state.loading === "album" || state.loading === "artist"} emptyTitle="暂无搜索结果" emptyBody="输入关键词后按回车或点击搜索。" onSongContextMenu={onSongContextMenu} />
      ) : tab === "playlists" ? (
        <PlaylistList playlists={state.searchPlaylists} activeId={state.activePlaylist?.id} loginNickname={state.loginInfo?.nickname || ""} loading={state.loading === "search"} onOpen={onOpenPlaylist} onPlaylistContextMenu={onPlaylistContextMenu} />
      ) : tab === "albums" ? (
        <AlbumList albums={state.searchAlbums} onOpen={onOpenAlbum} />
      ) : (
        <ArtistList artists={state.searchArtists} onOpen={onOpenArtist} />
      )}
    </div>
  );
}

function AlbumList({ albums, onOpen }: { albums: Album[]; onOpen: (album: Album) => void }) {
  if (!albums.length) return <EmptyState icon="music" title="暂无专辑" body="换个关键词再试。" />;

  return (
    <div className="nm-scroll-list">
      {albums.map((album) => (
        <div
          key={album.id}
          role="button"
          tabIndex={0}
          className="nm-playlist-row"
          onClick={() => onOpen(album)}
          onKeyDown={(event: any) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpen(album);
            }
          }}
        >
          <CoverImage src={album.cover} kind="song" className="nm-row-cover" />
          <span className="nm-row-copy">
            <span className="nm-title">{album.name}</span>
          <span className="nm-sub">{album.artist}{album.song_count ? " · " + album.song_count + " 首" : ""}</span>
          </span>
          <Icon name="music" size={16} />
        </div>
      ))}
    </div>
  );
}

function ArtistList({ artists, onOpen }: { artists: Artist[]; onOpen: (artist: Artist) => void }) {
  if (!artists.length) return <EmptyState icon="user" title="暂无歌手" body="换个关键词再试。" />;

  return (
    <div className="nm-scroll-list">
      {artists.map((artist) => (
        <div
          key={artist.id}
          role="button"
          tabIndex={0}
          className="nm-playlist-row"
          onClick={() => onOpen(artist)}
          onKeyDown={(event: any) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpen(artist);
            }
          }}
        >
          <CoverImage src={artist.cover} kind="avatar" className="nm-row-cover" />
          <span className="nm-row-copy">
            <span className="nm-title">{artist.name}</span>
            <span className="nm-sub">热门歌曲</span>
          </span>
          <Icon name="user" size={16} />
        </div>
      ))}
    </div>
  );
}

function ContextMenu({
  menu,
  onClose,
  onOpenPlaylist,
  onOpenArtist,
  onOpenAlbum,
}: {
  menu: ContextMenuState;
  onClose: () => void;
  onOpenPlaylist: (playlist: Playlist) => void;
  onOpenArtist: (artist: Artist) => void;
  onOpenAlbum: (song: Song) => void;
}) {
  const songArtists = menu.kind === "song" ? songContextArtists(menu.song) : [];
  const songAlbum = menu.kind === "song" ? menu.song.album.trim() : "";
  const item = (label: string, onClick: () => void, icon?: string) => (
    <button
      className="nm-context-item"
      onClick={(event: any) => {
        event.stopPropagation();
        onClick();
        onClose();
      }}
    >
      {icon ? <Icon name={icon} size={14} /> : null}
      {label}
    </button>
  );
  const artistMenu = () => {
    if (!songArtists.length) return null;
    if (songArtists.length === 1) return item("查看歌手", () => onOpenArtist(songArtists[0]), "user");

    return (
      <span className="nm-context-submenu">
        <button className="nm-context-item nm-context-submenu-trigger" onClick={(event: any) => event.stopPropagation()}>
          <Icon name="user" size={14} />
          查看歌手
          <Icon name="caretRight" size={13} />
        </button>
        <span className="nm-context-submenu-panel">
          {songArtists.map((artist, index) => (
            <button
              key={(artist.id || artist.name) + "-" + index}
              className="nm-context-item"
              onClick={(event: any) => {
                event.stopPropagation();
                onOpenArtist(artist);
                onClose();
              }}
            >
              <Icon name="user" size={14} />
              {artist.name}
            </button>
          ))}
        </span>
      </span>
    );
  };

  return (
    <div className="nm-context-menu" style={{ left: menu.x, top: menu.y }} onClick={(event: any) => event.stopPropagation()}>
      {menu.kind === "song" ? (
        <>
          {item("播放", () => void runtime.playSong(menu.song, menu.queue), "play")}
          {item("下一首播放", () => void runtime.playNext(menu.song), "skipForward")}
          {artistMenu()}
          {songAlbum ? item("查看专辑", () => onOpenAlbum(menu.song), "music") : null}
          {item(menu.liked ? "取消喜欢" : "喜欢", () => void runtime.toggleLike(menu.song.id), menu.liked ? "heartFilled" : "heart")}
          {menu.inQueue ? item("从队列移除", () => runtime.removeFromQueue(menu.song.id), "close") : null}
          {menu.inQueue ? item("清空队列", () => runtime.clearQueue(), "playlist") : null}
        </>
      ) : (
        <>
          {item("打开歌单", () => onOpenPlaylist(menu.playlist), "playlist")}
          {menu.canToggleSubscribe ? item(menu.playlist.subscribed ? "取消收藏" : "收藏歌单", () => void runtime.togglePlaylistSubscribe(menu.playlist), menu.playlist.subscribed ? "bookmarkFilled" : "bookmark") : null}
        </>
      )}
    </div>
  );
}

function AccountPanel({ state, loggedIn, onLogin }: { state: PlayerState; loggedIn: boolean; onLogin: () => void }) {
  const login = state.loginInfo;
  const badge = login?.is_svip ? "SVIP" : login?.is_vip ? "VIP" : "已登录";

  if (!loggedIn) {
    return (
      <Button variant="primary" size="sm" onClick={onLogin}>
        <Icon name="signIn" size={14} />
        登录
      </Button>
    );
  }

  return (
    <div className="nm-account-panel">
      <CoverImage src={login?.avatar || ""} kind="avatar" className="nm-avatar" />
      <span className="nm-account-copy">
        <strong>{login?.nickname || "网易云账号"}</strong>
        <small>{badge}</small>
      </span>
      <Button variant="ghost" size="sm" className="nm-account-logout" title="登出" onClick={() => runtime.logout()}>
        <Icon name="signOut" size={14} />
      </Button>
    </div>
  );
}

function LoginPanel() {
  return (
    <div className="nm-empty nm-login-panel">
      <span className="nm-empty-icon">
        <Icon name="music" size={22} />
      </span>
      <strong>网易云音乐</strong>
      <span>登录后会在这里显示你的歌单。</span>
    </div>
  );
}

function LoginDialog({ open, onClose, onLoggedIn }: { open: boolean; onClose: () => void; onLoggedIn: () => void }) {
  const [tab, setTab] = useState<LoginTab>("qr");
  const [qrKey, setQrKey] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [qrStatus, setQrStatus] = useState("");
  const [qrMessage, setQrMessage] = useState("正在生成二维码...");
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
      setQrMessage("正在生成二维码...");
      setQrLoading(false);
      setPhoneLoading(false);
      setPhoneMessage("");
    }
  }, [open]);

  useEffect(() => {
    if (!open || tab !== "qr") return;
    let cancelled = false;
    let pollTimer: number | null = null;

    const loadQr = async () => {
      setQrLoading(true);
      setQrKey("");
      setQrImage("");
      setQrStatus("");
      setQrMessage("正在生成二维码...");
      try {
        const qr = await runtime.createQrLogin();
        if (cancelled) return;
        setQrKey(qr.unikey);
        setQrImage(qr.qr_image);
        setQrStatus("801");
        setQrMessage("请使用网易云音乐 App 扫码登录");
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
        }, 2000);
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
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open, captchaCooldown]);

  const sendCaptcha = () => {
    const trimmedPhone = phone.trim();
    const trimmedCountrycode = countrycode.trim() || "86";
    if (!trimmedPhone) {
      setPhoneMessage("请输入手机号");
      return;
    }
    setPhoneLoading(true);
    setPhoneMessage("");
    void runtime.sendLoginCaptcha(trimmedPhone, trimmedCountrycode).then((result) => {
      if (result.code && result.code !== 200) {
        setPhoneMessage(result.message || "验证码发送失败，请稍后重试");
        return;
      }
      setPhoneMessage("验证码已发送，请查看手机短信");
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
      setPhoneMessage("请输入手机号");
      return;
    }
    if (!trimmedCaptcha) {
      setPhoneMessage("请输入短信验证码");
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

  return (
    <Dialog open={open} onClose={onClose} title="登录网易云音乐" className={"nm-login-dialog nm-login-dialog-" + tab}>
      <div className="nm-login-dialog-body">
        <div className="nm-login-tabs">
          <Button variant={tab === "qr" ? "primary" : "ghost"} size="sm" className="nm-login-tab" onClick={() => setTab("qr")}>
            <Icon name="grid" size={14} />
            二维码登录
          </Button>
          <Button variant={tab === "phone" ? "primary" : "ghost"} size="sm" className="nm-login-tab" onClick={() => setTab("phone")}>
            <Icon name="user" size={14} />
            手机号登录
          </Button>
        </div>

        {tab === "qr" ? (
          <div className="nm-qr-panel">
            <div className={"nm-qr-image " + (qrLoading ? "nm-qr-loading" : "")}>
              {qrImage ? <img src={qrImage} alt="网易云音乐登录二维码" /> : <Icon name="grid" size={42} />}
            </div>
            <span className={"nm-login-status " + (qrStatus === "800" || qrStatus === "error" ? "nm-login-status-error" : "")}>
              {qrLoading ? "正在生成二维码..." : qrLoginMessage(qrStatus, qrMessage)}
            </span>
            <div className="nm-login-actions">
              <Button variant="ghost" size="sm" onClick={() => setQrNonce((value) => value + 1)} disabled={qrLoading}>
                <Icon name="reset" size={14} />
                刷新二维码
              </Button>
            </div>
            {qrKey ? <span className="nm-login-hint">二维码仅用于网易云音乐官方授权登录，不会在插件中保存 Cookie。</span> : null}
          </div>
        ) : (
          <div className="nm-phone-panel">
            <div className="nm-phone-form">
              <label className="nm-phone-field nm-phone-country">
                <span>区号</span>
                <TextField
                  density="compact"
                  className="nm-phone-input"
                  value={countrycode}
                  placeholder="86"
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="tel-country-code"
                  onChange={(event: any) => setCountrycode(event.target.value)}
                />
              </label>
              <label className="nm-phone-field">
                <span>手机号</span>
                <TextField
                  density="compact"
                  className="nm-phone-input"
                  value={phone}
                  placeholder="请输入手机号"
                  inputMode="tel"
                  maxLength={11}
                  autoComplete="tel-national"
                  onChange={(event: any) => setPhone(event.target.value)}
                />
              </label>
            </div>
            <div className="nm-phone-form nm-phone-captcha-form">
              <label className="nm-phone-field">
                <span>验证码</span>
                <TextField
                  density="compact"
                  className="nm-phone-input"
                  value={captcha}
                  placeholder="请输入短信验证码"
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="one-time-code"
                  onChange={(event: any) => setCaptcha(event.target.value)}
                  onKeyDown={(event: any) => {
                    if (event.key === "Enter") loginWithPhone();
                  }}
                />
              </label>
              <Button className="nm-phone-send" variant="ghost" size="sm" onClick={sendCaptcha} disabled={phoneLoading || captchaCooldown > 0}>
                {captchaCooldown > 0 ? captchaCooldown + "s" : "发送验证码"}
              </Button>
            </div>
            {phoneMessage ? <span className={"nm-login-status nm-phone-status " + (phoneMessage.includes("失败") || phoneMessage.includes("error") ? "nm-login-status-error" : "")}>{phoneMessage}</span> : null}
            <div className="nm-login-actions">
              <Button variant="primary" size="sm" className="nm-phone-submit" onClick={loginWithPhone} disabled={phoneLoading}>
                <Icon name="signIn" size={14} />
                {phoneLoading ? "登录中..." : "登录"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

function PlaylistList({
  playlists,
  activeId,
  loginNickname,
  loading = false,
  onOpen,
  onPlaylistContextMenu,
}: {
  playlists: Playlist[];
  activeId?: string;
  loginNickname: string;
  loading?: boolean;
  onOpen: (playlist: Playlist) => void;
  onPlaylistContextMenu: (event: any, playlist: Playlist, canToggleSubscribe: boolean) => void;
}) {
  if (loading && !playlists.length) return <SkeletonList kind="playlist" />;
  if (!playlists.length) return <EmptyState icon="playlist" title="暂无歌单" body="刷新账号状态后再试。" />;

  return (
    <div className="nm-scroll-list">
      {playlists.map((playlist) => (
        <PlaylistRow key={playlist.id} playlist={playlist} active={activeId === playlist.id} loginNickname={loginNickname} onOpen={onOpen} onPlaylistContextMenu={onPlaylistContextMenu} />
      ))}
    </div>
  );
}

function PlaylistRow({
  playlist,
  active,
  loginNickname,
  onOpen,
  onPlaylistContextMenu,
}: {
  playlist: Playlist;
  active: boolean;
  loginNickname: string;
  onOpen: (playlist: Playlist) => void;
  onPlaylistContextMenu: (event: any, playlist: Playlist, canToggleSubscribe: boolean) => void;
}) {
  const canToggleSubscribe = playlist.subscribed || (Boolean(loginNickname) && playlist.creator !== loginNickname);

  return (
    <div
      role="button"
      tabIndex={0}
      className={"nm-playlist-row " + (active ? "nm-row-active" : "")}
      onClick={() => onOpen(playlist)}
      onContextMenu={(event: any) => onPlaylistContextMenu(event, playlist, canToggleSubscribe)}
      onKeyDown={(event: any) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(playlist);
        }
      }}
    >
      <CoverImage src={playlist.cover} kind="playlist" className="nm-row-cover" />
      <span className="nm-row-copy">
        <span className="nm-title">{playlist.name}</span>
        <span className="nm-sub">
          {playlist.track_count} 首{playlist.creator ? " · " + playlist.creator : ""}
        </span>
      </span>
      {canToggleSubscribe ? (
        <Button
          variant="ghost"
          size="sm"
          className={"nm-row-action nm-subscribe-button " + (playlist.subscribed ? "nm-subscribe-active" : "")}
          title={playlist.subscribed ? "取消收藏歌单" : "收藏歌单"}
          onClick={(event: any) => {
            event.stopPropagation();
            void runtime.togglePlaylistSubscribe(playlist);
          }}
        >
          <Icon name={playlist.subscribed ? "bookmarkFilled" : "bookmark"} size={15} />
        </Button>
      ) : (
        <Icon name="playlist" size={16} />
      )}
    </div>
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
  emptyTitle = "暂无歌曲",
  emptyBody = "搜索歌曲或选择一个歌单。",
}: {
  songs: Song[];
  currentSong: Song | null;
  likedSongIds: string[];
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  resetKey?: string;
  onEndReached?: () => void;
  onSongContextMenu: (event: any, song: Song, queue: Song[]) => void;
  emptyTitle?: string;
  emptyBody?: string;
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

  if (loading && !songs.length) return <SkeletonList kind="song" />;
  if (!songs.length) return <EmptyState icon="music" title={emptyTitle} body={emptyBody} />;

  return (
    <div ref={scrollRef} className="nm-scroll-list nm-virtual-list" onScroll={onScroll}>
      <div className="nm-virtual-spacer" style={{ height: topSpacer }} />
      {visibleSongs.map((song, index) => (
        <div key={song.id + "-" + (startIndex + index)} className="nm-virtual-item">
          <SongRow song={song} index={startIndex + index} currentSong={currentSong} queue={songs} liked={likedSongIds.includes(song.id)} onSongContextMenu={onSongContextMenu} />
        </div>
      ))}
      <div className="nm-virtual-spacer" style={{ height: bottomSpacer }} />
      {hasMore ? <ListLoadFooter loading={loadingMore} /> : null}
    </div>
  );
}

function SkeletonList({ kind }: { kind: "song" | "playlist" }) {
  return (
    <div className="nm-scroll-list nm-skeleton-list" aria-hidden="true">
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} className={kind === "song" ? "nm-song-row nm-skeleton-row" : "nm-playlist-row nm-skeleton-row"}>
          <span className="nm-row-cover nm-skeleton-block" />
          {kind === "song" ? <span className="nm-index nm-skeleton-text nm-skeleton-short" /> : null}
          <span className="nm-row-copy">
            <span className="nm-skeleton-text nm-skeleton-title" />
            <span className="nm-skeleton-text nm-skeleton-sub" />
          </span>
          {kind === "song" ? <span className="nm-duration nm-skeleton-text nm-skeleton-short" /> : null}
          <span className="nm-row-action nm-skeleton-dot" />
        </div>
      ))}
    </div>
  );
}

function useVirtualSongList(resetKey?: string) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
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
      setScrollTop((previous) =>
        Math.floor(previous / SONG_ROW_STEP) === Math.floor(nextTop / SONG_ROW_STEP) ? previous : nextTop
      );
    });
  };

  return { scrollRef, scrollTop, viewportHeight, handleScroll, lastLoadLenRef };
}

function ListLoadFooter({ loading }: { loading: boolean }) {
  return (
    <div className="nm-list-footer">
      <Icon name={loading ? "reset" : "chevronDown"} size={14} />
      <span>{loading ? "正在加载..." : "继续向下滚动"}</span>
    </div>
  );
}

function useProgressiveRenderCount(songs: Song[], minimumCount = 0): number {
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
  compact = false,
}: {
  song: Song;
  index: number;
  currentSong: Song | null;
  queue: Song[];
  liked: boolean;
  onSongContextMenu: (event: any, song: Song, queue: Song[]) => void;
  compact?: boolean;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={["nm-song-row", compact ? "nm-song-row-compact" : "", currentSong?.id === song.id ? "nm-row-active" : ""].filter(Boolean).join(" ")}
      onClick={() => runtime.playSong(song, queue)}
      onContextMenu={(event: any) => onSongContextMenu(event, song, queue)}
      onKeyDown={(event: any) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          void runtime.playSong(song, queue);
        }
      }}
    >
      <CoverImage src={song.cover} kind="song" className="nm-row-cover" />
      <span className="nm-index">{String(index + 1).padStart(2, "0")}</span>
      <span className="nm-row-copy">
        <span className="nm-title">{song.name}</span>
        <span className="nm-sub">
          {song.artist}
          {song.album ? " · " + song.album : ""}
        </span>
      </span>
      <span className="nm-duration">{formatDuration(song.duration)}</span>
      <Button
        variant="ghost"
        size="sm"
        className={"nm-row-action nm-like-button " + (liked ? "nm-like-active" : "")}
        title={liked ? "取消喜欢" : "喜欢"}
        onClick={(event: any) => {
          event.stopPropagation();
          void runtime.toggleLike(song.id);
        }}
      >
        <Icon name={liked ? "heartFilled" : "heart"} size={15} />
      </Button>
    </div>
  );
}

function PlayerBar({
  state,
  onExpand,
  onMini,
  onSongContextMenu,
}: {
  state: PlayerState;
  onExpand: () => void;
  onMini?: () => void;
  onSongContextMenu: (event: any, song: Song, queue: Song[]) => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const queueRef = useRef<HTMLDivElement | null>(null);
  const stopBarInteraction = (event: any) => event.stopPropagation();
  const handleBarClick = (event: any) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, input, label, a, [role='button'], .nm-progress-row, .nm-controls, .nm-player-tools")) return;
    onExpand();
  };

  useEffect(() => {
    if (!queueOpen) return;
    const close = (event: any) => {
      if (queueRef.current?.contains(event.target as Node)) return;
      setQueueOpen(false);
    };
    const closeOnEscape = (event: any) => {
      if (event.key === "Escape") setQueueOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [queueOpen]);

  return (
    <>
      <section className="nm-player-bar" onClick={handleBarClick}>
        <div className="nm-progress-row" onClick={stopBarInteraction}>
          <span className="nm-time-label">{formatTime(state.currentTime)}</span>
          <div className="nm-progress">
            <Slider
              min={0}
              max={Math.max(1, state.duration)}
              step={1}
              value={Math.min(state.currentTime, Math.max(1, state.duration))}
              onChange={(value: number) => runtime.seek(value)}
            />
          </div>
          <span className="nm-time-label">{formatTime(state.duration)}</span>
        </div>

        <div className="nm-player-main">
          <div className="nm-now-brief">
            {state.currentCoverUrl ? (
              <img className="nm-mini-cover" src={state.currentCoverUrl} alt="" />
            ) : (
              <span className="nm-mini-cover nm-cover-fallback">
                <Icon name="music" size={18} />
              </span>
            )}
            <span>
              <strong>{state.currentSong?.name ?? "未播放"}</strong>
              <small>{state.currentSong?.artist ?? "网易云音乐"}</small>
            </span>
          </div>

          <div className="nm-controls" onClick={stopBarInteraction}>
            <Button variant="ghost" size="sm" className="nm-control-button" title="上一首" onClick={() => runtime.prevTrack()}>
              <Icon name="skipBackFilled" size={17} />
            </Button>
            <Button variant="primary" size="lg" className="nm-play-button" title="播放或暂停" onClick={() => runtime.togglePlay()}>
              <Icon name={state.isPlaying ? "pauseFilled" : "playFilled"} size={20} />
            </Button>
            <Button variant="ghost" size="sm" className="nm-control-button" title="下一首" onClick={() => runtime.nextTrack()}>
              <Icon name="skipForwardFilled" size={17} />
            </Button>
            <ModeButton mode={state.playMode} />
          </div>

          <div className="nm-player-tools" onClick={stopBarInteraction}>
            {state.currentSong ? (
              <Button
                variant="ghost"
                size="sm"
                className={"nm-settings-button nm-like-button " + (state.likedSongIds.includes(state.currentSong.id) ? "nm-like-active" : "")}
                title={state.likedSongIds.includes(state.currentSong.id) ? "取消喜欢" : "喜欢"}
                onClick={() => state.currentSong && runtime.toggleLike(state.currentSong.id)}
              >
                <Icon name={state.likedSongIds.includes(state.currentSong.id) ? "heartFilled" : "heart"} size={15} />
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" className="nm-settings-button" title="播放器设置" onClick={() => setSettingsOpen(true)}>
              <Icon name="settings" size={15} />
            </Button>
            {onMini ? (
              <Button variant="ghost" size="sm" className="nm-settings-button" title="迷你模式" onClick={onMini}>
                <Icon name="musicFilled" size={15} />
              </Button>
            ) : null}
            <label className="nm-volume">
              <Button
                variant="ghost"
                size="sm"
                className="nm-volume-mute"
                title={state.muted ? "取消静音" : "静音"}
                onClick={(event: any) => {
                  event.preventDefault();
                  runtime.toggleMute();
                }}
              >
                <Icon name={state.muted ? "speakerMuteFilled" : "speakerFilled"} size={14} />
              </Button>
              <Slider min={0} max={1} step={0.01} value={state.volume} onChange={(value: number) => runtime.setVolume(value)} />
            </label>
            <div ref={queueRef} className="nm-queue-anchor">
              <Button
                variant={queueOpen ? "primary" : "ghost"}
                size="sm"
                className="nm-settings-button nm-queue-button"
                title="播放队列"
                onClick={() => setQueueOpen((open) => !open)}
              >
                <Icon name="playlist" size={16} />
              </Button>
              {queueOpen ? <QueuePopover state={state} onSongContextMenu={onSongContextMenu} /> : null}
            </div>
          </div>
        </div>

      </section>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} state={state} />
    </>
  );
}

function QueuePopover({
  state,
  onSongContextMenu,
}: {
  state: PlayerState;
  onSongContextMenu: (event: any, song: Song, queue: Song[]) => void;
}) {
  const activeIndex = state.currentSong ? state.queue.findIndex((song) => song.id === state.currentSong?.id) : -1;
  const activeSongId = activeIndex >= 0 ? state.queue[activeIndex]?.id || "" : "";
  const listRef = useRef<HTMLDivElement | null>(null);
  const activeRowRef = useRef<HTMLDivElement | null>(null);
  const lastLocatedSongRef = useRef("");
  const renderCount = useProgressiveRenderCount(state.queue, activeIndex >= 0 ? activeIndex + 1 : 0);
  const visibleSongs = state.queue.slice(0, renderCount);
  const playQueuedSong = (song: Song) => {
    void runtime.playSong(song, state.queue);
  };

  useEffect(() => {
    if (!activeSongId || activeIndex >= renderCount) return;
    const frame = window.requestAnimationFrame(() => {
      const list = listRef.current;
      const row = activeRowRef.current;
      if (list && row) {
        const behavior: ScrollBehavior = lastLocatedSongRef.current ? "smooth" : "auto";
        const rowTopInList = row.offsetTop - list.offsetTop;
        const targetTop = Math.max(0, rowTopInList - (list.clientHeight - row.offsetHeight) / 2);
        list.scrollTo({ top: targetTop, behavior });
      }
      lastLocatedSongRef.current = activeSongId;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeSongId, activeIndex, renderCount]);

  return (
    <section className="nm-queue-popover" onClick={(event: any) => event.stopPropagation()}>
      <header className="nm-queue-head">
        <span>
          <strong>播放队列</strong>
          <small>{state.queue.length ? state.queue.length + " 首" : "暂无歌曲"}</small>
        </span>
        {state.queue.length ? (
          <Button variant="ghost" size="sm" className="nm-queue-clear" title="清空队列" onClick={() => runtime.clearQueue()}>
            <Icon name="trash" size={14} />
          </Button>
        ) : null}
      </header>
      {state.queue.length ? (
        <div className="nm-queue-list" ref={listRef}>
          {visibleSongs.map((song, index) => (
            <QueuePopoverRow
              key={song.id + "-" + index}
              song={song}
              index={index}
              active={state.currentSong?.id === song.id}
              activeRef={state.currentSong?.id === song.id ? activeRowRef : undefined}
              queue={state.queue}
              onPlay={playQueuedSong}
              onSongContextMenu={onSongContextMenu}
            />
          ))}
        </div>
      ) : (
        <div className="nm-queue-empty">
          <Icon name="playlist" size={24} />
          <span>从歌单或搜索结果中选择歌曲</span>
        </div>
      )}
    </section>
  );
}

function QueuePopoverRow({
  song,
  index,
  active,
  activeRef,
  queue,
  onPlay,
  onSongContextMenu,
}: {
  song: Song;
  index: number;
  active: boolean;
  activeRef?: { current: HTMLDivElement | null };
  queue: Song[];
  onPlay: (song: Song) => void;
  onSongContextMenu: (event: any, song: Song, queue: Song[]) => void;
}) {
  return (
    <div
      role="button"
      ref={activeRef}
      tabIndex={0}
      className={"nm-queue-row " + (active ? "nm-queue-row-active" : "")}
      onClick={() => onPlay(song)}
      onContextMenu={(event: any) => onSongContextMenu(event, song, queue)}
      onKeyDown={(event: any) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPlay(song);
        }
      }}
    >
      <span className="nm-queue-index">{active ? <Icon name="playFilled" size={13} /> : index + 1}</span>
      <span className="nm-queue-copy">
        <strong>{song.name}</strong>
        <small>{song.artist}</small>
      </span>
      <span className="nm-queue-duration">{formatDuration(song.duration)}</span>
    </div>
  );
}

function MiniPlayer({ state, onClose }: { state: PlayerState; onClose: () => void }) {
  return (
    <section className="nm-floating-mini" onClick={(event: any) => event.stopPropagation()}>
      {state.currentCoverUrl ? (
        <img className="nm-floating-mini-cover" src={state.currentCoverUrl} alt="" />
      ) : (
        <span className="nm-floating-mini-cover nm-cover-fallback">
          <Icon name="music" size={18} />
        </span>
      )}
      <span className="nm-floating-mini-copy">
        <strong>{state.currentSong?.name ?? "未播放"}</strong>
        <small>{state.currentSong?.artist ?? "选择歌曲开始播放"}</small>
      </span>
      <span className="nm-floating-mini-controls">
        <Button variant="ghost" size="sm" className="nm-control-button" title="上一首" onClick={() => runtime.prevTrack()}>
          <Icon name="skipBackFilled" size={15} />
        </Button>
        <Button variant="primary" size="sm" className="nm-floating-mini-play" title="播放或暂停" onClick={() => runtime.togglePlay()}>
          <Icon name={state.isPlaying ? "pauseFilled" : "playFilled"} size={16} />
        </Button>
        <Button variant="ghost" size="sm" className="nm-control-button" title="下一首" onClick={() => runtime.nextTrack()}>
          <Icon name="skipForwardFilled" size={15} />
        </Button>
        <Button variant="ghost" size="sm" className="nm-control-button" title="关闭迷你模式" onClick={onClose}>
          <Icon name="close" size={15} />
        </Button>
      </span>
    </section>
  );
}

function SettingsDialog({ open, onClose, state }: { open: boolean; onClose: () => void; state: PlayerState }) {
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

  return (
    <Dialog open={open} onClose={onClose} title="播放器设置" className="nm-settings-card">
      <div className="nm-settings-dialog">
        <div className="nm-settings-section">
          <span className="nm-dialog-label">背景</span>
          <div className="nm-settings-row">
            <span className="nm-settings-copy">
              <strong>显示当前歌曲封面</strong>
              <small>关闭后保留主题色，不再把封面铺到背景卡片。</small>
            </span>
            <Button
              variant={state.showCoverBackground ? "primary" : "ghost"}
              size="sm"
              className="nm-toggle-button"
              onClick={() => runtime.toggleCoverBackground()}
            >
              {state.showCoverBackground ? "开启" : "关闭"}
            </Button>
          </div>
        </div>
        <div className="nm-settings-section">
          <span className="nm-dialog-label">快捷键</span>
          <div className="nm-settings-row">
            <span className="nm-settings-copy">
              <strong>启用页面快捷键</strong>
              <small>空格播放/暂停，左右切歌，上下调整音量，仅插件页面内生效。</small>
            </span>
            <Button
              variant={state.keyboardShortcutsEnabled ? "primary" : "ghost"}
              size="sm"
              className="nm-toggle-button"
              onClick={() => runtime.toggleKeyboardShortcuts()}
            >
              {state.keyboardShortcutsEnabled ? "开启" : "关闭"}
            </Button>
          </div>
        </div>
        <div className="nm-settings-section">
          <span className="nm-dialog-label">缓存</span>
          <div className="nm-cache-panel">
            <span>
              封面缓存 当前 {cacheStats.coverCount} 项
              {cacheStats.coverPendingCount ? "，加载中 " + cacheStats.coverPendingCount + " 项" : ""}
            </span>
            <span>
              歌单缓存 当前 {cacheStats.playlistCount} 个 / {cacheStats.playlistTrackCount} 首
            </span>
            <span>列表缓存 {cacheStats.persistedListCount} 组</span>
            <span className="nm-cache-actions">
              <Button variant="ghost" size="sm" className="nm-cache-button" onClick={clearCoverCache}>清封面</Button>
              <Button variant="ghost" size="sm" className="nm-cache-button" onClick={clearPlaylistCache}>清歌单</Button>
              <Button variant="primary" size="sm" className="nm-cache-button" onClick={clearAllCaches}>全部清理</Button>
            </span>
          </div>
        </div>
        <div className="nm-settings-section">
          <span className="nm-dialog-label">音质</span>
          <QualityGroup value={state.quality} />
        </div>
      </div>
    </Dialog>
  );
}

function ExpandedPlayer({ state, closing, onClose }: { state: PlayerState; closing: boolean; onClose: () => void }) {
  const activeRef = useRef<HTMLDivElement | null>(null);
  const activeLyric = activeLyricIndex(state.lyrics, state.currentTime);
  const showTrialBadge = state.trial && !hasMusicMembership(state.loginInfo);
  const coverBackgroundUrl = state.showCoverBackground ? state.currentCoverUrl : "";

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeLyric]);

  return (
    <section
      className={"nm-expanded-player " + (closing ? "nm-expanded-closing" : "")}
      style={coverBackgroundUrl ? { backgroundImage: 'url("' + coverBackgroundUrl + '")' } : undefined}
    >
      <div className="nm-expanded-overlay" />
      <div className="nm-expanded-content">
        <header className="nm-expanded-top">
          <Button variant="ghost" size="sm" className="nm-icon-button" title="收起" onClick={onClose}>
            <Icon name="chevronDown" size={18} />
          </Button>
          <span className="nm-kicker">Now Playing</span>
          <span className="nm-lyrics-tools">
            <Button
              variant={state.showLyricTranslation ? "primary" : "ghost"}
              size="sm"
              className="nm-panel-tab"
              title="显示翻译"
              onClick={() => runtime.toggleLyricTranslation()}
            >
              译
            </Button>
            {(["compact", "normal", "large"] as const).map((size) => (
              <Button
                key={size}
                variant={state.lyricFontSize === size ? "primary" : "ghost"}
                size="sm"
                className="nm-lyric-size-button"
                title={size === "compact" ? "小字号" : size === "large" ? "大字号" : "标准字号"}
                onClick={() => runtime.setLyricFontSize(size)}
              >
                {size === "compact" ? "小" : size === "large" ? "大" : "中"}
              </Button>
            ))}
          </span>
        </header>

        <div className="nm-expanded-grid">
          <section className="nm-cover-stage">
            <div className="nm-cover-wrap">
              <div className={"nm-vinyl " + (state.isPlaying ? "nm-vinyl-playing" : "")} />
              <div className="nm-cover-frame">
                {state.currentCoverUrl ? (
                  <img className="nm-cover" src={state.currentCoverUrl} alt="" />
                ) : (
                  <span className="nm-cover nm-cover-empty">
                    <Icon name="music" size={72} />
                  </span>
                )}
                {showTrialBadge ? <span className="nm-badge">试听片段</span> : null}
              </div>
            </div>
            <div className="nm-track-meta">
              <strong>{state.currentSong?.name ?? "未播放"}</strong>
              <span>{state.currentSong?.artist ?? "选择一首歌曲开始播放"}</span>
            </div>
          </section>

          <section className={"nm-lyrics-panel nm-lyrics-" + state.lyricFontSize}>
            {state.lyrics.length ? (
              state.lyrics.map((line, index) => (
                <div
                  key={line.time + "-" + index}
                  ref={index === activeLyric ? activeRef : undefined}
                  className={"nm-lyric-line " + (index === activeLyric ? "nm-lyric-active" : "")}
                  role="button"
                  tabIndex={0}
                  title="跳转到这一句"
                  onClick={() => runtime.seek(line.time)}
                  onKeyDown={(event: any) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      runtime.seek(line.time);
                    }
                  }}
                >
                  <div>{line.text}</div>
                  {state.showLyricTranslation && line.translation ? <small>{line.translation}</small> : null}
                </div>
              ))
            ) : (
              <LyricStatusState state={state} />
            )}
          </section>
        </div>

        <PlayerBar state={state} onExpand={() => undefined} />
      </div>
    </section>
  );
}

function LyricStatusState({ state }: { state: PlayerState }) {
  const meta =
    state.lyricStatus === "loading"
      ? { icon: "reset", title: "正在加载歌词", body: "歌词会在播放开始后自动同步。" }
      : state.lyricStatus === "instrumental"
        ? { icon: "music", title: "纯音乐", body: "这首歌没有歌词，专心听旋律就好。" }
        : state.currentSong
          ? { icon: "music", title: "暂无歌词", body: "当前歌曲暂时没有可展示的歌词。" }
          : { icon: "music", title: "未播放", body: "选择一首歌曲后会显示歌词。" };

  return (
    <div className={"nm-lyric-status " + (state.lyricStatus === "loading" ? "nm-lyric-status-loading" : "")}>
      <span className="nm-lyric-status-icon">
        <Icon name={meta.icon} size={22} />
      </span>
      <strong>{meta.title}</strong>
      <small>{meta.body}</small>
    </div>
  );
}

function ModeButton({ mode }: { mode: string }) {
  const meta =
    mode === "shuffle"
      ? { icon: "shuffle", title: "随机播放", next: "one" }
      : mode === "one"
        ? { icon: "repeatOnce", title: "单曲循环", next: "list" }
        : { icon: "repeat", title: "列表循环", next: "shuffle" };

  return (
    <Button variant="ghost" size="sm" className={"nm-mode-button " + (mode !== "list" ? "nm-mode-active" : "")} title={meta.title} onClick={() => runtime.setPlayMode(meta.next as any)}>
      <Icon name={meta.icon} size={15} />
    </Button>
  );
}

function QualityGroup({ value }: { value: string }) {
  return (
    <div className="nm-quality-group">
      {[
        { value: "standard", label: "标准" },
        { value: "exhigh", label: "较高" },
        { value: "lossless", label: "无损" },
        { value: "hires", label: "Hi-Res" },
      ].map((option) => (
        <Button
          key={option.value}
          variant={option.value === value ? "primary" : "ghost"}
          size="sm"
          className="nm-quality-button"
          onClick={() => runtime.setQuality(option.value as any)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function isShortcutTargetAllowed(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  return !target.closest("input, textarea, select, button, label, [contenteditable='true'], [role='button']");
}

function hasMusicMembership(loginInfo: PlayerState["loginInfo"]): boolean {
  if (!loginInfo?.logged_in) return false;
  return Boolean(loginInfo.is_vip || loginInfo.is_svip || (loginInfo.vip_type ?? 0) > 0 || (loginInfo.vip_level ?? 0) > 0);
}

function qrLoginMessage(code: string | number, fallback?: string): string {
  const normalized = String(code || "");
  if (normalized === "800") return "二维码已过期，请刷新后重新扫码";
  if (normalized === "801") return "请使用网易云音乐 App 扫码登录";
  if (normalized === "802") return "已扫码，请在手机上确认登录";
  if (normalized === "803") return "登录成功，正在刷新账号信息";
  return fallback || "等待扫码确认";
}

function CoverImage({ src, kind, className }: { src?: string; kind: CoverKind; className: string }) {
  const [cover, setCover] = useState(() => ({
    src: src || "",
    url: src ? runtime.cachedCoverProxyUrl(src) : "",
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

  if (cover.src === src && cover.url) return <img className={className} src={cover.url} alt="" loading="lazy" decoding="async" />;

  return (
    <span className={className + " nm-cover-fallback"}>
      <Icon name={kind === "playlist" ? "playlist" : kind === "avatar" ? "user" : "music"} size={kind === "avatar" ? 17 : 16} />
    </span>
  );
}

function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="nm-empty">
      <span className="nm-empty-icon">
        <Icon name={icon} size={20} />
      </span>
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

async function extractThemeColor(src: string): Promise<string> {
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

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0")).join("")}`;
}

function formatDuration(ms: number): string {
  return formatTime(Math.round(ms / 1000));
}

function formatPublishDate(value?: number | null): string {
  if (!value) return "";
  const timestamp = value > 100000000000 ? value : value * 1000;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function songContextArtists(song: Song): Artist[] {
  const artists: Artist[] = [];
  const seen = new Set<string>();
  const add = (artist: Partial<Artist> | null | undefined) => {
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

function buildSearchSuggestions(query: string, state: PlayerState): Array<{ value: string; label: string; type: string; icon: string }> {
  const keyword = query.trim().toLowerCase();
  const items: Array<{ value: string; label: string; type: string; icon: string }> = [];
  const push = (value: string, type: string, icon: string) => {
    const normalized = value.trim();
    if (!normalized) return;
    if (keyword && !normalized.toLowerCase().includes(keyword)) return;
    if (items.some((item) => item.value === normalized)) return;
    items.push({ value: normalized, label: normalized, type, icon });
  };

  for (const value of state.searchHistory) push(value, "历史", "clock");
  if (!keyword) return items.slice(0, 8);
  for (const song of [...state.searchResults, ...state.recentSongs, ...state.recommendSongs]) {
    push(song.name, "单曲", "music");
    push(song.artist, "歌手", "user");
    if (song.album) push(song.album, "专辑", "music");
  }
  for (const playlist of [...state.userPlaylists, ...state.discoverPlaylists, ...state.topPlaylists, ...state.searchPlaylists]) {
    push(playlist.name, "歌单", "playlist");
  }
  for (const album of [...state.searchAlbums, ...state.mediaDetailAlbums]) push(album.name, "专辑", "music");
  for (const artist of [...state.searchArtists, ...state.mediaDetailArtists]) push(artist.name, "歌手", "user");

  return items.slice(0, 8);
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = String(total % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}
