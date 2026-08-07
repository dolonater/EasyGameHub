import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import type { GameInfo, SnapshotInfo, ZipEntryInfo } from "../lib/types";
import { formatSize, formatTimestamp } from "../lib/types";
import { showToast } from "../components/Notification";
import Button from "../components/ui/Button";
import Dialog from "../components/ui/Dialog";
import TextField from "../components/ui/TextField";
import Icon from "../components/ui/Icon";
import { createRouteSessionCache, routeCacheKey } from "../lib/routeSessionCache";
import { useRouteCachedLoader } from "../hooks/useRouteCachedLoader";

interface GameDetailData {
  game: GameInfo | null;
  snapshots: SnapshotInfo[];
}

const gameDetailSessionCache = createRouteSessionCache<GameDetailData>();

export default function GameDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const decodedId = id ? decodeURIComponent(id) : "";
  const { data, loading, refresh } = useRouteCachedLoader<GameDetailData>({
    cache: gameDetailSessionCache,
    key: routeCacheKey("game-detail", { id: decodedId }),
    enabled: !!decodedId,
    pollMs: 15000,
    load: async () => {
      const games = await invoke<GameInfo[]>("get_games");
      const game = games.find((x) => x.id === decodedId) || null;
      if (!game) {
        return { game: null, snapshots: [] };
      }
      const snapshots = await invoke<SnapshotInfo[]>("get_snapshots", { gameId: game.id });
      return { game, snapshots };
    },
    onError: console.error,
  });
  const game = data?.game ?? null;
  const snapshots = data?.snapshots ?? [];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [backupNote, setBackupNote] = useState("");
  const [backingUp, setBackingUp] = useState(false);

  // Snapshot browser state
  const [browserOpen, setBrowserOpen] = useState(false);
  const [browserPath, setBrowserPath] = useState("");
  const [zipEntries, setZipEntries] = useState<ZipEntryInfo[]>([]);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState("");


  const handleBackup = async () => {
    if (!game || backingUp) return;
    setBackingUp(true);
    try {
      await invoke("backup_now", { gameId: game.id, note: backupNote || null });
      setBackupNote("");
      void refresh({ force: true, keepVisible: true });
    } catch (e: any) {
      alert(`${t("notification.backupFailed", { name: game.name, error: e })}`);
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestore = async (snapPath: string) => {
    if (!game) return;
    try {
      await invoke("restore_snapshot", { gameId: game.id, snapshotPath: snapPath });
      setConfirmRestore(null);
      void refresh({ force: true, keepVisible: true });
    } catch (e: any) {
      alert(String(e));
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return;
    try {
      await invoke("delete_snapshot", { snapshotPath: confirmDelete });
      setConfirmDelete(null);
      showToast("error", `${t("gameDetail.delete")} ${game?.name || ""}`);
      void refresh({ force: true, keepVisible: true });
    } catch (e: any) {
      showToast("error", t("notification.backupFailed", { name: game?.name || "", error: String(e) }));
    }
  };

  const handleSaveNote = async (snapPath: string) => {
    try {
      await invoke("edit_note", { snapshotPath: snapPath, note: editNote });
      setEditingId(null);
      void refresh({ force: true, keepVisible: true });
    } catch (e: any) {
      alert(String(e));
    }
  };

  const handleBrowseSnapshot = async (snapPath: string) => {
    try {
      const entries = await invoke<ZipEntryInfo[]>("list_zip_contents", { snapshotPath: snapPath });
      setZipEntries(entries);
      setBrowserPath(snapPath);
      setPreviewFile(null);
      setPreviewContent("");
      setBrowserOpen(true);
    } catch (e: any) {
      alert(String(e));
    }
  };

  const handlePreviewFile = async (fileName: string) => {
    try {
      const content = await invoke<string>("read_zip_file", {
        snapshotPath: browserPath,
        filePath: fileName,
      });
      setPreviewFile(fileName);
      setPreviewContent(content);
    } catch (e: any) {
      setPreviewFile(fileName);
      setPreviewContent(`[${t("snapshotBrowser.binaryFile")}]`);
    }
  };

  if (loading && !data) {
    return (
      <div className="animate-fade-in space-y-4">
        <div className="h-5 w-24 rounded bg-secondary/40" />
        <div className="flex items-center justify-between gap-4">
          <div className="h-8 w-64 rounded bg-secondary/40" />
          <div className="flex items-center gap-2">
            <div className="h-10 w-40 rounded bg-secondary/40" />
            <div className="h-10 w-28 rounded bg-secondary/40" />
          </div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 rounded-lg border p-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-48 rounded bg-secondary/40" />
                <div className="h-3 w-36 rounded bg-secondary/30" />
              </div>
              <div className="h-3 w-16 rounded bg-secondary/30" />
              <div className="h-8 w-20 rounded bg-secondary/40" />
              <div className="h-8 w-20 rounded bg-secondary/40" />
              <div className="h-8 w-20 rounded bg-secondary/40" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (!game) return <div className="text-red-500">{t("gameDetail.gameNotFound")}</div>;

  return (
    <div>
      <button onClick={() => navigate("/games")} className="text-sm text-muted-foreground hover:text-foreground mb-2">
        <Icon name="arrowLeft" size={14} className="inline mr-1" />{t("games.title")}
      </button>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-2xl font-bold truncate">{game.name}</h1>
          {loading && data && (
            <span className="inline-flex items-center justify-center text-muted-foreground animate-spin" title={t("common.loading")}>
              <Icon name="reset" size={14} />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <TextField
            value={backupNote}
            onChange={(e) => setBackupNote(e.target.value)}
            placeholder={t("gameDetail.editNote")}
            className="w-40"
          />
          <Button
            onClick={handleBackup}
            disabled={backingUp}
            className="min-w-[100px]"
          >
            {backingUp ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                {t("gameDetail.backingUp")}
              </span>
            ) : (
              t("gameDetail.backupNow")
            )}
          </Button>
        </div>
      </div>

      {snapshots.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">{t("gameDetail.noSnapshots")}</div>
      ) : (
        <div className="space-y-2">
          {snapshots.map((snap) => (
            <div key={snap.path} className="flex items-center gap-4 p-3 border rounded-lg">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{formatTimestamp(snap.timestamp)}</div>
                {editingId === snap.path ? (
                  <div className="flex gap-1 mt-1">
                    <TextField
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      density="compact"
                      className="flex-1"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && handleSaveNote(snap.path)}
                    />
                    <button onClick={() => handleSaveNote(snap.path)} className="text-xs px-2 bg-primary text-primary-foreground rounded">
                      {t("gameDetail.ok")}
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-xs px-2 border rounded">
                      ✕
                    </button>
                  </div>
                ) : (
                  <div
                    className={`text-xs mt-0.5 cursor-pointer hover:text-primary ${snap.note ? "" : "text-muted-foreground italic"}`}
                    onClick={() => {
                      setEditingId(snap.path);
                      setEditNote(snap.note);
                    }}
                  >
                    {snap.note || t("gameDetail.editNote")}
                  </div>
                )}
              </div>
              <div className="text-xs text-muted-foreground">{formatSize(snap.size_bytes)}</div>
              <Button variant="outline" size="sm" onClick={() => handleBrowseSnapshot(snap.path)}>
                {t("snapshotBrowser.preview")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmRestore(snap.path)}>
                {t("gameDetail.restore")}
              </Button>
              <Button variant="outline" size="sm" ripple={false} onClick={() => setConfirmDelete(snap.path)}
                className="border-red-200 text-red-600">
                {t("gameDetail.delete")}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Snapshot browser modal */}
      <Dialog open={browserOpen} onClose={() => setBrowserOpen(false)} title={t("snapshotBrowser.title")}>
        <div className="flex gap-3 max-h-80 min-h-[200px]">
          {/* File list */}
          <div className="app-scrollbar w-1/2 border rounded overflow-auto">
            {zipEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3">{t("snapshotBrowser.noFiles")}</p>
            ) : (
              zipEntries.filter(e => !e.is_dir).map((entry, i) => (
                <div
                  key={i}
                  onClick={() => handlePreviewFile(entry.name)}
                  className={`px-3 py-1.5 text-xs cursor-pointer truncate hover:bg-secondary ${previewFile === entry.name ? "bg-secondary" : ""}`}
                >
                  {entry.name}
                </div>
              ))
            )}
          </div>
          {/* Preview */}
          <div className="app-scrollbar w-1/2 border rounded overflow-auto bg-muted/30">
            {previewFile ? (
              <div>
                <div className="text-xs text-muted-foreground px-3 py-1.5 border-b truncate">{previewFile}</div>
                <pre className="text-xs p-3 whitespace-pre-wrap break-all font-mono">{previewContent}</pre>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground p-3">{t("snapshotBrowser.preview")}</p>
            )}
          </div>
        </div>
      </Dialog>

      {/* Restore dialog */}
      <Dialog open={!!confirmRestore} onClose={() => setConfirmRestore(null)}>
        <p>{t("gameDetail.confirmRestore")}</p>
        <div className="flex justify-end gap-2 mt-3">
          <Button variant="outline" size="sm" onClick={() => setConfirmRestore(null)}>{t("common.cancel")}</Button>
          <Button variant="primary" size="sm" onClick={() => handleRestore(confirmRestore!)}>{t("gameDetail.restore")}</Button>
        </div>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        <p>{t("gameDetail.confirmDelete")}</p>
        <div className="flex justify-end gap-2 mt-3">
          <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>{t("common.cancel")}</Button>
          <Button variant="danger" size="sm" onClick={handleDeleteConfirmed}>{t("gameDetail.delete")}</Button>
        </div>
      </Dialog>
    </div>
  );
}
