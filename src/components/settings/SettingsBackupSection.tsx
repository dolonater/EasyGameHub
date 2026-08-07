import type { Config } from "../../lib/types";
import type { TFunction } from "i18next";
import Button from "../ui/Button";
import TextField from "../ui/TextField";
import Toggle from "../ui/Toggle";

interface SettingsBackupSectionProps {
  t: TFunction;
  config: Config;
  onConfigChange: (next: Config) => void;
  onBrowse: () => void;
}

export default function SettingsBackupSection({ t, config, onConfigChange, onBrowse }: SettingsBackupSectionProps) {
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium mb-1">{t("settings.backupRoot")}</label>
        <div className="flex gap-2">
          <TextField value={config.backup_root} readOnly className="flex-1" />
          <Button variant="outline" onClick={onBrowse}>{t("settings.browse")}</Button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">{t("settings.backupSizeLimit")}</label>
        <TextField
          type="number"
          value={config.max_backup_size_gb}
          min={0}
          max={1000}
          onChange={(e) => onConfigChange({ ...config, max_backup_size_gb: Number(e.target.value) })}
          className="!w-20"
        />
        <p className="text-xs text-muted-foreground mt-1">{t("settings.backupSizeLimitHint")}</p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">{t("settings.autoBackup")}</div>
          <div className="text-xs text-muted-foreground">{t("settings.autoBackupDesc")}</div>
        </div>
        <Toggle on={config.auto_backup} onChange={(on) => onConfigChange({ ...config, auto_backup: on })} />
      </div>

      {config.auto_backup && (
        <>
          <div>
            <label className="block text-sm font-medium mb-1">{t("settings.debounce")}</label>
            <TextField
              type="number"
              value={config.debounce_seconds}
              min={5}
              max={120}
              onChange={(e) => onConfigChange({ ...config, debounce_seconds: Number(e.target.value) })}
              className="!w-20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("settings.minInterval")}</label>
            <TextField
              type="number"
              value={config.min_interval_minutes}
              min={1}
              max={120}
              onChange={(e) => onConfigChange({ ...config, min_interval_minutes: Number(e.target.value) })}
              className="!w-20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("settings.periodicBackup")}</label>
            <TextField
              type="number"
              value={config.periodic_minutes}
              min={0}
              max={1440}
              onChange={(e) => onConfigChange({ ...config, periodic_minutes: Number(e.target.value) })}
              className="!w-20"
            />
            <p className="text-xs text-muted-foreground mt-1">{t("settings.periodicBackupHint")}</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("settings.dailyBackupTime")}</label>
            <TextField
              type="time"
              value={config.daily_backup_time || ""}
              onChange={(e) => onConfigChange({ ...config, daily_backup_time: e.target.value || null })}
              className="!w-20"
            />
            <p className="text-xs text-muted-foreground mt-1">{t("settings.dailyBackupTimeHint")}</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{t("settings.autoBackupOnExit")}</div>
              <div className="text-xs text-muted-foreground">{t("settings.autoBackupOnExitDesc")}</div>
            </div>
            <Toggle on={config.auto_backup_on_game_exit} onChange={(on) => onConfigChange({ ...config, auto_backup_on_game_exit: on })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("settings.processCheckInterval")}</label>
            <TextField
              type="number"
              value={config.process_check_interval_seconds}
              min={1}
              max={30}
              onChange={(e) => onConfigChange({ ...config, process_check_interval_seconds: Number(e.target.value) })}
              className="!w-20"
            />
          </div>
        </>
      )}
    </div>
  );
}
