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

export type PlayMode = "list" | "shuffle" | "one";
export type PlaybackQuality = "hires" | "lossless" | "exhigh" | "standard";
