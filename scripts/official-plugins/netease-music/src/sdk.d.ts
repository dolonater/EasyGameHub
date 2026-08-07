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

  export interface LoginQrKeyResult {
    unikey: string;
    qr_url: string;
    qr_image: string;
  }

  export interface LoginQrCheckResult {
    code: number;
    message: string;
    logged_in: boolean;
    login_info?: LoginInfo | null;
  }

  export interface CaptchaSentResult {
    code: number;
    message: string;
  }

  export interface Lyrics {
    lyric: string;
    translation: string;
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
  }

  export function createElement(type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]): unknown;
  export const Fragment: symbol;
  export function useState<T>(initial: T | (() => T)): [T, (next: T | ((prev: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
  export function useRef<T>(initial: T): { current: T };

  export const Button: any;
  export const Dialog: any;
  export const Icon: any;
  export const Select: any;
  export const Slider: any;
  export const TextField: any;
  export const Toggle: any;

  const _default: {
    createElement: typeof createElement;
    Fragment: typeof Fragment;
    useState: typeof useState;
    useEffect: typeof useEffect;
    useRef: typeof useRef;
  };
  export default _default;
}
