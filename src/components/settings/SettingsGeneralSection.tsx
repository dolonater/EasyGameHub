import type { Config } from "../../lib/types";
import type { TFunction } from "i18next";
import { useState } from "react";
import Button from "../ui/Button";
import GlassCard from "../ui/GlassCard";
import Icon from "../ui/Icon";
import Select from "../ui/Select";
import TabButtons from "../ui/TabButtons";
import Toggle from "../ui/Toggle";

interface SettingsGeneralSectionProps {
  t: TFunction;
  language: string;
  mode: "light" | "dark";
  sidebarIconsOnly: boolean;
  sidebarPosition: "left" | "right" | "top" | "bottom";
  sidebarDragReorderEnabled: boolean;
  sidebarAutoHide: boolean;
  fontFamily: string;
  fontOptions: string[];
  sidebarVisibilityGroups: {
    label: string;
    items: {
      key: string;
      label: string;
      visible: boolean;
      locked: boolean;
    }[];
  }[];
  config: Config;
  onLanguageChange: (value: string) => void;
  onToggleMode: () => void;
  onSidebarIconsOnlyChange: (value: boolean) => void;
  onSidebarPositionChange: (value: "left" | "right" | "top" | "bottom") => void;
  onSidebarDragReorderChange: (value: boolean) => void;
  onSidebarAutoHideChange: (value: boolean) => void;
  onFontFamilyChange: (value: string) => void;
  onSidebarVisibilityChange: (key: string, value: boolean) => void;
  onConfigChange: (next: Config) => void;
  onRerunWizard: () => void;
  onResetDefaults: () => void;
}

export default function SettingsGeneralSection({
  t,
  language,
  mode,
  sidebarIconsOnly,
  sidebarPosition,
  sidebarDragReorderEnabled,
  sidebarAutoHide,
  fontFamily,
  fontOptions,
  sidebarVisibilityGroups,
  config,
  onLanguageChange,
  onToggleMode,
  onSidebarIconsOnlyChange,
  onSidebarPositionChange,
  onSidebarDragReorderChange,
  onSidebarAutoHideChange,
  onFontFamilyChange,
  onSidebarVisibilityChange,
  onConfigChange,
  onRerunWizard,
  onResetDefaults,
}: SettingsGeneralSectionProps) {
  const [sidebarVisibilityExpanded, setSidebarVisibilityExpanded] = useState(false);

  return (
    <div className="space-y-5">
      <div className="space-y-4 pb-5 border-b">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{t("settings.language")}</span>
          <TabButtons
            name="settings-lang"
            value={language}
            onChange={(v) => onLanguageChange(v)}
            size="sm"
            options={[
              { value: "zh", label: t("wizard.langZh") },
              { value: "en", label: t("wizard.langEn") },
            ]}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{t("settings.darkMode")}</span>
          <Toggle on={mode === "dark"} onChange={(on) => { if (on !== (mode === "dark")) onToggleMode(); }} />
        </div>
      </div>

      <div className="space-y-4 pb-5 border-b">
        <div>
          <h2 className="text-sm font-semibold">{t("settings.interfaceSection", { defaultValue: "界面" })}</h2>
          <p className="text-xs text-muted-foreground mt-1">{t("settings.interfaceSectionDesc", { defaultValue: "调整不属于主题或外观参数的界面显示方式。" })}</p>
        </div>
        <GlassCard className="relative z-20 px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">{t("settings.fontFamily", { defaultValue: "界面字体" })}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{t("settings.fontFamilyDesc", { defaultValue: "切换应用界面使用的系统字体。" })}</div>
          </div>
          <Select
            name="settings-font-family"
            value={fontFamily || "%built-in"}
            onChange={onFontFamilyChange}
            className="max-w-[220px]"
            options={fontOptions.map((font) => ({
              value: font,
              label: font === "%built-in" ? t("settings.fontFamilyBuiltIn", { defaultValue: "内置默认" }) : font,
            }))}
          />
        </GlassCard>
        <GlassCard className="px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">{t("settings.sidebarIconsOnly")}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{t("settings.sidebarIconsOnlyDesc")}</div>
          </div>
          <Toggle on={sidebarIconsOnly} onChange={onSidebarIconsOnlyChange} />
        </GlassCard>
        <GlassCard className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">{t("settings.sidebarPosition", { defaultValue: "导航栏位置" })}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{t("settings.sidebarPositionDesc", { defaultValue: "切换导航栏显示在左侧、右侧、顶部或底部。" })}</div>
          </div>
          <TabButtons
            name="settings-sidebar-position"
            value={sidebarPosition}
            onChange={(value) => onSidebarPositionChange(value as "left" | "right" | "top" | "bottom")}
            size="xs"
            options={[
              { value: "left", label: t("settings.sidebarPositionLeft", { defaultValue: "左侧" }) },
              { value: "top", label: t("settings.sidebarPositionTop", { defaultValue: "顶部" }) },
              { value: "bottom", label: t("settings.sidebarPositionBottom", { defaultValue: "底部" }) },
              { value: "right", label: t("settings.sidebarPositionRight", { defaultValue: "右侧" }) },
            ]}
          />
        </GlassCard>
        <GlassCard className="px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">{t("settings.sidebarAutoHide")}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{t("settings.sidebarAutoHideDesc")}</div>
          </div>
          <Toggle on={sidebarAutoHide} onChange={onSidebarAutoHideChange} />
        </GlassCard>
        <GlassCard className="px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">{t("settings.sidebarDragReorder", { defaultValue: "允许侧栏拖拽排序" })}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{t("settings.sidebarDragReorderDesc", { defaultValue: "开启后可拖拽左侧栏选项调整顺序" })}</div>
          </div>
          <Toggle on={sidebarDragReorderEnabled} onChange={onSidebarDragReorderChange} />
        </GlassCard>
        <GlassCard className="px-4 py-3 space-y-3">
          <button
            type="button"
            className="w-full flex items-center justify-between gap-3 text-left"
            aria-expanded={sidebarVisibilityExpanded}
            onClick={() => setSidebarVisibilityExpanded((value) => !value)}
          >
            <div className="min-w-0">
              <div className="text-sm font-medium">{t("settings.sidebarVisibleItems", { defaultValue: "侧栏显示项" })}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{t("settings.sidebarVisibleItemsDesc", { defaultValue: "选择哪些选项显示在左侧栏中" })}</div>
            </div>
            <Icon
              name="chevronDown"
              size={16}
              className={[
                "text-muted-foreground transition-transform duration-200",
                sidebarVisibilityExpanded ? "rotate-180" : "",
              ].join(" ").trim()}
            />
          </button>
          {sidebarVisibilityExpanded && (
            <div className="space-y-3 pt-1">
              {sidebarVisibilityGroups.map((group) => (
                <div key={group.label} className="space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</div>
                  <div className="space-y-1.5">
                    {group.items.map((item) => (
                      <div key={item.key} className="flex items-center justify-between gap-3 rounded-[var(--radius)] px-2 py-1.5 bg-background/35 border border-border/40">
                        <span className="text-sm truncate">{item.label}</span>
                        {item.locked ? (
                          <span className="text-[11px] text-muted-foreground flex-shrink-0">{t("settings.sidebarItemFixed", { defaultValue: "固定" })}</span>
                        ) : (
                          <Toggle on={item.visible} onChange={(value) => onSidebarVisibilityChange(item.key, value)} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">UI {t("settings.uiAnimations") || "Animations"}</div>
          <div className="text-xs text-muted-foreground">{t("settings.uiAnimationsDesc") || "Card hover lift, page transitions, and data animations"}</div>
        </div>
        <Toggle on={config.ui_animations} onChange={(on) => onConfigChange({ ...config, ui_animations: on })} />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">{t("settings.autoStart")}</div>
          <div className="text-xs text-muted-foreground">{t("settings.autoStartDesc")}</div>
        </div>
        <Toggle on={config.auto_start} onChange={(on) => onConfigChange({ ...config, auto_start: on })} />
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={onRerunWizard}>
          {t("settings.rerunWizard")}
        </Button>
        <Button variant="outline" onClick={onResetDefaults}>
          <Icon name="reset" size={16} className="text-foreground dark:text-white/85" />
          {t("settings.resetDefaults")}
        </Button>
      </div>

    </div>
  );
}
