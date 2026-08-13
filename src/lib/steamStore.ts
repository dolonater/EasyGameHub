import { invoke } from "@tauri-apps/api/core";
import type { BrowseResultDto, StoreHomeDto } from "./steamCommunity";

/** Filters for `browse_steam_games`. Omitted keys keep their backend defaults. */
export interface BrowseSteamGamesParams {
  /** Search term; empty/omitted browses without a query. */
  term?: string;
  /** `category1` genre id (e.g. 19 = Action). */
  category?: number;
  /** `sort_by` value: relevance / Price_ASC / Price_DESC / Reviews_DESC / Released_DESC. */
  sort?: string;
  /** When true, only discounted titles are returned. */
  specials?: boolean;
  /** Store country code; defaults to `cn`. */
  cc?: string;
  /** First result offset for pagination. */
  start?: number;
  /** Results per page; defaults to 15. */
  count?: number;
}

/** Browse the store with filters (genre, sort, discounts, region) and pagination. */
export function browseSteamGames(params: BrowseSteamGamesParams): Promise<BrowseResultDto> {
  const args: Record<string, unknown> = {};
  if (params.term !== undefined) args.term = params.term;
  if (params.category !== undefined) args.category = params.category;
  if (params.sort !== undefined) args.sort = params.sort;
  if (params.specials !== undefined) args.specials = params.specials;
  if (params.cc !== undefined) args.cc = params.cc;
  if (params.start !== undefined) args.start = params.start;
  if (params.count !== undefined) args.count = params.count;
  return invoke<BrowseResultDto>("browse_steam_games", args);
}

/** Storefront home: featured rail + curated rails for the given region. */
export function getStoreHome(cc?: string): Promise<StoreHomeDto> {
  return invoke<StoreHomeDto>("get_store_home", cc ? { cc } : {});
}

/** Capsule image URL (direct CDN, sized for list cards). */
export function capsuleImageUrl(appId: number): string {
  return `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/capsule_616x353.jpg`;
}

/** Header banner URL (direct CDN). */
export function headerImageUrl(appId: number): string {
  return `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;
}
