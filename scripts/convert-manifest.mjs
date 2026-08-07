/**
 * Ludusavi manifest → Doona games.db.json converter (using js-yaml).
 *
 * Usage:
 *   node scripts/convert-manifest.mjs > data/games.db.json
 *   node scripts/convert-manifest.mjs /path/to/manifest.yaml > data/games.db.json
 */

import fs from "fs";
import { load as yamlLoad } from "js-yaml";

// ── Popular game IDs (derived from manual overrides + extra) ──
const MANUAL_OVERRIDES = {
  // Steam App ID → verified Windows save path
  730:    "%LOCALAPPDATA%\\CS2\\cfg",
  570:    "%LOCALAPPDATA%\\Dota 2 Beta\\cfg",
  578080: "%LOCALAPPDATA%\\TslGame\\Saved\\Config",
  271590: "%USERPROFILE%\\Documents\\Rockstar Games\\GTA V\\Profiles",
  1172470:"%USERPROFILE%\\Saved Games\\Respawn\\Apex\\profile",
  1091500:"%USERPROFILE%\\Saved Games\\CD Projekt Red\\Cyberpunk 2077",
  292030: "%USERPROFILE%\\Documents\\The Witcher 3\\gamesaves",
  1245620:"%APPDATA%\\EldenRing",
  1086940:"%LOCALAPPDATA%\\Larian Studios\\Baldur's Gate 3\\PlayerProfiles",
  1174180:"%USERPROFILE%\\Documents\\Rockstar Games\\Red Dead Redemption 2\\Profiles",
  252490: "%USERPROFILE%\\Documents\\My Games\\Rust",
  377160: "%USERPROFILE%\\Documents\\My Games\\Fallout4\\Saves",
  359550: "%USERPROFILE%\\Documents\\My Games\\Rainbow Six - Siege",
  252950: "%USERPROFILE%\\Documents\\My Games\\Rocket League\\TAGame\\SaveData",
  413150: "%APPDATA%\\StardewValley\\Saves",
  1145360:"%USERPROFILE%\\Documents\\Saved Games\\Hades",
  289070: "%USERPROFILE%\\Documents\\My Games\\Sid Meier's Civilization VI\\Saves",
  582010: "%USERPROFILE%\\Documents\\My Games\\Monster Hunter World",
  646570: "%USERPROFILE%\\Documents\\SlayTheSpire",
  367520: "%APPDATA%\\..\\LocalLow\\Team Cherry\\Hollow Knight",
  489830: "%USERPROFILE%\\Documents\\My Games\\Skyrim Special Edition\\Saves",
  294100: "%APPDATA%\\..\\LocalLow\\Ludeon Studios\\RimWorld by Ludeon Studios\\Saves",
  374320: "%APPDATA%\\DarkSoulsIII",
  814380: "%APPDATA%\\Sekiro",
  381210: "%APPDATA%\\..\\Local\\DeadByDaylight\\Saved\\Config",
  275850: "%APPDATA%\\HelloGames\\NMS",
  236850: "%USERPROFILE%\\Documents\\Paradox Interactive\\Europa Universalis IV\\save games",
  281990: "%USERPROFILE%\\Documents\\Paradox Interactive\\Stellaris\\save games",
  346110: "%LOCALAPPDATA%\\..\\Local\\ARKSurvivalEvolved\\Saved\\SaveGames",
  105600: "%USERPROFILE%\\Documents\\My Games\\Terraria\\Players",
  230410: "%LOCALAPPDATA%\\Warframe",
  1085660:"%APPDATA%\\Bungie\\DestinyPC\\prefs",
  1446780:"%USERPROFILE%\\Documents\\My Games\\Monster Hunter Rise",
  1151640:"%USERPROFILE%\\Documents\\Horizon Zero Dawn\\Saved Game",
  261550: "%USERPROFILE%\\Documents\\Mount and Blade II Bannerlord\\Game Saves",
  1172380:"%USERPROFILE%\\Documents\\My Games\\FINAL FANTASY VII REMAKE\\EOS",
  440900: "%LOCALAPPDATA%\\ConanSandbox\\Saved\\SaveGames",
  264710: "%USERPROFILE%\\Documents\\My Games\\Subnautica\\saved",
  892970: "%APPDATA%\\..\\LocalLow\\IronGate\\Valheim\\worlds_local",
  427520: "%APPDATA%\\Factorio\\saves",
  526870: "%LOCALAPPDATA%\\FactoryGame\\Saved\\SaveGames",
  1623730:"%LOCALAPPDATA%\\Pal\\Saved\\SaveGames",
  1794680:"%APPDATA%\\Vampire_Survivors\\saves",
  2379780:"%APPDATA%\\Balatro",
  1313140:"%APPDATA%\\..\\LocalLow\\Massive Monster\\Cult Of The Lamb\\saves",
  1604030:"%APPDATA%\\..\\LocalLow\\Stunlock Studios\\VRising\\Saves",
  1142710:"%APPDATA%\\The Creative Assembly\\Warhammer3\\save_games",
  1229490:"%APPDATA%\\..\\LocalLow\\Arsi Hakita Patala\\ULTRAKILL\\Saves",
  553420: "%APPDATA%\\..\\LocalLow\\Andrew Shouldice\\TUNIC\\SaveData",
  1332010:"%APPDATA%\\..\\LocalLow\\BlueTwelve Studio\\Stray\\SaveGames",
  1092790:"%APPDATA%\\..\\LocalLow\\Daniel Mullins Games\\Inscryption",
  268910: "%APPDATA%\\Cuphead",
  1057090:"%APPDATA%\\..\\Local\\Ori and the Will of The Wisps",
  774361: "%APPDATA%\\..\\LocalLow\\TheGameKitchen\\Blasphemous\\Saves",
  1657630:"%APPDATA%\\..\\LocalLow\\Monomi Park\\Slime Rancher 2",
  1966720:"%APPDATA%\\..\\LocalLow\\ZeekerssRBLX\\Lethal Company\\saves",
  739630: "%APPDATA%\\..\\LocalLow\\Kinetic Games\\Phasmophobia\\Save",
  108600: "%USERPROFILE%\\Zomboid\\Saves",
  1551360:"%LOCALAPPDATA%\\ForzaHorizon5\\User_Steam",
  534380: "%USERPROFILE%\\Documents\\Dying Light 2\\out\\save",
  311690: "%APPDATA%\\..\\LocalLow\\Dodge Roll\\Enter the Gungeon",
  504230: "%APPDATA%\\..\\LocalLow\\Matt Makes Games\\Celeste\\Saves",
  588650: "%USERPROFILE%\\Documents\\Dead Cells\\save",
  632360: "%USERPROFILE%\\Documents\\My Games\\Risk of Rain 2\\Save",
  548430: "%LOCALAPPDATA%\\..\\Local\\FSD\\Saved\\SaveGames",
  962130: "%APPDATA%\\..\\Local\\Maine\\Saved\\SaveGames",
  648800: "%APPDATA%\\..\\LocalLow\\Redbeet Interactive\\Raft\\User",
  1326470:"%APPDATA%\\..\\LocalLow\\Endnight\\SonsOfTheForest\\Saves",
  242760: "%APPDATA%\\..\\LocalLow\\SKS\\TheForest",
  220:     "%LOCALAPPDATA%\\Half-Life 2\\SAVE",
  620:     "%LOCALAPPDATA%\\Portal 2\\SAVE",
  4000:    "%LOCALAPPDATA%\\GarrysMod\\garrysmod\\saves",
  323190: "%USERPROFILE%\\Documents\\My Games\\Frostpunk\\Saves",
  457140: "%USERPROFILE%\\Documents\\Klei\\OxygenNotIncluded\\save_files",
  975370: "%USERPROFILE%\\Documents\\My Games\\Dwarf Fortress\\save",
  322330: "%USERPROFILE%\\Documents\\Klei\\DoNotStarveTogether",
  255710: "%APPDATA%\\..\\Local\\Colossal Order\\Cities_Skylines\\Saves",
  949230: "%APPDATA%\\..\\LocalLow\\Colossal Order\\Cities Skylines II\\Saves",
  238960: "%USERPROFILE%\\Documents\\My Games\\Path of Exile",
  2344520:"%USERPROFILE%\\Documents\\Diablo IV\\LocalPrefs",
  1817230:"%LOCALAPPDATA%\\HiFiRush\\Saved\\SaveGames",
  990080: "%APPDATA%\\..\\Local\\Hogwarts Legacy\\Saved\\SaveGames",
  2050650:"%USERPROFILE%\\Documents\\My Games\\RE4\\Steam",
  782330: "%USERPROFILE%\\Saved Games\\id Software\\DOOMEternal\\base\\savegame",
  1716740:"%USERPROFILE%\\Documents\\My Games\\Starfield\\Saves",
  1259420:"%APPDATA%\\..\\Local\\BendGame\\Saved\\SaveGames",
  1817070:"%USERPROFILE%\\Documents\\Marvel's Spider-Man Remastered",
  1593500:"%USERPROFILE%\\Saved Games\\God of War",
  1462040:"%USERPROFILE%\\Documents\\My Games\\FINAL FANTASY VII REMAKE\\EOS",
  1687950:"%APPDATA%\\SEGA\\P5R\\Steam",
  1113000:"%USERPROFILE%\\Documents\\My Games\\Persona 4 Golden",
  632470: "%APPDATA%\\..\\LocalLow\\ZAUM Studio\\Disco Elysium\\SaveGames",
  435150: "%USERPROFILE%\\Documents\\Larian Studios\\Divinity Original Sin 2\\PlayerProfiles",
  268500: "%USERPROFILE%\\Documents\\My Games\\XCOM2\\XComGame\\SaveData",
  394360: "%USERPROFILE%\\Documents\\Paradox Interactive\\Hearts of Iron IV\\save games",
  1158310:"%USERPROFILE%\\Documents\\Paradox Interactive\\Crusader Kings III\\save games",
  250900: "%USERPROFILE%\\Documents\\My Games\\Binding of Isaac Repentance+",
  379430: "%USERPROFILE%\\Documents\\My Games\\KingdomCome\\saves",
  412020: "%USERPROFILE%\\Saved Games\\Metro Exodus",
  1850570:"%APPDATA%\\..\\Local\\KojimaProductions\\DeathStrandingDC",
  870780: "%USERPROFILE%\\Documents\\My Games\\Control\\Saves",
  753640: "%APPDATA%\\..\\LocalLow\\Mobius Digital\\Outer Wilds\\Saves",
  1562430:"%APPDATA%\\..\\LocalLow\\Black Salt Games\\DREDGE\\saves",
  1868140:"%APPDATA%\\..\\LocalLow\\MINTROCKET\\DAVE THE DIVER",
  1325200:"%USERPROFILE%\\Documents\\KoeiTecmo\\NIOH2\\Savedata",
  1627720:"%APPDATA%\\Lies of P\\SaveGames",
  552500: "%USERPROFILE%\\Documents\\My Games\\Far Cry 5\\SaveGames",
  594650: "%USERPROFILE%\\Documents\\My Games\\Hunt Showdown\\profiles",
  644930: "%USERPROFILE%\\Documents\\My Games\\They Are Billions\\Saves",
  1466860:"%USERPROFILE%\\Documents\\My Games\\Age of Empires IV",
  447040: "%USERPROFILE%\\Documents\\My Games\\Watch Dogs 2\\SaveGames",
  812140: "%USERPROFILE%\\Documents\\Assassin's Creed Odyssey\\saves",
  1938090:"%LOCALAPPDATA%\\..\\Saved Games\\Respawn\\JediSurvivor",
  221100: "%USERPROFILE%\\Documents\\DayZ",
  227300: "%USERPROFILE%\\Documents\\Euro Truck Simulator 2\\profiles",
  233450: "%USERPROFILE%\\Documents\\My Games\\FarmingSimulator2022\\savegame1",
  244210: "%USERPROFILE%\\Documents\\Assetto Corsa Competizione\\Config",
  285900: "%APPDATA%\\DarkSoulsRemastered",
  314710: "%LOCALAPPDATA%\\M&B Bannerlord\\Configs",
  319630: "%APPDATA%\\Wargaming.net\\World of Warships",
  327860: "%USERPROFILE%\\Documents\\Klei\\OxygenNotIncluded",
  355840: "%USERPROFILE%\\Saved Games\\Frontier Developments\\Planet Coaster",
  357600: "%USERPROFILE%\\Documents\\My Games\\NieR_Automata",
  386360: "%USERPROFILE%\\Documents\\BioWare\\Mass Effect Legendary Edition\\Save",
  388080: "%USERPROFILE%\\Documents\\My Games\\Borderlands 3\\Saved\\SaveGames",
  397540: "%USERPROFILE%\\Documents\\My Games\\Borderlands 3",
  431960: "%APPDATA%\\..\\LocalLow\\Wishfully\\Planet of Lana",
  440650: "%USERPROFILE%\\Documents\\My Games\\Tales of Arise\\SaveData",
  448890: "%APPDATA%\\DarkSoulsII",
  460870: "%APPDATA%\\..\\LocalLow\\Team17\\HokkoLife",
  477160: "%USERPROFILE%\\Documents\\My Games\\Pathfinder Kingmaker\\Saved Games",
  493520: "%USERPROFILE%\\Documents\\Electronic Arts\\The Sims 4\\saves",
  510510: "%APPDATA%\\DBOG\\Saved Games",
  534380: "%USERPROFILE%\\Documents\\Dying Light 2\\out\\save",
  551670: "%LOCALAPPDATA%\\Tower of Fantasy\\Saved",
  565410: "%APPDATA%\\..\\LocalLow\\Good Shepherd Entertainment\\Hard West 2",
  582660: "%USERPROFILE%\\Documents\\My Games\\It Takes Two",
  594570: "%USERPROFILE%\\Documents\\BioWare\\Dragon Age Inquisition\\Save",
  620980: "%APPDATA%\\Steam\\CODEX",
  632470: "%APPDATA%\\..\\LocalLow\\ZAUM Studio\\Disco Elysium\\SaveGames",
  646910: "%USERPROFILE%\\Saved Games\\Frontier Developments\\Planet Zoo",
  674940: "%USERPROFILE%\\Documents\\Rockstar Games\\Red Dead Redemption 2\\Profiles",
  703080: "%APPDATA%\\..\\LocalLow\\Innersloth\\Among Us",
  728880: "%USERPROFILE%\\Saved Games\\Frontier Developments\\Jurassic World Evolution 2",
  739630: "%APPDATA%\\..\\LocalLow\\Kinetic Games\\Phasmophobia\\Save",
  745940: "%USERPROFILE%\\Documents\\My Games\\MechWarrior 5 Mercenaries\\Saved\\SaveGames",
  753640: "%APPDATA%\\..\\LocalLow\\Mobius Digital\\Outer Wilds\\Saves",
  774361: "%APPDATA%\\..\\LocalLow\\TheGameKitchen\\Blasphemous\\Saves",
  782330: "%USERPROFILE%\\Saved Games\\id Software\\DOOMEternal\\base\\savegame",
  798460: "%APPDATA%\\..\\LocalLow\\Wizards of the Coast\\Magic The Gathering Arena",
  814380: "%APPDATA%\\Sekiro",
  832580: "%USERPROFILE%\\Documents\\My Games\\Wolfenstein Youngblood\\Saved Games",
  848350: "%USERPROFILE%\\Saved Games\\Frontier Developments\\Elite Dangerous",
  870780: "%USERPROFILE%\\Documents\\My Games\\Control\\Saves",
  883710: "%APPDATA%\\..\\LocalLow\\Muse Games\\Guns of Icarus Alliance",
  894940: "%APPDATA%\\..\\LocalLow\\IronGate\\Valheim",
  916440: "%USERPROFILE%\\Documents\\My Games\\SnowRunner\\base\\storage",
  924980: "%APPDATA%\\..\\LocalLow\\Redbeet Interactive\\Raft\\User",
  944590: "%USERPROFILE%\\Documents\\My Games\\STAR WARS Battlefront II\\settings",
  960910: "%USERPROFILE%\\Saved Games\\Frontier Developments\\Planet Coaster",
  974720: "%APPDATA%\\..\\LocalLow\\Monomi Park\\Slime Rancher 2",
  990080: "%APPDATA%\\..\\Local\\Hogwarts Legacy\\Saved\\SaveGames",
};

// Steam API-based game name lookup (for manifest entries without clear names)
function toId(name) {
  // Keep letters, digits, CJK characters, and replace everything else with "-"
  return name
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿㐀-䶿]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 64) || name.replace(/\s+/g, "-").substring(0, 64);
}

// ── Main ──

const LUDUSAVI_TO_DOONA = [
  ["<winAppData>", "%APPDATA%"],
  ["<winLocalAppData>", "%LOCALAPPDATA%"],
  ["<winDocuments>", "%USERPROFILE%/Documents"],
  ["<savedGames>", "%USERPROFILE%/Saved Games"],
  ["<userProfile>", "%USERPROFILE%"],
  ["<home>", "%USERPROFILE%"],
  ["<base>", "."],
];

function convertPath(path) {
  let r = path;
  for (const [f, t] of LUDUSAVI_TO_DOONA) r = r.split(f).join(t);
  r = r.replace(/\/\*+\.[a-zA-Z]+$/g, "");
  r = r.replace(/\/\*\*\/\*.*$/, "");
  // Normalize to Windows backslash
  r = r.replace(/\//g, "\\");
  return r;
}

function isWindowsPath(path) {
  return ["<winAppData>", "<winLocalAppData>", "<winDocuments>", "<savedGames>", "<userProfile>", "<home>", "<base>"].some((m) => path.includes(m));
}

function extractPath(files) {
  if (!files || typeof files !== "object") return null;
  const candidates = [];
  for (const [raw, meta] of Object.entries(files)) {
    if (typeof meta !== "object" || meta === null) continue;
    const whens = Array.isArray(meta.when) ? meta.when : meta.when ? [meta.when] : [];
    const tags = Array.isArray(meta.tags) ? meta.tags : meta.tags ? [meta.tags] : [];
    if (tags.length > 0 && !tags.includes("save")) continue;
    if (whens.length > 0) {
      if (!whens.some((w) => w && w.os === "windows")) continue;
      if (whens.some((w) => w && w.store) && !whens.some((w) => w && w.store === "steam")) continue;
    }
    if (!isWindowsPath(raw)) continue;
    candidates.push({ path: convertPath(raw), isBase: raw.startsWith("<base>") });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (a.isBase ? 1 : 0) - (b.isBase ? 1 : 0));
  return candidates[0].path;
}

const inputPath = process.argv[2] || null;

async function main() {
  let yamlText;
  if (inputPath) {
    console.error("Reading local manifest:", inputPath);
    yamlText = fs.readFileSync(inputPath, "utf8");
  } else {
    console.error("Fetching from GitHub...");
    const res = await fetch(
      "https://api.github.com/repos/mtkennerly/ludusavi-manifest/contents/data/manifest.yaml",
      { headers: { Accept: "application/vnd.github.v3.raw", "User-Agent": "Doona/2.0" } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    yamlText = await res.text();
  }

  console.error("Parsing YAML...");
  const manifest = yamlLoad(yamlText);

  const games = [];
  const seenIds = new Set();

  // First pass: manual overrides for popular games
  for (const [name, entry] of Object.entries(manifest)) {
    if (!entry?.steam?.id) continue;
    const sid = entry.steam.id;
    if (MANUAL_OVERRIDES[sid] && !seenIds.has(sid)) {
      games.push({
        id: toId(name),
        name,
        platforms: ["steam"],
        steam_app_id: sid,
        save_path: MANUAL_OVERRIDES[sid],
        notes: "",
      });
      seenIds.add(sid);
    }
  }

  // Second pass: fill remaining from manifest
  const remaining = [];
  for (const [name, entry] of Object.entries(manifest)) {
    if (!entry?.steam?.id) continue;
    const sid = entry.steam.id;
    if (seenIds.has(sid)) continue;
    const path = extractPath(entry.files);
    if (!path) continue;
    remaining.push({
      id: toId(name),
      name,
      platforms: ["steam"],
      steam_app_id: sid,
      save_path: path,
      notes: "",
    });
  }

  // Sort remaining alphabetically
  remaining.sort((a, b) => a.name.localeCompare(b.name));

  // Combine: manual first, then up to 300 total
  const all = [...games, ...remaining];

  // Mark popular games (all manual overrides are popular)
  all.forEach((g) => { g.popular = g.steam_app_id in MANUAL_OVERRIDES; });
  const popularCount = all.filter((g) => g.popular).length;

  console.error(`Manual overrides: ${games.length}, From manifest: ${remaining.length}, Total: ${all.length} (${popularCount} popular)`);

  console.log(JSON.stringify({ version: 1, games: all }));
}

main().catch((err) => { console.error("Error:", err); process.exit(1); });
