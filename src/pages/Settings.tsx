import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { DEFAULT_APPEARANCE, normalizeAppearance, presetAppearance } from "../lib/appearance";
import type { AppearanceBackgroundChoice, AppearancePreset, Config, Theme } from "../lib/types";
import { dispatchAppearanceUpdated } from "../hooks/useAppearance";
import { useThemeMode } from "../hooks/useThemeData";
import { useThemeData } from "../hooks/useThemeData";
import { useAnimation } from "../hooks/useAnimation";
import ThemeEditor from "../components/ThemeEditor";
import {
  SettingsAboutSection,
  SettingsAppearanceSection,
  SettingsBackupSection,
  SettingsGeneralSection,
  SettingsThemeSection,
  PluginManagerSection,
} from "../components/settings";
import {
  getSidebarAutoHide,
  getSidebarIconsOnly,
  getSidebarPosition,
  setSidebarAutoHide,
  setSidebarIconsOnly,
  setSidebarPosition,
  type SidebarPosition,
} from "../lib/sidebarMode";
import {
  getSidebarDragReorderEnabled,
  getSidebarVisibility,
  isSidebarItemAlwaysVisible,
  setSidebarItemVisible,
  setSidebarDragReorderEnabled,
} from "../lib/sidebarOrder";
import { translateThemeName } from "../lib/themeName";
import TabButtons from "../components/ui/TabButtons";
import { showToast } from "../components/Notification";
import Button from "../components/ui/Button";
import Dialog from "../components/ui/Dialog";
import TextField from "../components/ui/TextField";
import Select from "../components/ui/Select";

const defaultConfig: Config = {
  backup_root: "./backups",
  language: "zh",
  auto_backup: false,
  debounce_seconds: 15,
  min_interval_minutes: 10,
  auto_start: false,
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

const DEFAULT_FONT_OPTIONS = [
  "%built-in",
  "Microsoft YaHei UI",
  "Microsoft YaHei",
  "SimSun",
  "SimHei",
  "KaiTi",
  "FangSong",
  "Segoe UI",
  "Arial",
];

export default function Settings() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const anim = useAnimation();
  const { mode, toggleMode } = useThemeMode();
  const {
    data: themesData,
    loading: themesLoading,
    saveTheme,
    deleteTheme,
    createTheme,
    copyTheme,
    setGlobalDefault,
    resetPresets,
    refresh,
  } = useThemeData();

  const [config, setConfig] = useState<Config>(defaultConfig);
  const configRef = useRef<Config>(defaultConfig);
  const appearanceRequestIdRef = useRef(0);
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
  const [showNewTheme, setShowNewTheme] = useState(false);
  const [newThemeBaseId, setNewThemeBaseId] = useState("system-default");
  const [newThemeName, setNewThemeName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [sidebarIconsOnly, setSidebarIconsOnlyState] = useState(getSidebarIconsOnly);
  const [sidebarPosition, setSidebarPositionState] = useState<SidebarPosition>(getSidebarPosition);
  const [sidebarDragReorderEnabled, setSidebarDragReorderEnabledState] = useState(getSidebarDragReorderEnabled);
  const [sidebarAutoHide, setSidebarAutoHideState] = useState(getSidebarAutoHide);
  const [sidebarVisibility, setSidebarVisibilityState] = useState<Record<string, boolean>>(() => getSidebarVisibility());
  const [fontOptions, setFontOptions] = useState<string[]>(DEFAULT_FONT_OPTIONS);
  const [importConflict, setImportConflict] = useState<{ themes: Theme[]; conflicts: string[] } | null>(null);
  const [settingsTab, setSettingsTab] = useState<"general" | "backup" | "appearance" | "about" | "plugins">("general");
  const [styleTab, setStyleTab] = useState<"appearance" | "theme">("appearance");
  const customBackgroundAssets = useMemo(() => config.appearance.custom_background_assets || [], [config.appearance.custom_background_assets]);
  const resolvedFontOptions = useMemo(() => {
    const selectedFont = config.appearance.font_family;
    const options = [
      "%built-in",
      ...(selectedFont && selectedFont !== "%built-in" ? [selectedFont] : []),
      ...fontOptions,
    ].filter((font) => font && font.trim().length > 0);
    return Array.from(new Set(options));
  }, [config.appearance.font_family, fontOptions]);
  const sidebarVisibilityGroups = useMemo(() => {
    const visible = (key: string) => sidebarVisibility[key] !== false;
    const item = (key: string, label: string) => ({
      key,
      label,
      visible: visible(key),
      locked: isSidebarItemAlwaysVisible(key),
    });

    return [
      {
        label: t("nav.gamesLabel", { defaultValue: "游戏" }),
        items: [
          item("library", t("steam.libraryPageTitle")),
          item("playtime", t("nav.playtime")),
          item("screenshots", t("nav.screenshots")),
          item("games", t("nav.games")),
        ],
      },
      {
        label: t("steam.navLabel", { defaultValue: "Steam" }),
        items: [
          item("steam", t("steam.navLabel")),
        ],
      },
      {
        label: t("nav.systemLabel", { defaultValue: "系统" }),
        items: [
          item("settings", t("nav.settings")),
        ],
      },
    ];
  }, [sidebarVisibility, t]);

  useEffect(() => {
    invoke<Config>("get_config").then((cfg) => {
      const nextConfig = {
        ...cfg,
        appearance: normalizeAppearance(cfg.appearance),
      };
      configRef.current = nextConfig;
      setConfig(nextConfig);
    }).catch(console.error);

    invoke<boolean>("get_auto_start").then((v) => {
      setConfig((prev) => {
        const nextConfig = { ...prev, auto_start: v };
        configRef.current = nextConfig;
        return nextConfig;
      });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    invoke<string[]>("get_system_fonts")
      .then((fonts) => {
        const systemFonts = fonts.filter((font) => font && font !== "%built-in");
        const next = systemFonts.length > 0
          ? ["%built-in", ...systemFonts]
          : DEFAULT_FONT_OPTIONS;
        setFontOptions(Array.from(new Set(next)));
      })
      .catch(() => {
        setFontOptions(DEFAULT_FONT_OPTIONS);
      });
  }, []);


  const updateAppearance = (updater: (prev: Config["appearance"]) => Config["appearance"]) => {
    const prevConfig = configRef.current;
    const nextAppearance = normalizeAppearance(updater(prevConfig.appearance));
    const nextConfig = {
      ...prevConfig,
      appearance: nextAppearance,
    };
    const requestId = ++appearanceRequestIdRef.current;

    configRef.current = nextConfig;
    setConfig(nextConfig);
    dispatchAppearanceUpdated(nextAppearance);

    void invoke("update_config", { dto: nextConfig })
      .then(() => invoke<Config>("get_config"))
      .then((cfg) => {
        if (requestId !== appearanceRequestIdRef.current) return;
        const resolvedAppearance = normalizeAppearance(cfg.appearance);
        const resolvedConfig = { ...configRef.current, ...cfg, appearance: resolvedAppearance };
        configRef.current = resolvedConfig;
        setConfig(resolvedConfig);
        dispatchAppearanceUpdated(resolvedAppearance);
      })
      .catch(() => {});
  };

  const handleAppearancePresetChange = (value: string) => {
    if (!(value in { default: true, "soft-glass": true, "dark-glass": true, "clear-image": true })) return;
    updateAppearance((prev) => presetAppearance(value as Exclude<AppearancePreset, "custom">, {
      backgroundImage: prev.background_choice === "%custom" ? (prev.background_image ?? null) : null,
      customBackgrounds: prev.custom_backgrounds,
      customBackgroundAssets: prev.custom_background_assets,
      fontFamily: prev.font_family,
    }));
  };

  const handleBuiltInBackgroundSelect = (choice: AppearanceBackgroundChoice) => {
    updateAppearance((prev) => ({
      ...prev,
      background_choice: choice,
      background_image: choice === "%custom" ? prev.background_image : null,
      preset: "custom",
    }));
  };

  const handleAppearanceNumberChange = (key: "overlay_opacity" | "background_blur" | "surface_opacity" | "surface_blur" | "radius", value: number) => {
    updateAppearance((prev) => ({
      ...prev,
      [key]: value,
      preset: "custom",
    }));
  };

  const handleBackgroundImagePick = async () => {
    const file = await open({
      multiple: false,
      filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp", "bmp"] }],
    });
    if (file) {
      updateAppearance((prev) => {
        const sourcePath = file as string;
        const nextAssets = prev.custom_background_assets.some((asset) => asset.source_path === sourcePath)
          ? prev.custom_background_assets
          : [...prev.custom_background_assets, { source_path: sourcePath, thumbnail_path: null, runtime_path: null }];
        return {
          ...prev,
          background_choice: "%custom",
          background_image: sourcePath,
          custom_backgrounds: prev.custom_backgrounds.includes(sourcePath)
            ? prev.custom_backgrounds
            : [...prev.custom_backgrounds, sourcePath],
          custom_background_assets: nextAssets,
          preset: "custom",
        };
      });
    }
  };

  const setConfigState = (next: Config | ((prev: Config) => Config)) => {
    const prevConfig = configRef.current;
    const resolved = typeof next === "function"
      ? (next as (prev: Config) => Config)(prevConfig)
      : next;

    configRef.current = resolved;
    setConfig(resolved);

    void invoke("update_config", { dto: resolved }).catch(() => {});

    if (prevConfig.auto_start !== resolved.auto_start) {
      void invoke("set_auto_start", { enable: resolved.auto_start }).catch(() => {});
    }
    if (prevConfig.periodic_minutes !== resolved.periodic_minutes) {
      void invoke("set_periodic_backup", { minutes: resolved.periodic_minutes }).catch(() => {});
    }
    if (prevConfig.daily_backup_time !== resolved.daily_backup_time) {
      void invoke("set_daily_backup_time", { time: resolved.daily_backup_time }).catch(() => {});
    }
    if (prevConfig.process_check_interval_seconds !== resolved.process_check_interval_seconds) {
      void invoke("set_process_check_interval", { seconds: resolved.process_check_interval_seconds }).catch(() => {});
    }
    if (prevConfig.auto_backup !== resolved.auto_backup) {
      if (resolved.auto_backup) {
        void invoke("start_watcher").catch(() => {});
      } else {
        void invoke("stop_watcher").catch(() => {});
      }
    }
    if (prevConfig.ui_animations !== resolved.ui_animations) {
      setTimeout(() => window.location.reload(), 600);
    }
  };

  const handleBrowse = async () => {
    const folder = await open({ directory: true, multiple: false });
    if (folder) setConfigState({ ...configRef.current, backup_root: folder as string });
  };

  const handleDeleteClick = (id: string) => {
    if (id === "system-default") return;
    setConfirmDelete(id);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete;
    setConfirmDelete(null);
    await deleteTheme(id);
  };

  const pagesUsingTheme = (id: string): string[] => {
    return themesData.globalDefault === id ? [t("theme.globalDefault")] : [];
  };

  const handleCreateNew = () => {
    setNewThemeName("");
    setNewThemeBaseId("system-default");
    setShowNewTheme(true);
  };

  const handleConfirmCreate = async () => {
    const name = newThemeName.trim();
    if (!name) return;
    await createTheme(name, newThemeBaseId);
    setShowNewTheme(false);
  };

  const handleExportTheme = async (theme: Theme) => {
    try {
      const filePath = await save({
        defaultPath: `${theme.name}.dth.json`,
        filters: [{ name: "Theme File", extensions: ["json"] }],
      });
      if (!filePath) return;
      const content = JSON.stringify({ type: "theme", version: 1, data: theme }, null, 2);
      await invoke("write_theme_file", { path: filePath, content });
      showToast("success", t("theme.exported", { name: theme.name }));
    } catch (e: any) {
      showToast("error", String(e));
    }
  };

  const handleExportAll = async () => {
    try {
      const filePath = await save({
        defaultPath: "doona-themes-backup.json",
        filters: [{ name: "Theme Collection", extensions: ["json"] }],
      });
      if (!filePath) return;
      const content = JSON.stringify({ type: "collection", version: 1, data: themesData.themes }, null, 2);
      await invoke("write_theme_file", { path: filePath, content });
      showToast("success", t("theme.exportedAll", { count: themesData.themes.length }));
    } catch (e: any) {
      showToast("error", String(e));
    }
  };

  const doImport = async (incoming: Theme[], overwrite: boolean) => {
    let next = [...themesData.themes];
    const existingIds = new Set(next.map((t) => t.id));

    for (const t of incoming) {
      if (existingIds.has(t.id)) {
        if (overwrite) {
          next = next.map((x) => (x.id === t.id ? { ...t, isPreset: false } : x));
        } else {
          let newId = `${t.id}-imported`;
          let n = 1;
          while (next.some((x) => x.id === newId)) {
            newId = `${t.id}-imported-${++n}`;
          }
          next.push({ ...t, id: newId, name: `${t.name} (imported)`, isPreset: false });
        }
      } else {
        next.push({ ...t, isPreset: false });
      }
    }

    await invoke("save_themes_data", { data: { ...themesData, themes: next } });
    window.location.reload();
  };

  const handleImport = async () => {
    try {
      const filePath = await open({
        multiple: false,
        filters: [{ name: "Theme Files", extensions: ["json"] }],
      });
      if (!filePath) return;
      const raw = await invoke<string>("read_theme_file", { path: filePath as string });
      const parsed = JSON.parse(raw);

      let incoming: Theme[];
      if (parsed.type === "theme" && parsed.data) {
        incoming = [parsed.data];
      } else if (parsed.type === "collection" && Array.isArray(parsed.data)) {
        incoming = parsed.data;
      } else if (Array.isArray(parsed)) {
        incoming = parsed;
      } else {
        showToast("error", t("theme.unrecognizedFormat"));
        return;
      }

      incoming = incoming.map((theme: Theme) => ({ ...theme, isPreset: false }));
      const existingIds = new Set(themesData.themes.map((theme) => theme.id));
      const conflicts = incoming.filter((theme) => existingIds.has(theme.id)).map((theme) => theme.name);

      if (conflicts.length > 0) {
        setImportConflict({ themes: incoming, conflicts });
      } else {
        await doImport(incoming, false);
      }
    } catch (e: any) {
      showToast("error", String(e));
    }
  };

  if (themesLoading) {
    return <div className="text-muted-foreground py-16 text-center">{t("common.loading")}</div>;
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">{t("settings.title")}</h1>

      <div className="space-y-5">
        <TabButtons
          name="settings-top-tabs"
          value={settingsTab}
          onChange={(v) => setSettingsTab(v as "general" | "backup" | "appearance" | "about" | "plugins")}
          options={[
            { value: "general", label: t("settings.tabGeneral", { defaultValue: "常规" }) },
            { value: "backup", label: t("settings.tabBackup", { defaultValue: "备份" }) },
            { value: "appearance", label: t("settings.tabAppearance", { defaultValue: "外观" }) },
            { value: "plugins", label: t("settings.tabPlugins", { defaultValue: "插件" }) },
            { value: "about", label: t("about.title", { defaultValue: "关于" }) },
          ]}
        />

        {settingsTab === "plugins" && <PluginManagerSection t={t} />}

        {settingsTab === "general" && (
          <SettingsGeneralSection
            t={t}
            language={i18n.language}
            mode={mode}
            sidebarIconsOnly={sidebarIconsOnly}
            sidebarPosition={sidebarPosition}
            sidebarDragReorderEnabled={sidebarDragReorderEnabled}
            sidebarAutoHide={sidebarAutoHide}
            sidebarVisibilityGroups={sidebarVisibilityGroups}
            fontFamily={config.appearance.font_family}
            fontOptions={resolvedFontOptions}
            config={config}
            onLanguageChange={(value) => i18n.changeLanguage(value)}
            onToggleMode={toggleMode}
            onSidebarIconsOnlyChange={(value) => {
              setSidebarIconsOnlyState(value);
              setSidebarIconsOnly(value);
              window.dispatchEvent(new StorageEvent("storage", { key: "doona-sidebar-icons-only", newValue: String(value) }));
            }}
            onSidebarPositionChange={(value) => {
              setSidebarPositionState(value);
              setSidebarPosition(value);
            }}
            onSidebarDragReorderChange={(value) => {
              setSidebarDragReorderEnabledState(value);
              setSidebarDragReorderEnabled(value);
              window.dispatchEvent(new StorageEvent("storage", {
                key: "doona-sidebar-drag-reorder",
                newValue: String(value),
              }));
            }}
            onSidebarAutoHideChange={(value) => {
              setSidebarAutoHideState(value);
              setSidebarAutoHide(value);
              window.dispatchEvent(new StorageEvent("storage", {
                key: "doona-sidebar-autohide",
                newValue: String(value),
              }));
            }}
            onSidebarVisibilityChange={(key, value) => {
              setSidebarVisibilityState((prev) => ({ ...prev, [key]: value }));
              setSidebarItemVisible(key, value);
            }}
            onFontFamilyChange={(value) => {
              updateAppearance((prev) => ({
                ...prev,
                font_family: value,
              }));
            }}
            onConfigChange={setConfigState}
            onRerunWizard={() => navigate("/wizard")}
            onResetDefaults={() => setConfigState({ ...defaultConfig, language: i18n.language })}
          />
        )}

        {settingsTab === "backup" && (
          <SettingsBackupSection
            t={t}
            config={config}
            onConfigChange={setConfigState}
            onBrowse={handleBrowse}
          />
        )}

        {settingsTab === "appearance" && (
          <div className="space-y-5">
            <div>
              <TabButtons
                name="style-tabs"
                value={styleTab}
                onChange={(v) => setStyleTab(v as "appearance" | "theme")}
                size="sm"
                options={[
                  { value: "appearance", label: t("appearance.sectionTitle", { defaultValue: "整体风格" }) },
                  { value: "theme", label: t("theme.sectionTitle", { defaultValue: "颜色主题" }) },
                ]}
              />
            </div>

            {styleTab === "appearance" ? (
              <SettingsAppearanceSection
                t={t}
                config={config}
                customBackgroundAssets={customBackgroundAssets}
                onAppearancePresetChange={handleAppearancePresetChange}
                onBuiltInBackgroundSelect={handleBuiltInBackgroundSelect}
                onBackgroundImagePick={handleBackgroundImagePick}
                onAppearanceNumberChange={handleAppearanceNumberChange}
                onCoverCardStyleChange={(value) => setConfigState({ ...configRef.current, cover_card_style: value })}
                updateAppearance={updateAppearance}
              />
            ) : (
              <SettingsThemeSection
                t={t}
                themesData={themesData}
                onSetGlobalDefault={setGlobalDefault}
                onColorPick={async (theme, presetName) => {
                  const nextThemes = [...themesData.themes];
                  const idx = nextThemes.findIndex((item) => item.id === theme.id);
                  if (idx >= 0) nextThemes[idx] = theme;
                  else nextThemes.push(theme);
                  const nextData = { ...themesData, themes: nextThemes, globalDefault: theme.id };
                  await invoke("save_themes_data", { data: nextData });
                  await refresh();
                  showToast("success", `"${presetName}" ${t("theme.applied") || "applied"}`);
                }}
                onEditTheme={setEditingTheme}
                onCopyTheme={copyTheme}
                onExportTheme={handleExportTheme}
                onDeleteTheme={handleDeleteClick}
                onCreateNew={handleCreateNew}
                onResetPresets={resetPresets}
                onExportAll={handleExportAll}
                onImport={handleImport}
              />
            )}
          </div>
        )}

        {settingsTab === "about" && (
          <SettingsAboutSection t={t} />
        )}
      </div>

      <ThemeEditor
        open={editingTheme !== null}
        theme={editingTheme}
        onSave={async (theme) => { await saveTheme(theme); setEditingTheme(null); }}
        onClose={() => setEditingTheme(null)}
      />

      <Dialog
        open={showNewTheme}
        onClose={() => setShowNewTheme(false)}
        title={t("theme.newThemeTitle")}
        actions={
          <>
            <Button variant="outline" onClick={() => setShowNewTheme(false)}>{t("common.cancel")}</Button>
            <Button variant="primary" onClick={handleConfirmCreate}>{t("theme.create")}</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">{t("theme.themeName")}</label>
            <TextField
              type="text"
              value={newThemeName}
              onChange={(e) => setNewThemeName(e.target.value)}
              placeholder={t("theme.themeName")}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleConfirmCreate()}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">{t("theme.baseOn")}</label>
            <Select
              name="new-theme-base"
              value={newThemeBaseId}
              onChange={(v) => setNewThemeBaseId(v)}
              options={themesData.themes.map((theme) => ({ value: theme.id, label: translateThemeName(theme.id, theme.name, t) }))}
            />
          </div>
        </div>
      </Dialog>

      <Dialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={t("theme.deleteTitle", { name: (themesData.themes.find((theme) => theme.id === confirmDelete))?.name })}
        actions={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>{t("common.cancel")}</Button>
            <Button variant="danger" onClick={handleConfirmDelete}>{t("common.confirm")}</Button>
          </>
        }
      >
        {confirmDelete && (() => {
          const affected = pagesUsingTheme(confirmDelete);
          const fallback = themesData.themes.find((theme) => theme.id === "system-default")?.name || "System Default";
          return affected.length > 0 ? (
            <div className="text-xs">
              <p className="mb-1">{t("theme.deleteUsedBy")}</p>
              <ul className="list-disc list-inside space-y-0.5">
                {affected.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <p className="mt-1">{t("theme.deleteFallback")} <strong>{fallback}</strong>.</p>
            </div>
          ) : null;
        })()}
      </Dialog>

      <Dialog
        open={importConflict !== null}
        onClose={() => setImportConflict(null)}
        title={t("theme.importConflictTitle")}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setImportConflict(null)}>{t("common.cancel")}</Button>
            <Button variant="outline" size="sm" onClick={() => { void doImport(importConflict!.themes, false); setImportConflict(null); }}>
              {t("theme.importRename")}
            </Button>
            <Button variant="primary" size="sm" onClick={() => { void doImport(importConflict!.themes, true); setImportConflict(null); }}>
              {t("theme.importOverwrite")}
            </Button>
          </>
        }
      >
        {importConflict && (
          <div className="text-xs">
            <p className="mb-1">{t("theme.importConflictDesc")}</p>
            <ul className="list-disc list-inside space-y-0.5">
              {importConflict.conflicts.map((name, index) => <li key={index}>{name}</li>)}
            </ul>
            <p className="mt-2">{t("theme.importConflictHow")}</p>
          </div>
        )}
      </Dialog>
    </div>
  );
}
