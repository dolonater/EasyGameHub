import { invoke } from "@tauri-apps/api/core";
import type { ReactElement } from "react";
import { createElement, Fragment, useCallback, useContext, useEffect, useRef, useState } from "react";
import { showToast } from "../lib/toast";
import { off, onForPlugin } from "./events";
import type {
  CaptchaSentResult,
  Lyrics,
  LoginQrCheckResult,
  LoginQrKeyResult,
  LoginInfo,
  Album,
  Artist,
  PlaybackQuality,
  Playlist,
  Song,
  SongUrlResult,
} from "./music-types";

export type {
  Artist,
  Album,
  CaptchaSentResult,
  Lyrics,
  LoginInfo,
  LoginQrCheckResult,
  LoginQrKeyResult,
  PlaybackQuality,
  PlayMode,
  Playlist,
  Song,
  SongUrlResult,
} from "./music-types";

// React re-exports — plugins must NOT import "react" directly; everything
// comes from the "sdk" module (resolved via the document import map).
export { createElement, Fragment, useCallback, useContext, useEffect, useRef, useState };

/// Default export mirrors the React surface so plugins can write the classic
/// JSX transform import (`import React from "sdk"`) per design 3.1.
export default {
  createElement,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
};

// Curated set of app UI components plugins can reuse.
export { default as Button } from "../components/ui/Button";
export { default as Dialog } from "../components/ui/Dialog";
export { default as Icon } from "../components/ui/Icon";
export { default as Select } from "../components/ui/Select";
export { default as Slider } from "../components/ui/Slider";
export { default as TextField } from "../components/ui/TextField";
export { default as Toggle } from "../components/ui/Toggle";

/// Highest api_version the current SDK supports. Bump only on breaking changes.
export const apiVersion = 1;

export const ALL_PERMISSIONS = ["core.read", "core.backup", "events", "ui", "music"] as const;
export type Permission = (typeof ALL_PERMISSIONS)[number];
export type LifecycleDispose = () => void | Promise<void>;

export interface RegisteredPage {
  pluginId: string;
  path: string;
  title: string;
  icon?: string;
  render: () => ReactElement;
}

export interface RegisteredSettingsSection {
  pluginId: string;
  id: string;
  title: string;
  render: () => ReactElement;
}

// Module-level UI registries, keyed by pluginId (loader clears on unload).
export const registeredPages: RegisteredPage[] = [];
export const registeredSettingsSections: RegisteredSettingsSection[] = [];
const disposeCallbacks = new Map<string, LifecycleDispose[]>();

export function clearPluginRegistrations(pluginId: string) {
  for (let i = registeredPages.length - 1; i >= 0; i--) {
    if (registeredPages[i].pluginId === pluginId) registeredPages.splice(i, 1);
  }
  for (let i = registeredSettingsSections.length - 1; i >= 0; i--) {
    if (registeredSettingsSections[i].pluginId === pluginId) registeredSettingsSections.splice(i, 1);
  }
}

export async function runPluginDispose(pluginId: string): Promise<unknown[]> {
  const callbacks = disposeCallbacks.get(pluginId) ?? [];
  const errors: unknown[] = [];
  for (const callback of callbacks) {
    try {
      await callback();
    } catch (e) {
      errors.push(e);
    }
  }
  return errors;
}

export function clearPluginDispose(pluginId: string): void {
  disposeCallbacks.delete(pluginId);
}

export interface PluginSdk {
  apiVersion: number;
  log: (...args: unknown[]) => void;
  ui: {
    registerPage(page: { path: string; title: string; icon?: string; render: () => ReactElement }): void;
    registerSettingsSection(section: { id: string; title: string; render: () => ReactElement }): void;
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

/// Build the SDK instance handed to a plugin at load time. The allowlist is
/// enforced here: calling an API whose permission was not declared in the
/// manifest throws PermissionDenied.
export function createPluginSdk(pluginId: string, permissions: string[]): PluginSdk {
  const allowed = new Set(permissions);
  function requirePerm(perm: Permission, apiName: string) {
    if (!allowed.has(perm)) {
      throw new Error(
        `PermissionDenied: plugin "${pluginId}" lacks permission "${perm}" (${apiName})`
      );
    }
  }

  return {
    apiVersion,
    log: (...args: unknown[]) => console.log(`[plugin:${pluginId}]`, ...args),

    ui: {
      registerPage(page) {
        requirePerm("ui", "ui.registerPage");
        registeredPages.push({ pluginId, ...page });
      },
      registerSettingsSection(section) {
        requirePerm("ui", "ui.registerSettingsSection");
        registeredSettingsSections.push({ pluginId, ...section });
      },
      notify(message) {
        requirePerm("ui", "ui.notify");
        showToast("info", message);
      },
    },

    core: {
      listGames() {
        requirePerm("core.read", "core.listGames");
        return invoke("get_games");
      },
      listSnapshots(gameId) {
        requirePerm("core.read", "core.listSnapshots");
        return invoke("get_snapshots", { gameId });
      },
      getGame(gameId) {
        requirePerm("core.read", "core.getGame");
        return invoke("get_game_by_id", { gameId });
      },
      triggerBackup(gameId) {
        requirePerm("core.backup", "core.triggerBackup");
        return invoke("backup_now", { gameId });
      },
    },

    events: {
      on(event, handler) {
        requirePerm("events", "events.on");
        onForPlugin(pluginId, event, handler);
      },
      off(event, handler) {
        requirePerm("events", "events.off");
        off(event, handler);
      },
    },

    storage: {
      get() {
        return invoke("read_plugin_config", { id: pluginId });
      },
      set(data) {
        return invoke("write_plugin_config", { id: pluginId, data });
      },
    },

    lifecycle: {
      onDispose(callback) {
        const callbacks = disposeCallbacks.get(pluginId) ?? [];
        callbacks.push(callback);
        disposeCallbacks.set(pluginId, callbacks);
      },
    },

    music: {
      openLoginWindow() {
        requirePerm("music", "music.openLoginWindow");
        return invoke("music_open_login_window");
      },
      loginQrKey() {
        requirePerm("music", "music.loginQrKey");
        return invoke("music_login_qr_key");
      },
      loginQrCheck(key) {
        requirePerm("music", "music.loginQrCheck");
        return invoke("music_login_qr_check", { key });
      },
      sendLoginCaptcha(phone, countrycode) {
        requirePerm("music", "music.sendLoginCaptcha");
        return invoke("music_login_send_captcha", { phone, countrycode });
      },
      loginCellphone(phone, captcha, countrycode) {
        requirePerm("music", "music.loginCellphone");
        return invoke("music_login_cellphone", { phone, captcha, countrycode });
      },
      loginStatus() {
        requirePerm("music", "music.loginStatus");
        return invoke("music_login_status");
      },
      logout() {
        requirePerm("music", "music.logout");
        return invoke("music_logout");
      },
      search(keywords, limit) {
        requirePerm("music", "music.search");
        return invoke("music_search", { keywords, limit });
      },
      userPlaylists() {
        requirePerm("music", "music.userPlaylists");
        return invoke("music_user_playlists");
      },
      likedList() {
        requirePerm("music", "music.likedList");
        return invoke("music_likelist");
      },
      likeSong(id, like) {
        requirePerm("music", "music.likeSong");
        return invoke("music_like", { id, like });
      },
      subscribePlaylist(id, subscribe) {
        requirePerm("music", "music.subscribePlaylist");
        return invoke("music_playlist_subscribe", { id, subscribe });
      },
      recommendSongs() {
        requirePerm("music", "music.recommendSongs");
        return invoke("music_recommend_songs");
      },
      topPlaylists() {
        requirePerm("music", "music.topPlaylists");
        return invoke("music_toplists");
      },
      personalizedPlaylists() {
        requirePerm("music", "music.personalizedPlaylists");
        return invoke("music_personalized_playlists");
      },
      searchPlaylists(keywords, limit) {
        requirePerm("music", "music.searchPlaylists");
        return invoke("music_playlist_search", { keywords, limit });
      },
      searchAlbums(keywords, limit) {
        requirePerm("music", "music.searchAlbums");
        return invoke("music_album_search", { keywords, limit });
      },
      searchArtists(keywords, limit) {
        requirePerm("music", "music.searchArtists");
        return invoke("music_artist_search", { keywords, limit });
      },
      albumSongs(id) {
        requirePerm("music", "music.albumSongs");
        return invoke("music_album_songs", { id });
      },
      artistSongs(id) {
        requirePerm("music", "music.artistSongs");
        return invoke("music_artist_songs", { id });
      },
      playlistTracks(id) {
        requirePerm("music", "music.playlistTracks");
        return invoke("music_playlist_tracks", { id });
      },
      playlistTracksRange(id, start, count) {
        requirePerm("music", "music.playlistTracksRange");
        return invoke("music_playlist_tracks_range", { id, start, count });
      },
      songUrl(id, quality) {
        requirePerm("music", "music.songUrl");
        const args = quality ? { id, quality } : { id };
        return invoke("music_song_url", args);
      },
      lyric(id) {
        requirePerm("music", "music.lyric");
        return invoke("music_lyric", { id });
      },
      proxyPort() {
        requirePerm("music", "music.proxyPort");
        return invoke("music_proxy_port");
      },
      async audioProxyUrl(rawUrl) {
        requirePerm("music", "music.audioProxyUrl");
        const port = await invoke<number>("music_proxy_port");
        return `http://127.0.0.1:${port}/audio?url=${encodeURIComponent(rawUrl)}`;
      },
      async coverProxyUrl(rawUrl) {
        requirePerm("music", "music.coverProxyUrl");
        if (!rawUrl) return "";
        const port = await invoke<number>("music_proxy_port");
        return `http://127.0.0.1:${port}/cover?url=${encodeURIComponent(rawUrl)}`;
      },
      clearCoverCache() {
        requirePerm("music", "music.clearCoverCache");
        return invoke("music_clear_cover_cache");
      },
    },
  };
}
