/**
 * Shared DTO types for Steam community features.
 *
 * Shapes mirror the Rust command layer (`src-tauri/src/commands/steam_auth.rs`,
 * `steam_api.rs`, and the Phase 2+ `steam_community.rs`). Serialization on the
 * Rust side uses `serde(rename_all = "camelCase")`, so all fields here are
 * camelCase.
 */

/** Active Steam login session (from `get_active_session` / login result). */
export interface SessionDto {
  /** SteamID64 as a string — exceeds JS safe-integer range as a number. */
  steamId: string;
  accountName: string;
  accessToken: string;
  refreshToken: string;
  isActive: boolean;
}

/** Abbreviate a SteamID64 for display only, e.g. 76561198000000001 → 7656...001. */
export function shortSteamId(id: string): string {
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}...${id.slice(-3)}`;
}

/** Public profile summary (from `get_steam_user_info`, mini-profile API). */
export interface SteamProfileDto {
  /** SteamID64 as a string — exceeds JS safe-integer range as a number. */
  steamId64: string;
  personaName: string | null;
  avatarUrl: string | null;
  level: number | null;
  /** Game the user is currently in-game in, if any. */
  inGameName: string | null;
}

/** Logged-in profile state surfaced to the Steam hub. */
export interface SteamSessionState {
  session: SessionDto | null;
  profile: SteamProfileDto | null;
  loading: boolean;
}

/** A news item for a game (from `get_game_news` / `get_news_feed`). */
export interface NewsItemDto {
  appId: number;
  title: string;
  url: string;
  author: string | null;
  /** HTML stripped, whitespace collapsed. */
  contents: string;
  feedLabel: string | null;
  feedType: number | null;
  /** Unix timestamp (seconds). */
  date: number;
}

/** A manually watched game (news + discount monitoring scope). */
export interface WatchItemDto {
  appId: number;
  name: string | null;
  addedAt: string;
}

/** An entry in the user's public Steam wishlist. */
export interface WishlistItemDto {
  appId: number;
  name: string | null;
}

/** Live price + drop status for a game (from `get_steam_prices`). */
export interface PriceDto {
  appId: number;
  currency: string | null;
  /** Base-unit price (cents for decimal currencies). */
  finalPrice: number | null;
  initialPrice: number | null;
  discountPercent: number;
  /** Pre-formatted strings from the store — safe to display directly. */
  finalFormatted: string | null;
  initialFormatted: string | null;
  /** True when the final price dropped below the last recorded baseline. */
  dropped: boolean;
  /** Lowest final price ever recorded for this app (sparkline minimum). */
  lowestPrice: number | null;
  /** Price history (newest last) for the sparkline. */
  history: PriceHistoryPoint[];
  /** True when the current price is at or below the user's reminder price. */
  thresholdHit: boolean;
}

/** One recorded price observation in a game's history. */
export interface PriceHistoryPoint {
  finalPrice: number;
  discountPercent: number;
  /** Local time "YYYY-MM-DD HH:MM:SS". */
  date: string;
}

/** A persisted price-drop event (from `get_price_drop_events`). */
export interface PriceDropEventDto {
  appId: number;
  prevPrice: number;
  newPrice: number;
  discountPercent: number;
  currency: string;
  /** Local time "YYYY-MM-DD HH:MM:SS". */
  date: string;
}

/** A hit from the Steam store search (from `search_steam_games`). */
export interface SearchResultDto {
  appId: number;
  name: string;
  tinyImage: string | null;
  finalPrice: number | null;
  currency: string | null;
}

/** A game from the Web API inventory (`GetOwnedGames` / `GetRecentlyPlayedGames`). */
export interface OwnedGameDto {
  appid: number;
  name: string | null;
  /** Total playtime in minutes. */
  playtimeForever: number;
  /** Playtime in the last two weeks, in minutes. */
  playtime2weeks: number | null;
  imgIconUrl: string | null;
  imgLogoUrl: string | null;
}

/** A game from the local library (from `get_local_steam_games`). */
export interface LocalGameDto {
  appId: number;
  name: string | null;
  /** Playtime in minutes. */
  playtimeMinutes: number;
  isInstalled: boolean;
  installDir: string | null;
  installPath: string | null;
  sizeOnDisk: number | null;
  isHidden: boolean;
}

/** Snapshot of account-level library stats shown on the overview tab. */
export interface OverviewStats {
  /** Owned games found in the local Steam library. */
  gamesCount: number;
  /** Total playtime in minutes across owned games. */
  totalMinutes: number;
  /** Recently played (Web API) or top-played (local fallback) games. */
  recent: OwnedGameDto[];
  /** Where `recent` came from: "web" (API key available) or "local". */
  recentSource: "web" | "local";
}

/** Icon URL for an owned game from the Web API (media.steampowered.com). */
export function ownedGameIconUrl(game: OwnedGameDto): string | null {
  if (game.imgIconUrl) {
    return `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.imgIconUrl}.jpg`;
  }
  return null;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: "¥",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  RUB: "₽",
  KRW: "₩",
  CAD: "C$",
  AUD: "A$",
  BRL: "R$",
  HKD: "HK$",
  TWD: "NT$",
};

/**
 * Format a Steam price amount into a readable string. Steam reports every
 * currency's `final`/`initial` fields in hundredths ("cents") — including
 * JPY/KRW, whose formatted prices merely omit the decimals (¥1,117 is reported
 * numerically as 111700) — so the value is always divided by 100.
 */
export function formatPriceCents(cents: number, currency: string | null): string {
  const symbol = currency ? CURRENCY_SYMBOLS[currency] || `${currency} ` : "";
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

/**
 * Format a Steam price for browse cards. Like [`formatPriceCents`], but
 * JPY/KRW omit the decimals (¥1,117) since Steam reports their values in
 * hundredths too and only the formatted display drops them. Unknown
 * currencies fall back to a `CODE x.xx` prefix.
 */
export function formatPrice(cents: number, currency: string | null): string {
  const symbol = currency ? CURRENCY_SYMBOLS[currency] || `${currency} ` : "";
  if (currency === "JPY" || currency === "KRW") {
    return `${symbol}${Math.round(cents / 100)}`;
  }
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

/** Convert a playtime in minutes to a short human string, e.g. 3845 → "64.1h". */
export function formatPlaytimeMinutes(minutes: number): string {
  if (minutes <= 0) return "0h";
  const hours = minutes / 60;
  return hours >= 100 ? `${Math.round(hours)}h` : `${hours.toFixed(1)}h`;
}

/** A pending Steam mobile confirmation (from `get_pending_confirmations`). */
export interface PendingConfirmation {
  id: string;
  key: string;
  kind: "trade" | "market" | "guard" | "other";
  description: string;
}

/** Cached store metadata for a game (from `get_steam_metadata`). */
export interface MetadataDto {
  appId: number;
  name: string | null;
  shortDescription: string | null;
  headerImage: string | null;
  genres: string[];
  developers: string[];
  releaseDate: string | null;
  /** True when the store marks this title as not yet released. */
  comingSoon: boolean;
  isFree: boolean;
}

// ── Store detail & multi-region prices ───────────────────────

export interface StorePriceDto {
  currency: string;
  initial: number;
  finalPrice: number;
  discountPercent: number;
  initialFormatted: string | null;
  finalFormatted: string | null;
}

export interface StoreScreenshotDto {
  id: number;
  pathThumbnail: string | null;
  pathFull: string | null;
}

export interface StoreRequirementsDto {
  minimum: string | null;
  recommended: string | null;
}

export interface StoreMetacriticDto {
  score: number;
  url: string | null;
}

export interface StoreDlcDto {
  appId: number;
  name: string | null;
  finalFormatted: string | null;
  currency: string | null;
}

/** Full store detail for a game (from `get_store_detail`). */
export interface StoreDetailDto {
  appId: number;
  name: string | null;
  shortDescription: string | null;
  detailedDescription: string | null;
  aboutTheGame: string | null;
  headerImage: string | null;
  website: string | null;
  genres: string[];
  developers: string[];
  releaseDate: string | null;
  comingSoon: boolean;
  isFree: boolean;
  price: StorePriceDto | null;
  screenshots: StoreScreenshotDto[];
  pcRequirements: StoreRequirementsDto | null;
  supportedLanguages: string | null;
  metacritic: StoreMetacriticDto | null;
  recommendationsTotal: number | null;
  dlc: StoreDlcDto[];
}

/** One region's price for the comparison table (from `get_multi_region_price`). */
export interface RegionPriceDto {
  cc: string;
  currency: string | null;
  finalCents: number | null;
  initialCents: number | null;
  discountPercent: number;
  finalFormatted: string | null;
  initialFormatted: string | null;
  /** Approximate CNY (static FX table), for cross-region comparison. */
  cnyCents: number | null;
}

// ── Store browse (storefront rails + filtered grid) ─────────

export interface BrowsePlatformsDto {
  windows: boolean;
  mac: boolean;
  linux: boolean;
}

/** One title in a browse grid or storefront rail (from `browse_steam_games` /
 * `get_store_home`). Prices are base units (cents for decimal currencies). */
export interface BrowseItemDto {
  appId: number;
  name: string;
  tinyImage: string | null;
  finalPrice: number | null;
  initialPrice: number | null;
  discountPercent: number | null;
  currency: string | null;
  releaseDate: string | null;
  platforms: BrowsePlatformsDto | null;
  metacriticScore: number | null;
}

/** A page of browse results (from `browse_steam_games`). */
export interface BrowseResultDto {
  /** Total matching titles across all pages. */
  total: number;
  items: BrowseItemDto[];
}

/** One storefront rail (from `get_store_home`). */
export interface FeaturedRailDto {
  id: string;
  name: string | null;
  items: BrowseItemDto[];
}

/** Storefront home payload: featured rail + curated rails. */
export interface StoreHomeDto {
  featured: BrowseItemDto[];
  rails: FeaturedRailDto[];
}

// ── Notifications ────────────────────────────────────────────

/** One entry in the Steam notification feed (from `get_notifications`). */
export interface SteamNotificationDto {
  /** Stable id (`drop:<appid>:<date>` / `news:<appid>:<ts>` / `confirmation:<id>`). */
  id: string;
  kind: "price_drop" | "news" | "confirmation";
  title: string;
  subtitle: string;
  /** Local "YYYY-MM-DD HH:MM:SS". */
  timestamp: string;
  read: boolean;
}
