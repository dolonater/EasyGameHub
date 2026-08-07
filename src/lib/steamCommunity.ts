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
  isFree: boolean;
}
