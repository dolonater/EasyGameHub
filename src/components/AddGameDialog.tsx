import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";
import type { GameInfo } from "../lib/types";
import { getSteamIconUrl } from "../lib/types";
import { emit } from "../plugins/events";
import Button from "./ui/Button";
import Checkbox from "./ui/Checkbox";
import TextField from "./ui/TextField";
import TabButtons from "./ui/TabButtons";
import Icon from "./ui/Icon";
import { GlassFloating } from "./ui/GlassSurface";

interface AddGameDialogProps {
  open: boolean;
  onClose: () => void;
  onGameAdded: () => void;
}

export default function AddGameDialog({ open, onClose, onGameAdded }: AddGameDialogProps) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [tab, setTab] = useState<"steam" | "custom">("steam");

  // Steam tab
  const [scanning, setScanning] = useState(false);
  const [steamGames, setSteamGames] = useState<GameInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  // Custom tab
  const [customName, setCustomName] = useState("");
  const [customPath, setCustomPath] = useState("");

  // Mount / close animation
  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      const timer = setTimeout(() => {
        setMounted(false);
        // Reset state on close
        setTab("steam");
        setSteamGames([]);
        setSelected(new Set());
        setCustomName("");
        setCustomPath("");
        setAdding(false);
      }, 180);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Escape key
  useEffect(() => {
    if (!mounted) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mounted]);

  if (!mounted) return null;

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => onClose(), 150);
  };

  const handleSteamScan = async () => {
    setScanning(true);
    try {
      const games = await invoke<GameInfo[]>("scan_installed_games");
      setSteamGames(games);
    } catch (e: any) {
      alert(String(e));
    } finally {
      setScanning(false);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const addSingleGame = async (game: GameInfo) => {
    try {
      await invoke("add_game", { gameId: game.id, name: game.name, savePath: game.save_path });
      emit("game:added", { gameId: game.id, name: game.name, savePath: game.save_path });
      setSelected((prev) => {
        const n = new Set(prev);
        n.delete(game.id);
        return n;
      });
      onGameAdded();
    } catch (err: any) {
      alert(String(err));
    }
  };

  const handleBatchAdd = async () => {
    setAdding(true);
    try {
      for (const g of steamGames) {
        if (!selected.has(g.id)) continue;
        await invoke("add_game", { gameId: g.id, name: g.name, savePath: g.save_path });
        emit("game:added", { gameId: g.id, name: g.name, savePath: g.save_path });
      }
      setSelected(new Set());
      onGameAdded();
    } catch (e: any) {
      alert(String(e));
    } finally {
      setAdding(false);
    }
  };

  const handleBrowse = async () => {
    const folder = await openDialog({ directory: true, multiple: false });
    if (folder) {
      const path = folder as string;
      setCustomPath(path);
      const parts = path.replace(/\\/g, "/").split("/");
      const last = parts[parts.length - 1];
      if (!customName && last) {
        setCustomName(last);
      }
    }
  };

  const handleCustomAdd = async () => {
    if (!customName.trim() || !customPath.trim()) return;
    try {
      await invoke("add_game", { name: customName.trim(), savePath: customPath.trim() });
      emit("game:added", { gameId: null, name: customName.trim(), savePath: customPath.trim() });
      setCustomName("");
      setCustomPath("");
      onGameAdded();
    } catch (e: any) {
      alert(String(e));
    }
  };

  const dialog = (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center px-4 py-6 soft-backdrop ${
        closing ? "animate-fade-out" : "animate-fade-in"
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <GlassFloating
        className={`relative flex w-[min(700px,calc(100vw-32px))] max-h-[88vh] flex-col overflow-hidden rounded-[24px] p-0 shadow-[20px_20px_30px_rgba(0,0,0,0.068)] ${
          closing ? "animate-fade-out" : "animate-scale-in"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-border/60 px-5 py-4 pr-16">
          <div className="flex items-center gap-2">
            <Icon name="addGame" size={18} className="text-primary" />
            <h2 className="text-lg font-semibold">{t("addGame.title")}</h2>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
          aria-label={t("common.close", { defaultValue: "关闭" })}
        >
          <Icon name="close" size={18} className="text-current" />
        </button>

        {/* Body */}
        <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">
          {/* Tabs */}
          <TabButtons
            name="add-game-tab"
            value={tab}
            onChange={(v) => setTab(v as "steam" | "custom")}
            size="sm"
            className="mb-4"
            options={[
              { value: "steam", label: t("addGame.steamTab") },
              { value: "custom", label: t("addGame.customTab") },
            ]}
          />

          {/* Steam Tab */}
          {tab === "steam" && (
            <div>
              <Button variant="primary" onClick={handleSteamScan} disabled={scanning}>
                {scanning ? t("addGame.scanning") : t("addGame.scan")}
              </Button>

              {steamGames.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Button variant="outline" size="sm" onClick={() => setSelected(new Set(steamGames.map((g) => g.id)))}>
                      {t("addGame.selectAll", { count: steamGames.length })}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
                      {t("addGame.deselectAll")}
                    </Button>
                  </div>
                  {steamGames.map((g) => {
                    const iconUrl = getSteamIconUrl(g.steam_app_id);
                    const isSel = selected.has(g.id);
                    return (
                      <div
                        key={g.id}
                        className={`flex items-center gap-3 p-3 border rounded-lg ${isSel ? "bg-primary/5 border-primary/30" : ""}`}
                      >
                        <Checkbox checked={isSel} onChange={() => toggleSelect(g.id)} color="blue" />
                        <div className="w-12 h-7 rounded overflow-hidden bg-secondary flex-shrink-0">
                          {iconUrl ? (
                            <img src={iconUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                              {g.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{g.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{g.save_path}</div>
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          className="flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            addSingleGame(g);
                          }}
                        >
                          {t("addGame.add")}
                        </Button>
                      </div>
                    );
                  })}
                  <Button onClick={handleBatchAdd} disabled={selected.size === 0 || adding}>
                    {adding ? t("common.loading") : `${t("addGame.addSelected")} (${selected.size})`}
                  </Button>
                </div>
              )}

              {!scanning && steamGames.length === 0 && (
                <p className="text-sm text-muted-foreground mt-4">{t("addGame.noGamesFound")}</p>
              )}
            </div>
          )}

          {/* Custom Tab */}
          {tab === "custom" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t("addGame.gameName")}</label>
                <TextField
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Elden Ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("addGame.savePath")}</label>
                <div className="flex gap-2">
                  <TextField
                    value={customPath}
                    onChange={(e) => setCustomPath(e.target.value)}
                    className="flex-1"
                    placeholder="C:\Users\..."
                    readOnly
                  />
                  <Button variant="outline" onClick={handleBrowse}>
                    {t("addGame.selectFolder")}
                  </Button>
                </div>
              </div>
              <Button onClick={handleCustomAdd} disabled={!customName.trim() || !customPath.trim()}>
                {t("addGame.add")}
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/60 px-5 py-4 flex justify-end">
          <Button variant="outline" onClick={handleClose}>
            {t("common.close", { defaultValue: "关闭" })}
          </Button>
        </div>
      </GlassFloating>
    </div>
  );

  return createPortal(dialog, document.body);
}
