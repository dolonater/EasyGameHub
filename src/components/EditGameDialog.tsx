import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { showToast } from "./Notification";
import { Button, GlassFloating, glassControlClass } from "./ui";
import { useAnimation } from "../hooks/useAnimation";

// ── Types ──────────────────────────────────────────────────────

interface SaveFile {
  root: string; path: string; pattern: string;
  recursive: boolean; resolvedPath: string | null;
}

export interface EditGameProps {
  appId: number;
  name: string;
  installDir?: string | null;
  installPath?: string | null;
  sizeOnDisk?: number | null;
  onClose: () => void;
  onSaved: () => void;
}

// ── Component ───────────────────────────────────────────────────

export default function EditGameDialog({
  appId, name, installDir, installPath, sizeOnDisk, onClose, onSaved,
}: EditGameProps) {
  const { t } = useTranslation();
  const anim = useAnimation();
  const [editName, setEditName] = useState(name);
  const [saveFiles, setSaveFiles] = useState<SaveFile[]>([]);

  useEffect(() => {
    invoke<SaveFile[]>("get_game_save_files", { appId })
      .then(setSaveFiles).catch(() => setSaveFiles([]));
  }, [appId]);

  const handleSave = () => {
    invoke("edit_steam_game_info", { appId, name: editName.trim() || name })
      .then(() => { onSaved(); onClose(); })
      .catch((e) => showToast("error", String(e)));
  };

  const handleChangeCover = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const file = await open({
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
      });
      if (file) {
        await invoke("set_game_cover_image", { appId, imagePath: file });
        showToast("success", "Cover image updated. Restart Steam to see changes.");
      }
    } catch (e: any) {
      showToast("error", String(e));
    }
  };

  const dialog = (
    <div className="app-scrollbar fixed inset-0 z-50 flex items-start justify-center soft-backdrop overflow-y-auto py-8"
      onClick={onClose}>
      <GlassFloating className={`border rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 ${anim ? "animate-scale-in" : ""}`}
        onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{t("steam.editGameInfo") || "Edit Game Info"}</h2>

        {/* Cover Image */}
        <div className="mb-4 flex gap-4">
          <div className="w-[120px] aspect-[600/900] rounded-lg overflow-hidden border bg-secondary/30 flex-shrink-0">
            <img
              src={appId > 0
                ? `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`
                : ""}
              alt="" className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          <div className="flex flex-col justify-center gap-2">
            <div className="text-xs text-muted-foreground">App {appId}</div>
            <button onClick={handleChangeCover}
              className="app-surface app-glass-button px-3 py-1.5 text-xs border rounded-lg hover:bg-secondary">
              {t("steam.changeCover") || "Change Cover"}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {/* App ID */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t("steam.appId") || "App ID"}</label>
            <div className="px-3 py-2 border rounded bg-secondary/30 text-sm font-mono">{appId}</div>
          </div>

          {/* Game Name */}
          <div>
            <label className="block text-xs font-medium mb-1">{t("steam.gameName") || "Game Name"}</label>
            <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
              className={`${glassControlClass} w-full px-3 py-2 border rounded text-sm bg-card`} />
          </div>

          {/* Install info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{t("steam.installDir") || "Install Dir"}</label>
              <div className="px-3 py-2 border rounded bg-secondary/30 text-xs text-muted-foreground truncate">
                {installDir || "—"}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{t("steam.sizeOnDisk") || "Size"}</label>
              <div className="px-3 py-2 border rounded bg-secondary/30 text-sm font-mono">
                {sizeOnDisk != null && sizeOnDisk > 0
                  ? (sizeOnDisk > 1073741824
                    ? `${(sizeOnDisk / 1073741824).toFixed(1)} GB`
                    : `${Math.round(sizeOnDisk / 1048576)} MB`)
                  : "—"}
              </div>
            </div>
          </div>

          {installPath && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{t("steam.installPath") || "Install Path"}</label>
              <div className="px-3 py-2 border rounded bg-secondary/30 text-[10px] text-muted-foreground break-all">
                {installPath.replace(/\\/g, "/")}
              </div>
            </div>
          )}

          {/* Save File Locations */}
          {saveFiles.length > 0 && (
            <div>
              <label className="block text-xs font-medium mb-1">{t("steam.saveFiles") || "Save File Locations"}</label>
              <div className="border rounded divide-y">
                {saveFiles.map((sf, i) => (
                  <div key={i} className="px-3 py-2 text-xs">
                    <div className="flex gap-2 items-center">
                      <span className="font-mono text-[10px] bg-secondary px-1 rounded">{sf.root}</span>
                      {sf.recursive && <span className="text-[10px] text-amber-500">recursive</span>}
                    </div>
                    <div className="text-muted-foreground mt-0.5">{sf.path}</div>
                    <div className="text-muted-foreground font-mono">{sf.pattern}</div>
                    {sf.resolvedPath && (
                      <div className="text-[10px] text-primary/70 truncate mt-0.5">{sf.resolvedPath}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={handleSave}>
            {t("common.save")}
          </Button>
        </div>
      </GlassFloating>
    </div>
  );

  return createPortal(dialog, document.body);
}
