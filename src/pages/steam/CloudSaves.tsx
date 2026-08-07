import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { showToast } from "../../components/Notification";
import Button from "../../components/ui/Button";
import GlassCard from "../../components/ui/GlassCard";
import Icon from "../../components/ui/Icon";
import Select from "../../components/ui/Select";
import { createRouteSessionCache, routeCacheKey } from "../../lib/routeSessionCache";
import { useRouteCachedLoader } from "../../hooks/useRouteCachedLoader";

interface CloudFile {
  filename: string;
  size: number;
  timestamp: number;
  url: string | null;
  shaFile?: string | null;
}

interface CloudQuota {
  totalBytes: number;
  usedBytes: number;
}

interface LocalGame {
  appId: number;
  name: string | null;
  isInstalled: boolean;
}

interface CloudSavesData {
  files: CloudFile[];
  quota: CloudQuota | null;
}

const cloudSavesGamesCache = createRouteSessionCache<LocalGame[]>();
const cloudSavesDataCache = createRouteSessionCache<CloudSavesData>();
const cloudSavesErrorToastDedup = new Map<string, number>();
const cloudSavesUiSession = {
  appId: "",
  selectedGame: null as LocalGame | null,
};

function fmtBytes(b: number): string {
  if (b <= 0) return "0 B";
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}

function fmtDate(ts: number): string {
  if (!ts || ts <= 0) return "—";
  const value = ts > 1_000_000_000_000 ? ts : ts * 1000;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

export default function CloudSaves() {
  const { t } = useTranslation();

  const showCloudErrorToast = useCallback((message: string) => {
    const now = Date.now();
    const lastAt = cloudSavesErrorToastDedup.get(message) ?? 0;
    if (now - lastAt < 1500) return;
    cloudSavesErrorToastDedup.set(message, now);
    showToast("error", message);
  }, []);
  const [searchParams] = useSearchParams();
  const initialAppId = searchParams.get("appId") || cloudSavesUiSession.appId || "";
  const [appId, setAppId] = useState(initialAppId);
  const [selectedGame, setSelectedGame] = useState<LocalGame | null>(cloudSavesUiSession.selectedGame);

  const loadCloudGames = useCallback(async () => {
    const gs = await invoke<LocalGame[]>("get_local_steam_games");
    return gs.filter((g) => g.isInstalled);
  }, []);

  const { data: games = [] } = useRouteCachedLoader<LocalGame[]>({
    cache: cloudSavesGamesCache,
    key: routeCacheKey("cloud-saves-games", { installed: true }),
    load: loadCloudGames,
    onError: () => {},
  });

  const loadCloudData = useCallback(async () => {
    const id = parseInt(appId, 10);
    if (!id) {
      return { files: [], quota: null };
    }

    const [files, quota] = await Promise.all([
      invoke<CloudFile[]>("get_local_cloud_files", { appId: id }),
      invoke<CloudQuota>("get_local_cloud_quota", { appId: id }).catch(() => null),
    ]);
    return { files, quota };
  }, [appId]);

  const handleCloudDataError = useCallback((e: unknown) => {
    const message = String(e);
    const mapped = message === "STEAM_CLOUD_STEAM_NOT_RUNNING"
      ? t("steam.cloudSteamNotRunning")
      : message === "STEAM_CLOUD_CONNECT_FAILED"
        ? t("steam.cloudConnectFailed")
        : message === "STEAM_CLOUD_NOT_SUPPORTED"
          ? t("steam.cloudNotSupported")
          : message === "STEAM_CLOUD_UNAVAILABLE"
            ? t("steam.cloudUnavailable")
            : message === "STEAM_CLOUD_READ_FAILED"
              ? t("steam.cloudReadFailed")
              : message === "STEAM_CLOUD_WRITE_FAILED"
                ? t("steam.cloudWriteFailed")
                : message === "STEAM_CLOUD_DELETE_FAILED"
                  ? t("steam.cloudDeleteFailed")
                  : message;
    showCloudErrorToast(mapped);
  }, [showCloudErrorToast, t]);

  const dataKey = useMemo(
    () => routeCacheKey("cloud-saves-data", { appId }),
    [appId],
  );

  const {
    data,
    loading,
    refresh,
  } = useRouteCachedLoader<CloudSavesData>({
    cache: cloudSavesDataCache,
    key: dataKey,
    enabled: !!appId,
    load: loadCloudData,
    onError: handleCloudDataError,
  });

  const files = data?.files || [];
  const quota = data?.quota ?? null;

  useEffect(() => {
    const idFromUrl = searchParams.get("appId");
    if (idFromUrl && idFromUrl !== appId) {
      setAppId(idFromUrl);
      cloudSavesUiSession.appId = idFromUrl;
    }
  }, [searchParams, appId]);

  useEffect(() => {
    if (!appId) {
      setSelectedGame(null);
      cloudSavesUiSession.selectedGame = null;
      return;
    }
    const game = games.find((g) => g.appId === parseInt(appId, 10)) || null;
    setSelectedGame(game);
    cloudSavesUiSession.selectedGame = game;
  }, [games, appId]);

  const handleGameSelect = (id: string) => {
    setAppId(id);
    cloudSavesUiSession.appId = id;
  };

  const handleDownload = async (filename: string) => {
    try {
      const filePath = await save({
        defaultPath: filename,
      });
      if (!filePath) return;

      const b64: string = await invoke("read_local_cloud_file", { appId: parseInt(appId, 10), filename });
      await invoke("write_binary_file", { path: filePath, dataBase64: b64 });
      showToast("success", `${filename} ${t("steam.download") || "downloaded"}`);
    } catch (e: any) {
      showToast("error", String(e));
    }
  };

  const handleDelete = async (filename: string) => {
    if (!window.confirm(`${t("steam.confirmDelete") || "Delete"} ${filename}?`)) return;
    try {
      await invoke("delete_local_cloud_file", { appId: parseInt(appId, 10), filename });
      showToast("success", `${filename} ${t("steam.deleted") || "deleted"}`);
      await refresh({ force: true, keepVisible: true });
    } catch (e: any) {
      showToast("error", String(e));
    }
  };

  const handleUpload = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const b64 = btoa(binary);
        await invoke("write_local_cloud_file", {
          appId: parseInt(appId, 10),
          filename: file.name,
          dataBase64: b64,
        });
        showToast("success", `${file.name} uploaded`);
        await refresh({ force: true, keepVisible: true });
      } catch (e: any) {
        showToast("error", String(e));
      }
    };
    input.click();
  };

  const hasData = files.length > 0;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{t("steam.cloudSaves")}</h1>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <Select
          name="cloud-game"
          value={appId}
          onChange={handleGameSelect}
          className="min-w-[200px]"
          options={[
            { value: "", label: `— ${t("steam.selectGame") || "Select a game"} —` },
            ...games.map((g) => ({ value: String(g.appId), label: g.name || `App ${g.appId}` })),
          ]}
        />

        <Button variant="outline" size="sm" onClick={handleUpload} disabled={!appId}>
          <Icon name="upload" size={16} className="mr-1 align-text-bottom text-foreground dark:text-white/85" /> {t("steam.upload") || "Upload"}
        </Button>
      </div>

      {quota && quota.totalBytes > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{fmtBytes(quota.usedBytes)} / {fmtBytes(quota.totalBytes)}</span>
            <span>{quota.totalBytes > 0 ? ((quota.usedBytes / quota.totalBytes) * 100).toFixed(1) : 0}%</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${quota.totalBytes > 0 ? Math.min((quota.usedBytes / quota.totalBytes) * 100, 100) : 0}%` }}
            />
          </div>
        </div>
      )}

      {loading && <div className="text-muted-foreground text-sm py-8 text-center">{t("games.loading")}</div>}

      {!loading && (
        <>
          {!hasData && appId && (
            <GlassCard className="text-center py-12 rounded-xl text-muted-foreground">
              <Icon name="cloud" size={32} className="mx-auto mb-2 text-muted-foreground" />
              <div>No cloud save files found for {selectedGame?.name || `App ${appId}`}</div>
            </GlassCard>
          )}

          <div className="space-y-1">
            {files.map((f) => (
              <GlassCard key={f.filename} className="flex items-center gap-3 p-2.5 rounded-lg hover:border-primary/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{f.filename}</div>
                  <div className="text-xs text-muted-foreground flex gap-3">
                    <span>{fmtBytes(f.size)}</span>
                    <span>{fmtDate(f.timestamp)}</span>
                    {f.shaFile && <span className="font-mono text-[10px] truncate max-w-[120px]">SHA: {f.shaFile.substring(0, 8)}</span>}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(f.filename)}
                  className="h-8 w-8 flex-shrink-0 px-0"
                  title={t("steam.download")}
                  aria-label={t("steam.download")}
                >
                  <Icon name="cloudDownload" size={14} className="text-foreground dark:text-white/85" />
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(f.filename)}
                  className="h-8 w-8 flex-shrink-0 px-0"
                  title={t("steam.confirmDelete") || "Delete"}
                  aria-label={t("steam.confirmDelete") || "Delete"}
                  ripple={false}
                >
                  <Icon name="trash" size={14} className="text-current" />
                </Button>
              </GlassCard>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
