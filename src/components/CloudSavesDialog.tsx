import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";
import Button from "./ui/Button";
import GlassCard from "./ui/GlassCard";
import Icon from "./ui/Icon";
import { GlassFloating } from "./ui/GlassSurface";
import { createRouteSessionCache, routeCacheKey } from "../lib/routeSessionCache";
import { useRouteCachedLoader } from "../hooks/useRouteCachedLoader";
import { showToast } from "./Notification";

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

interface CloudSavesData {
  files: CloudFile[];
  quota: CloudQuota | null;
}

interface CloudSavesDialogProps {
  open: boolean;
  appId: number | null;
  gameName?: string | null;
  onClose: () => void;
}

const cloudSavesDialogCache = createRouteSessionCache<CloudSavesData>();
const cloudSavesErrorToastDedup = new Map<string, number>();

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

export default function CloudSavesDialog({
  open,
  appId,
  gameName,
  onClose,
}: CloudSavesDialogProps) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      const timer = setTimeout(() => setMounted(false), 180);
      return () => clearTimeout(timer);
    }
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mounted]);

  const dataKey = useMemo(
    () => routeCacheKey("cloud-saves-dialog-data", { appId }),
    [appId],
  );

  const loadCloudData = useCallback(async () => {
    if (appId == null) {
      return { files: [], quota: null };
    }

    const [files, quota] = await Promise.all([
      invoke<CloudFile[]>("get_local_cloud_files", { appId }),
      invoke<CloudQuota>("get_local_cloud_quota", { appId }).catch(() => null),
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
    const now = Date.now();
    const lastAt = cloudSavesErrorToastDedup.get(mapped) ?? 0;
    if (now - lastAt < 1500) return;
    cloudSavesErrorToastDedup.set(mapped, now);
    showToast("error", mapped);
  }, [t]);

  const {
    data,
    loading,
    refresh,
  } = useRouteCachedLoader<CloudSavesData>({
    cache: cloudSavesDialogCache,
    key: dataKey,
    enabled: open && appId != null,
    load: loadCloudData,
    onError: handleCloudDataError,
  });

  const files = data?.files || [];
  const quota = data?.quota ?? null;
  const resolvedName = gameName || (appId != null ? `App ${appId}` : "");

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => onClose(), 150);
  };

  const handleDownload = async (filename: string) => {
    if (appId == null) return;
    try {
      const filePath = await save({
        defaultPath: filename,
      });
      if (!filePath) return;

      const b64: string = await invoke("read_local_cloud_file", { appId, filename });
      await invoke("write_binary_file", { path: filePath, dataBase64: b64 });
      showToast("success", `${filename} ${t("steam.download") || "downloaded"}`);
    } catch (e: any) {
      showToast("error", String(e));
    }
  };

  const handleDelete = async (filename: string) => {
    if (appId == null) return;
    if (!window.confirm(`${t("steam.confirmDelete") || "Delete"} ${filename}?`)) return;
    try {
      await invoke("delete_local_cloud_file", { appId, filename });
      showToast("success", `${filename} ${t("steam.deleted") || "deleted"}`);
      await refresh({ force: true, keepVisible: true });
    } catch (e: any) {
      showToast("error", String(e));
    }
  };

  const handleUpload = async () => {
    if (appId == null) return;
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
          appId,
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

  if (!mounted || appId == null) return null;

  const dialog = (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center px-4 py-6 soft-backdrop ${
        closing ? "animate-fade-out" : "animate-fade-in"
      }`}
      onClick={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <GlassFloating
        className={`relative flex w-[min(1100px,calc(100vw-32px))] max-h-[88vh] flex-col overflow-hidden rounded-[24px] p-0 shadow-[20px_20px_30px_rgba(0,0,0,0.068)] ${
          closing ? "animate-fade-out" : "animate-scale-in"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
          aria-label={t("common.close", { defaultValue: "关闭" })}
        >
          <Icon name="close" size={18} className="text-current" />
        </button>

        <div className="border-b border-border/60 px-5 py-4 pr-16">
          <div className="space-y-3">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">{t("steam.cloudSaves")}</div>
              <div className="mt-1 flex min-w-0 items-center gap-2">
                <Icon name="cloud" size={18} className="text-primary" />
                <h2 className="truncate text-lg font-semibold">{resolvedName}</h2>
                <span className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                  App {appId}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={handleUpload}>
                <Icon name="upload" size={14} className="mr-1" /> {t("steam.upload") || "Upload"}
              </Button>
            </div>
          </div>
        </div>

        <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">
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

          {loading ? (
            <div className="animate-fade-in space-y-4">
              <GlassCard className="rounded-2xl p-4">
                <div className="flex gap-4">
                  <div className="hidden h-28 w-20 rounded-xl bg-secondary/40 sm:block" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 w-24 rounded bg-secondary/30" />
                    <div className="h-7 w-48 rounded bg-secondary/40" />
                    <div className="h-5 w-20 rounded-full bg-secondary/30" />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="rounded-xl bg-secondary/20 p-4">
                      <div className="h-3 w-20 rounded bg-secondary/30" />
                      <div className="mt-2 h-7 w-24 rounded bg-secondary/40" />
                    </div>
                  ))}
                </div>
              </GlassCard>
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <GlassCard key={index} className="flex items-center gap-3 rounded-xl p-3">
                    <div className="h-16 w-16 rounded-lg bg-secondary/40" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-4 w-40 rounded bg-secondary/40" />
                      <div className="h-3 w-64 rounded bg-secondary/30" />
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {files.length === 0 ? (
                <GlassCard className="text-center py-12 rounded-xl text-muted-foreground">
                  <Icon name="cloud" size={32} className="mx-auto mb-2 text-muted-foreground" />
                  <div>No cloud save files found for {resolvedName}</div>
                </GlassCard>
              ) : (
                files.map((file) => (
                  <GlassCard key={file.filename} className="flex items-center gap-3 p-2.5 rounded-lg hover:border-primary/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{file.filename}</div>
                      <div className="text-xs text-muted-foreground flex gap-3">
                        <span>{fmtBytes(file.size)}</span>
                        <span>{fmtDate(file.timestamp)}</span>
                        {file.shaFile && <span className="font-mono text-[10px] truncate max-w-[120px]">SHA: {file.shaFile.substring(0, 8)}</span>}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(file.filename)}
                      className="h-8 w-8 flex-shrink-0 px-0"
                      title={t("steam.download")}
                      aria-label={t("steam.download")}
                    >
                      <Icon name="cloudDownload" size={14} className="text-foreground dark:text-white/85" />
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(file.filename)}
                      className="h-8 w-8 flex-shrink-0 px-0"
                      title={t("steam.confirmDelete") || "Delete"}
                      aria-label={t("steam.confirmDelete") || "Delete"}
                      ripple={false}
                    >
                      <Icon name="trash" size={14} className="text-current" />
                    </Button>
                  </GlassCard>
                ))
              )}
            </div>
          )}
        </div>
      </GlassFloating>
    </div>
  );

  return createPortal(dialog, document.body);
}
