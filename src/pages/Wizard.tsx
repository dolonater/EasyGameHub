import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { GameInfo, Config } from "../lib/types";
import { DEFAULT_APPEARANCE } from "../lib/appearance";
import { useThemeMode } from "../hooks/useThemeData";
import WindowTitleBar from "../components/WindowTitleBar";
import GameIcon from "../components/GameIcon";
import Button from "../components/ui/Button";
import Checkbox from "../components/ui/Checkbox";
import Select from "../components/ui/Select";
import TextField from "../components/ui/TextField";
import Toggle from "../components/ui/Toggle";

function normalizeLanguage(value: string | null | undefined): "zh" | "en" {
  return value?.toLowerCase().startsWith("en") ? "en" : "zh";
}

export default function Wizard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { setForcedMode } = useThemeMode();
  const [step, setStep] = useState(1);

  // Step 1: Welcome + language
  const [lang, setLang] = useState<"zh" | "en">(() => normalizeLanguage(i18n.language));

  // Step 2: Backup location (REQUIRED)
  const [backupRoot, setBackupRoot] = useState("./backups");

  // Step 3: Scan games
  const [steamGames, setSteamGames] = useState<GameInfo[]>([]);
  const [scanned, setScanned] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Step 4: Auto backup toggle
  const [autoBackup, setAutoBackup] = useState(false);

  // Step 5: Preferences (only if autoBackup = true)
  const [debounce, setDebounce] = useState(15);
  const [minInterval, setMinInterval] = useState(10);
  const [autoStart, setAutoStart] = useState(false);

  useEffect(() => {
    setForcedMode("light");
    return () => setForcedMode(null);
  }, [setForcedMode]);

  const totalSteps = autoBackup ? 6 : 5;
  const canSkip = step !== 2;

  const handleBrowse = async () => {
    const folder = await open({ directory: true, multiple: false });
    if (folder) setBackupRoot(folder as string);
  };

  const handleScan = async () => {
    try {
      const games = await invoke<GameInfo[]>("scan_installed_games");
      setSteamGames(games);
      setScanned(true);
    } catch (e: any) {
      alert(String(e));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleLanguageChange = (value: string) => {
    const next = normalizeLanguage(value);
    setLang(next);
    void i18n.changeLanguage(next);
  };

  const handleFinish = async () => {
    // Save config
    const config: Config = {
      backup_root: backupRoot,
      language: lang,
      auto_backup: autoBackup,
      debounce_seconds: autoBackup ? debounce : 15,
      min_interval_minutes: autoBackup ? minInterval : 10,
      auto_start: autoStart,
      periodic_minutes: 0,
      max_backup_size_gb: 10,
      daily_backup_time: null,
      process_check_interval_seconds: 5,
      auto_backup_on_game_exit: false,
      ui_animations: true,
      steam_api_key: "",
      cached_steam_id: "",
      theme_mode: "dark",
      cover_card_style: "default",
      appearance: DEFAULT_APPEARANCE,
    };
    try {
      await invoke("update_config", { dto: config });
      i18n.changeLanguage(lang);

      // Add selected games
      for (const g of steamGames) {
        if (selected.has(g.id)) {
          await invoke("add_game", { gameId: g.id, name: g.name, savePath: g.save_path });
        }
      }
    } catch (e: any) {
      alert(String(e));
    }
    navigate("/");
  };

  const steps = autoBackup
    ? ["wizard.step1", "wizard.step2", "wizard.step3", "wizard.step4", "wizard.step5", "wizard.step6"]
    : ["wizard.step1", "wizard.step2", "wizard.step3", "wizard.step4", "wizard.step6"];

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden">
      <WindowTitleBar />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          {/* Step indicator */}
          <div className="flex gap-2 mb-8 justify-center">
            {steps.map((_s, i) => (
              <div
                key={i}
                className={`w-8 h-1.5 rounded-full transition-colors ${
                  i + 1 <= step ? "bg-primary" : "bg-secondary"
                }`}
              />
            ))}
          </div>

          {/* Step 1: Welcome */}
          {step === 1 && (
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-3">{t("wizard.welcome")}</h1>
              <p className="text-muted-foreground mb-6">{t("wizard.welcomeDesc")}</p>
              <div className="mb-6 flex flex-col items-center gap-2">
                <label className="text-sm font-medium">{t("settings.language")}:</label>
                <Select
                  name="wizard-language"
                  value={lang}
                  onChange={handleLanguageChange}
                  options={[
                    { value: "zh", label: t("wizard.langZh") },
                    { value: "en", label: t("wizard.langEn") },
                  ]}
                  className="min-w-[120px]"
                />
              </div>
            </div>
          )}

          {/* Step 2: Backup location (REQUIRED) */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold mb-2">{t("wizard.step2")}</h2>
              <p className="text-muted-foreground mb-4">{t("wizard.selectLocation")}</p>
              <div className="flex gap-2">
                <TextField
                  value={backupRoot}
                  readOnly
                  className="flex-1"
                />
                <Button variant="outline" onClick={handleBrowse}>
                  {t("settings.browse")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{t("wizard.defaultLocation")}</p>
            </div>
          )}

          {/* Step 3: Scan Steam */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-bold mb-2">{t("wizard.step3")}</h2>
              <p className="text-muted-foreground mb-4">{t("wizard.scanGames")}</p>
              <div className="mb-4">
                <Button variant="primary" onClick={handleScan}>
                  {t("addGame.scan")}
                </Button>
              </div>
              {scanned && steamGames.length > 0 && (
                <div className="app-scrollbar space-y-2 max-h-64 overflow-auto">
                  <div className="flex gap-2 mb-1">
                    <Button variant="outline" size="sm" onClick={() => setSelected(new Set(steamGames.map((g) => g.id)))}>
                      {t("wizard.selectAll")}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
                      {t("wizard.deselectAll")}
                    </Button>
                  </div>
                  {steamGames.map((g) => (
                    <div key={g.id} className="flex items-center gap-3 p-2 border rounded">
                      <Checkbox checked={selected.has(g.id)} onChange={() => toggleSelect(g.id)} color="blue" />
                      <GameIcon steamAppId={g.steam_app_id} name={g.name} className="w-12 h-7 rounded overflow-hidden bg-secondary flex-shrink-0" />
                      <span className="text-sm truncate">{g.name}</span>
                    </div>
                  ))}
                </div>
              )}
              {scanned && steamGames.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("addGame.noGamesFound")}</p>
              )}
            </div>
          )}

          {/* Step 4: Auto backup */}
          {step === 4 && (
            <div className="text-center">
              <h2 className="text-xl font-bold mb-4">{t("wizard.enableAutoBackup")}</h2>
              <div className="flex justify-center">
                <Toggle on={autoBackup} onChange={setAutoBackup} id="wizard-auto-backup" />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {autoBackup ? t("settings.autoBackup") : t("wizard.autoBackupOff")}
              </p>
            </div>
          )}

          {/* Step 5: Preferences (only if auto backup on) */}
          {step === 5 && autoBackup && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold mb-2">{t("wizard.step5")}</h2>
              <div>
                <label className="block text-sm font-medium mb-1">{t("settings.debounce")}</label>
                <TextField
                  type="number"
                  value={debounce}
                  min={5}
                  max={120}
                  onChange={(e) => setDebounce(Number(e.target.value))}
                  className="w-24"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("settings.minInterval")}</label>
                <TextField
                  type="number"
                  value={minInterval}
                  min={1}
                  max={120}
                  onChange={(e) => setMinInterval(Number(e.target.value))}
                  className="w-24"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{t("settings.autoStart")}</div>
                  <div className="text-xs text-muted-foreground">{t("settings.autoStartDesc")}</div>
                </div>
                <Toggle on={autoStart} onChange={setAutoStart} id="wizard-auto-start" />
              </div>
            </div>
          )}

          {/* Last step: Done */}
          {((step === 5 && !autoBackup) || step === 6) && (
            <div className="text-center">
              <h2 className="text-xl font-bold mb-2">{t("wizard.step6")}</h2>
              <p className="text-muted-foreground mb-6">
                {t("wizard.protected", { count: selected.size })}
              </p>
              <Button variant="primary" size="lg" onClick={handleFinish}>
                {t("wizard.startUsing")}
              </Button>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <div>
              {step > 1 && (
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  {t("wizard.back")}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {canSkip && step < totalSteps && (
                <Button variant="ghost" onClick={() => setStep(step + 1)}>
                  {t("wizard.skip")}
                </Button>
              )}
              {step < totalSteps && (
                <Button
                  onClick={() => setStep(step + 1)}
                  disabled={step === 2 && !backupRoot}
                >
                  {t("wizard.next")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
