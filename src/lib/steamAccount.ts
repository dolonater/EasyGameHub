const STEAM_ID64_BASE = 76561197960265728n;

export interface SteamIdFormats {
  steamId: string;
  steamId3: string;
  steamId32: string;
  steamId64: string;
}

export function getSteamIdFormats(steamId64: string): SteamIdFormats {
  const steam64 = BigInt(steamId64);
  const steam32 = steam64 - STEAM_ID64_BASE;
  const oddity = steam32 % 2n;
  const accountNumber = steam32 / 2n;

  return {
    steamId: `STEAM_0:${oddity.toString()}:${accountNumber.toString()}`,
    steamId3: `[U:1:${steam32.toString()}]`,
    steamId32: steam32.toString(),
    steamId64,
  };
}

export function getSteamProfileLinks(steamId64: string) {
  return {
    community: `https://steamcommunity.com/profiles/${steamId64}`,
    steamRep: `https://steamrep.com/search?q=${steamId64}`,
    steamRepCn: `https://steamrepcn.com/profiles/${steamId64}`,
    steamDb: `https://steamdb.info/calculator/?player=${steamId64}`,
    steamGifts: `https://www.steamgifts.com/go/user/${steamId64}`,
    steamTrades: `https://www.steamtrades.com/user/${steamId64}`,
    achievementStats: `https://www.achievementstats.com/index.php?action=profile&playerId=${steamId64}`,
    backpackTf: `https://backpack.tf/profiles/${steamId64}`,
  };
}

export async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}
