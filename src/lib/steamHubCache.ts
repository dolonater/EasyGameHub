import { useSyncExternalStore } from "react";
import type {
  MetadataDto,
  NewsItemDto,
  OverviewStats,
  PriceDto,
  SessionDto,
  SteamNotificationDto,
  SteamProfileDto,
  WatchItemDto,
  WishlistItemDto,
} from "./steamCommunity";

/**
 * Module-level cache for Steam Hub data.
 *
 * React Router unmounts the Steam page when you navigate away, so ordinary
 * component state is lost on the way back. Keeping the loaded data here (via
 * `useSyncExternalStore`) lets the page re-render instantly from the last
 * snapshot on return, while the hooks refresh it silently in the background.
 */
export interface SteamHubCache {
  session: SessionDto | null;
  profile: SteamProfileDto | null;
  /** True once the session/profile have been fetched at least once. */
  hasLoaded: boolean;
  watchItems: WatchItemDto[];
  wishItems: WishlistItemDto[];
  wishError: boolean;
  /** True once the wishlist has been fetched at least once this session. */
  wishLoadedOnce: boolean;
  /** Live prices shown in the wishlist tab, keyed by app id. */
  wishPrices: Record<number, PriceDto>;
  /** Store metadata shown in the wishlist tab. */
  wishMetadata: Record<number, MetadataDto>;
  /** appIds signature that wishPrices/wishMetadata correspond to. */
  wishKey: string;
  newsItems: NewsItemDto[];
  newsMetadata: Record<number, MetadataDto>;
  /** appIds signature ("a,b,c") that newsItems/newsMetadata correspond to. */
  newsKey: string;
  /** Overview tab library stats (games count, total playtime, recent). */
  overviewStats: OverviewStats | null;
  /** Last active sub-tab, restored on return. */
  activeTab: string;
  /** Notification feed (from `get_notifications`), for the 通知 tab + badge. */
  notifications: SteamNotificationDto[];
  /** Number of unread notifications in the last fetched feed. */
  notificationsUnread: number;
}

const initialCache: SteamHubCache = {
  session: null,
  profile: null,
  hasLoaded: false,
  watchItems: [],
  wishItems: [],
  wishError: false,
  wishLoadedOnce: false,
  wishPrices: {},
  wishMetadata: {},
  wishKey: "",
  newsItems: [],
  newsMetadata: {},
  newsKey: "",
  overviewStats: null,
  activeTab: "overview",
  notifications: [],
  notificationsUnread: 0,
};

let cache: SteamHubCache = initialCache;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): SteamHubCache {
  return cache;
}

/** Subscribe a component to the Steam Hub cache (survives route switches). */
export function useSteamHubCache(): SteamHubCache {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Merge a partial update into the cache and notify subscribers. */
export function patchSteamHubCache(patch: Partial<SteamHubCache>): void {
  cache = { ...cache, ...patch };
  listeners.forEach((l) => l());
}
