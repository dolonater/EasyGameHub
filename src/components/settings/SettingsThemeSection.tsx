import type { TFunction } from "i18next";
import type { Theme, ThemesData } from "../../lib/types";
import GlassCard from "../ui/GlassCard";
import ThemeLibraryTile from "../ui/ThemeLibraryTile";
import Button from "../ui/Button";
import ColorSwatch from "../ui/ColorSwatch";
import Select from "../ui/Select";
import { translateThemeName } from "../../lib/themeName";

interface SettingsThemeSectionProps {
  t: TFunction;
  themesData: ThemesData;
  onSetGlobalDefault: (value: string) => Promise<void> | void;
  onColorPick: (theme: Theme, presetName: string) => Promise<void>;
  onEditTheme: (theme: Theme) => void;
  onCopyTheme: (themeId: string) => void;
  onExportTheme: (theme: Theme) => void;
  onDeleteTheme: (themeId: string) => void;
  onCreateNew: () => void;
  onResetPresets: () => void;
  onExportAll: () => void;
  onImport: () => void;
}

export default function SettingsThemeSection({
  t,
  themesData,
  onSetGlobalDefault,
  onColorPick,
  onEditTheme,
  onCopyTheme,
  onExportTheme,
  onDeleteTheme,
  onCreateNew,
  onResetPresets,
  onExportAll,
  onImport,
}: SettingsThemeSectionProps) {
  return (
    <div className="pb-5 border-b space-y-4">
      <div>
        <h2 className="text-sm font-semibold">{t("theme.sectionTitle", { defaultValue: "颜色主题" })}</h2>
        <p className="text-xs text-muted-foreground mt-1">{t("theme.sectionDescUnified", { defaultValue: "管理全局主题、快速换色和主题库。" })}</p>
      </div>

      <div className="space-y-4">
        <GlassCard className="relative z-40 p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">{t("theme.globalDefault")}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{t("theme.globalDefaultHint", { defaultValue: "颜色主题决定应用的基础配色。" })}</div>
            </div>
            <Select
              name="global-default"
              value={themesData.globalDefault}
              onChange={onSetGlobalDefault}
              options={themesData.themes.map((theme) => ({ value: theme.id, label: translateThemeName(theme.id, theme.name, t) }))}
            />
          </div>
          <ColorSwatch onPick={onColorPick} />
        </GlassCard>

        <GlassCard className="px-4 py-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">{t("theme.libraryTitle", { defaultValue: "主题库" })}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{t("theme.libraryDesc", { defaultValue: "编辑、复制、导出并管理所有颜色主题。" })}</div>
            </div>
            <div className="text-[11px] text-muted-foreground whitespace-nowrap rounded-full border border-border/60 bg-background/60 px-2 py-0.5">
              {themesData.themes.length} {t("theme.themeCount", { defaultValue: "themes" })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pr-1 scrollbar-none">
            {themesData.themes.map((theme) => {
              const isActive = theme.id === themesData.globalDefault;
              const isDefault = theme.id === "system-default";
              return (
                <ThemeLibraryTile
                  key={theme.id}
                  theme={theme}
                  isActive={isActive}
                  isDefault={isDefault}
                  onEdit={() => onEditTheme(theme)}
                  onCopy={() => onCopyTheme(theme.id)}
                  onExport={() => onExportTheme(theme)}
                  onDelete={() => onDeleteTheme(theme.id)}
                  onSetGlobalDefault={() => onSetGlobalDefault(theme.id)}
                  t={t}
                />
              );
            })}
          </div>

          <div className="flex items-center gap-2 flex-wrap pb-1">
            <Button variant="outline" size="sm" onClick={onCreateNew}>{t("theme.newTheme")}</Button>
            <Button variant="outline" size="sm" onClick={onResetPresets}>{t("theme.resetPresets")}</Button>
            <Button variant="outline" size="sm" onClick={onExportAll}>{t("theme.exportAll")}</Button>
            <Button variant="outline" size="sm" onClick={onImport}>{t("theme.import")}</Button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
