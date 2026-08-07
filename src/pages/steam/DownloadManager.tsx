import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import GlassCard from "../../components/ui/GlassCard";
import Icon from "../../components/ui/Icon";

// ── Types ──────────────────────────────────────────────────────

interface DownloadingGame {
  appId: number;
  name: string | null;
  installDir: string | null;
  stateFlags: number;
  sizeOnDisk: number;
  bytesDownloaded: number;
  bytesToDownload: number;
  bytesStaged: number;
  bytesToStage: number;
}

// ── State detection (from SteamTools SteamApp.cs) ──────────────

const bit = (b: number, pos: number) => (b & (1 << pos)) !== 0;
const isAcfDownloading = (flags: number) => (bit(flags, 1) || bit(flags, 10)) && !bit(flags, 9);
const isInstalled = (flags: number) => bit(flags, 2);

// ── Formatting ──────────────────────────────────────────────────

function fmtBytes(b: number): string {
  if (b <= 0) return "0 B";
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}

function fmtEta(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

// ── Component ───────────────────────────────────────────────────

/** Speed history: dead-reckoned for 30s after last data point */
const SPEED_TTL_MS = 30_000;

interface Sample {
  bytes: number;
  time: number;
}

interface AppTrack {
  samples: Sample[];       // last 4 samples for moving-average speed
  lastChangeTime: number;  // Date.now() when bytesDownloaded last CHANGED
  lastSpeed: number;       // last calculated speed (bytes/s), kept for TTL
  speedTime: number;       // Date.now() when lastSpeed was computed
  lastEta: string;         // last calculated ETA
  etaTime: number;         // Date.now() when lastEta was computed
}

export default function DownloadManager({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useTranslation();
  const [games, setGames] = useState<DownloadingGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [speeds, setSpeeds] = useState<Map<number, number>>(new Map());
  const [etas, setEtas] = useState<Map<number, string>>(new Map());
  const trackRef = useRef<Map<number, AppTrack>>(new Map());
  const firstLoadRef = useRef(true);

  const loadData = useCallback(async () => {
    const isFirst = firstLoadRef.current;
    if (isFirst) setLoading(true);
    try {
      const list = await invoke<DownloadingGame[]>("get_downloading_games");
      setGames(list);

      const now = Date.now();
      const newSpeeds = new Map<number, number>();
      const newEtas = new Map<number, string>();
      const tracks = trackRef.current;

      for (const g of list) {
        let trk = tracks.get(g.appId);
        if (!trk) {
          trk = { samples: [], lastChangeTime: now, lastSpeed: 0, speedTime: 0, lastEta: "", etaTime: 0 };
          tracks.set(g.appId, trk);
        }

        const downloaded = g.bytesDownloaded;

        // ── Add sample, keep last 4 ──
        trk.samples.push({ bytes: downloaded, time: now });
        if (trk.samples.length > 4) trk.samples.shift();

        // Track when bytes last CHANGED (for pause/stall detection)
        const prevBytes = trk.samples.length >= 2
          ? trk.samples[trk.samples.length - 2].bytes
          : downloaded; // first sample: no change to detect
        if (downloaded !== prevBytes) {
          trk.lastChangeTime = now;
        }

        // ── Speed: moving average over last 2-4 samples ──
        const validSamples = trk.samples.filter(s => s.bytes > 0);
        if (validSamples.length >= 2) {
          const first = validSamples[0];
          const last = validSamples[validSamples.length - 1];
          const dt = (last.time - first.time) / 1000;
          const db = last.bytes - first.bytes;
          if (dt >= 1 && db > 0) {
            trk.lastSpeed = db / dt;
            trk.speedTime = now;
            // ETA
            const total = g.bytesToDownload || g.sizeOnDisk || 1;
            const remain = total > last.bytes ? total - last.bytes : 0;
            if (remain > 0 && trk.lastSpeed > 0) {
              trk.lastEta = fmtEta(remain / trk.lastSpeed);
              trk.etaTime = now;
            }
          }
        }

        // ── Emit speed/ETA if still within TTL ──
        if (trk.lastSpeed > 0 && (now - trk.speedTime) < SPEED_TTL_MS) {
          newSpeeds.set(g.appId, trk.lastSpeed);
        }
        if (trk.lastEta && (now - trk.etaTime) < SPEED_TTL_MS) {
          newEtas.set(g.appId, trk.lastEta);
        }
      }

      // Clean up tracks for removed apps
      const activeIds = new Set(list.map(g => g.appId));
      for (const id of tracks.keys()) {
        if (!activeIds.has(id)) tracks.delete(id);
      }

      setSpeeds(newSpeeds);
      setEtas(newEtas);
    } catch (_e: any) {
      // silent on refresh
    } finally {
      if (isFirst) {
        setLoading(false);
        firstLoadRef.current = false;
      }
    }
  }, []);

  const hasActiveDownloads = games.some((g) => !isInstalled(g.stateFlags));

  useEffect(() => {
    loadData();
    // Poll fast while downloads are running; drop to a slow heartbeat when
    // idle so we do not hammer the ACF scan (and IPC) for nothing.
    const interval = setInterval(loadData, hasActiveDownloads ? 2000 : 30_000);
    return () => clearInterval(interval);
  }, [loadData, hasActiveDownloads]);

  if (loading) {
    return <div className="text-muted-foreground py-16 text-center">{t("games.loading")}</div>;
  }

  const activeGames = games.filter(g => !isInstalled(g.stateFlags));

  return (
    <div>
      {!embedded && (
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">{t("download.title") || "Downloads"}</h1>
          <span className="text-xs text-muted-foreground">
            {activeGames.length} active · {games.length - activeGames.length} complete
          </span>
        </div>
      )}

      {games.length === 0 ? (
        <GlassCard className="text-center py-16 rounded-xl text-muted-foreground">
          <div className="flex justify-center mb-2">
            <Icon name="download" size={48} className="text-foreground dark:text-white/85" />
          </div>
          {t("download.empty") || "No downloads"}
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {games.map((game) => {
            const downloaded = game.bytesDownloaded;
            const total = game.bytesToDownload || game.sizeOnDisk || 1;
            const pct = total > 0 ? Math.min((downloaded / total) * 100, 100) : 0;

            // ── State: ACF bits + byte-stall detection ──
            const acfDownloading = isAcfDownloading(game.stateFlags);
            const acfInstalled = isInstalled(game.stateFlags);

            // Byte-stall check: if ACF says downloading but bytesDownloaded
            // hasn't changed in 6+ seconds, Steam paused (even if bit 9 not yet set).
            const trk = trackRef.current.get(game.appId);
            const stallSeconds = trk
              ? (Date.now() - trk.lastChangeTime) / 1000
              : 0;
            const bytesChanged = trk && trk.samples.length >= 2
              && trk.samples[trk.samples.length - 1].bytes !== trk.samples[trk.samples.length - 2].bytes;
            const bytesStalled = acfDownloading && !acfInstalled && !bytesChanged && stallSeconds >= 6;

            let statusText: string;
            let statusColor: string;
            let barColor: string;

            if (acfInstalled && !acfDownloading) {
              statusText = t("download.stateInstalled") || "Complete";
              statusColor = "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300";
              barColor = "bg-green-500";
            } else if (bytesStalled || bit(game.stateFlags, 9)) {
              // Either Steam explicitly set pause bit, OR bytes stalled for 6s+
              statusText = t("download.statePaused") || "Paused";
              statusColor = "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300";
              barColor = "bg-amber-500";
            } else if (acfDownloading) {
              statusText = t("download.stateRunning") || "Downloading";
              statusColor = "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300";
              barColor = "bg-primary";
            } else {
              statusText = t("download.stateWaiting") || "Waiting";
              statusColor = "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400";
              barColor = "bg-gray-400";
            }

            const isActive = statusText === (t("download.stateRunning") || "Downloading");
            const speed = speeds.get(game.appId) || 0;
            const eta = etas.get(game.appId) || "";

            return (
              <GlassCard key={game.appId} className="rounded-lg p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {game.appId > 0 && (
                      <img
                        src={`https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${game.appId}/header.jpg`}
                        alt="" className="w-[140px] rounded flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${game.appId}/capsule_616x353.jpg`;
                        }}
                      />
                    )}
                    <div>
                      <div className="font-semibold text-sm">{game.name || `App ${game.appId}`}</div>
                      <div className="text-xs text-muted-foreground">App {game.appId}</div>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${statusColor}`}>
                    {statusText}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                    style={{ width: `${acfInstalled ? 100 : pct}%` }}
                  />
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <div className="text-lg font-bold tabular-nums">{acfInstalled ? "100" : pct.toFixed(1)}%</div>
                    <div className="text-[10px] text-muted-foreground">Progress</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium tabular-nums">{fmtBytes(downloaded)}</div>
                    <div className="text-[10px] text-muted-foreground">/ {fmtBytes(total)}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium tabular-nums">
                      {isActive && speed > 0 ? fmtBytes(speed) + "/s" : "—"}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Speed</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium tabular-nums">
                      {isActive && eta ? eta : "—"}
                    </div>
                    <div className="text-[10px] text-muted-foreground">ETA</div>
                  </div>
                </div>

                {/* Disk info */}
                <div className="mt-2 text-[10px] text-muted-foreground flex justify-between">
                  <span>Disk: {fmtBytes(game.sizeOnDisk)}</span>
                  <span>{game.installDir && <><Icon name="folder" size={14} className="inline mr-1 align-text-bottom text-foreground dark:text-white/85" />{game.installDir}</>}</span>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
