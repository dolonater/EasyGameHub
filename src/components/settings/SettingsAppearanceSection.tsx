import { convertFileSrc } from "@tauri-apps/api/core";
import type { TFunction } from "i18next";
import { BUILT_IN_BACKGROUNDS } from "../../lib/appearance";
import type { AppearanceBackgroundChoice, AppearancePreset, Config } from "../../lib/types";
import BackgroundTile from "../ui/BackgroundTile";
import GlassCard from "../ui/GlassCard";
import Icon from "../ui/Icon";
import Select from "../ui/Select";
import Slider from "../ui/Slider";
import Toggle from "../ui/Toggle";

const APPEARANCE_PRESET_OPTIONS: { value: Exclude<AppearancePreset, "custom">; labelKey: string; fallback: string }[] = [
  { value: "default", labelKey: "appearance.presetDefault", fallback: "Default" },
  { value: "soft-glass", labelKey: "appearance.presetSoftGlass", fallback: "Soft Glass" },
  { value: "dark-glass", labelKey: "appearance.presetDarkGlass", fallback: "Dark Glass" },
  { value: "clear-image", labelKey: "appearance.presetClearImage", fallback: "Clear Image" },
];

interface SettingsAppearanceSectionProps {
  t: TFunction;
  config: Config;
  customBackgroundAssets: Config["appearance"]["custom_background_assets"];
  onAppearancePresetChange: (value: string) => void;
  onBuiltInBackgroundSelect: (choice: AppearanceBackgroundChoice) => void;
  onBackgroundImagePick: () => void;
  onAppearanceNumberChange: (key: "overlay_opacity" | "background_blur" | "surface_opacity" | "surface_blur" | "radius", value: number) => void;
  onCoverCardStyleChange: (value: Config["cover_card_style"]) => void;
  updateAppearance: (updater: (prev: Config["appearance"]) => Config["appearance"]) => void;
}

export default function SettingsAppearanceSection({
  t,
  config,
  customBackgroundAssets,
  onAppearancePresetChange,
  onBuiltInBackgroundSelect,
  onBackgroundImagePick,
  onAppearanceNumberChange,
  onCoverCardStyleChange,
  updateAppearance,
}: SettingsAppearanceSectionProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-4 pb-5 border-b">
        <div>
          <h2 className="text-sm font-semibold">{t("appearance.sectionTitle", { defaultValue: "外观" })}</h2>
          <p className="text-xs text-muted-foreground mt-1">{t("appearance.sectionDesc", { defaultValue: "为应用添加背景、毛玻璃与圆角外观。" })}</p>
        </div>

        <GlassCard className="px-4 py-3 space-y-3">
          <div className="relative z-20 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">{t("appearance.preset", { defaultValue: "外观预设" })}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {config.appearance.preset === "custom"
                  ? t("appearance.presetCustomHint", { defaultValue: "当前为自定义外观。" })
                  : t("appearance.presetHint", { defaultValue: "先选一个预设，再微调细节。" })}
              </div>
            </div>
            <Select
              name="appearance-preset"
              value={config.appearance.preset === "custom" ? "default" : config.appearance.preset}
              onChange={onAppearancePresetChange}
              options={APPEARANCE_PRESET_OPTIONS.map((option) => ({
                value: option.value,
                label: t(option.labelKey, { defaultValue: option.fallback }),
              }))}
            />
          </div>

          <div className="space-y-3">
            <div className="relative z-10 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{t("theme.coverCardStyle", { defaultValue: "封面视图风格" })}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{t("theme.coverCardStyleDesc", { defaultValue: "统一切换游戏库、游戏列表和 Steam 相关页面的封面卡片样式。" })}</div>
              </div>
              <Select
                name="cover-card-style"
                value={config.cover_card_style}
                onChange={(value) => onCoverCardStyleChange(value as Config["cover_card_style"])}
                options={[
                  { value: "default", label: t("theme.coverCardStyleDefault", { defaultValue: "默认" }) },
                  { value: "card1", label: t("theme.coverCardStyleCard1", { defaultValue: "Card1 风格" }) },
                ]}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-muted-foreground">{t("appearance.backgroundChoice", { defaultValue: "背景选择" })}</div>
            </div>

            <div className="flex flex-wrap gap-3">
              {BUILT_IN_BACKGROUNDS.map((bg) => {
                const selected = config.appearance.background_choice === bg.value;
                const isNone = bg.value === "%none";
                return (
                  <BackgroundTile
                    key={bg.value}
                    selected={selected}
                    onClick={() => onBuiltInBackgroundSelect(bg.value)}
                    badgeLabel={t("appearance.useBackground", { defaultValue: "使用" })}
                    preview={isNone ? (
                      <div className="flex h-16 w-[90px] items-center justify-center bg-secondary/40 text-[11px] text-muted-foreground">
                        {t("appearance.noneBackground", { defaultValue: "默认背景" })}
                      </div>
                    ) : (
                      <img src={bg.thumbnail!} alt={bg.key} className="h-16 w-[90px] object-cover" />
                    )}
                  />
                );
              })}

              {customBackgroundAssets.map((asset) => {
                const path = asset.source_path;
                const selected = config.appearance.background_choice === "%custom" && config.appearance.background_image === path;
                const previewPath = asset.thumbnail_path || path;
                return (
                  <BackgroundTile
                    key={path}
                    selected={selected}
                    onClick={() => updateAppearance((prev) => ({ ...prev, background_choice: "%custom", background_image: path, preset: "custom" }))}
                    badgeLabel={t("appearance.useBackground", { defaultValue: "使用" })}
                    preview={<img src={`${convertFileSrc(previewPath)}?usage=thumb`} alt="custom background" className="h-16 w-[90px] object-cover" loading="lazy" decoding="async" />}
                    action={
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateAppearance((prev) => {
                            const nextList = prev.custom_backgrounds.filter((item) => item !== path);
                            const nextAssets = prev.custom_background_assets.filter((item) => item.source_path !== path);
                            const nextCurrent = prev.background_image === path ? (nextList[0] || null) : prev.background_image;
                            return {
                              ...prev,
                              custom_backgrounds: nextList,
                              custom_background_assets: nextAssets,
                              background_image: nextCurrent,
                              background_choice: nextList.length > 0 ? (nextCurrent ? "%custom" : "%none") : "%none",
                              preset: "custom",
                            };
                          });
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter" && e.key !== " ") return;
                          e.preventDefault();
                          e.stopPropagation();
                          updateAppearance((prev) => {
                            const nextList = prev.custom_backgrounds.filter((item) => item !== path);
                            const nextAssets = prev.custom_background_assets.filter((item) => item.source_path !== path);
                            const nextCurrent = prev.background_image === path ? (nextList[0] || null) : prev.background_image;
                            return {
                              ...prev,
                              custom_backgrounds: nextList,
                              custom_background_assets: nextAssets,
                              background_image: nextCurrent,
                              background_choice: nextList.length > 0 ? (nextCurrent ? "%custom" : "%none") : "%none",
                              preset: "custom",
                            };
                          });
                        }}
                        className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-white/35 bg-black/45 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                        title={t("appearance.deleteBackground", { defaultValue: "删除" })}
                      >
                        <Icon name="close" size={12} className="text-current" />
                      </span>
                    }
                  />
                );
              })}

              <BackgroundTile
                onClick={onBackgroundImagePick}
                className="border-dashed border-primary/35 text-left hover:border-primary/60 hover:bg-secondary/30"
                preview={(
                  <div className="flex h-16 w-[90px] items-center justify-center text-primary">
                    <Icon name="addGame" size={22} className="text-current" />
                  </div>
                )}
              />
            </div>
          </div>

          <div className="text-xs text-muted-foreground break-all">
            {config.appearance.background_choice === "%custom"
              ? (config.appearance.background_image || t("appearance.noBackground", { defaultValue: "当前未设置背景图。" }))
              : config.appearance.background_choice === "%none"
                ? t("appearance.usingNoBackground", { defaultValue: "当前未使用任何背景图。" })
                : t("appearance.usingBuiltIn", { defaultValue: "当前使用内置背景。" })}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{t("appearance.autoDarken", { defaultValue: "自动暗化背景" })}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{t("appearance.autoDarkenHint", { defaultValue: "让深色模式下的背景观感更稳定。" })}</div>
            </div>
            <Toggle on={config.appearance.auto_darken} onChange={(on) => updateAppearance((prev) => ({ ...prev, auto_darken: on, preset: "custom" }))} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{t("appearance.followBackgroundAccent", { defaultValue: "强调色跟随背景图片" })}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{t("appearance.followBackgroundAccentHint", { defaultValue: "根据当前背景自动调整强调色，并让文字颜色更清晰。" })}</div>
            </div>
            <Toggle on={config.appearance.follow_background_text} onChange={(on) => updateAppearance((prev) => ({ ...prev, follow_background_text: on, preset: "custom" }))} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{t("appearance.liquidGlass", { defaultValue: "液态玻璃效果" })}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{t("appearance.liquidGlassHint", { defaultValue: "增强表面高光与折射感。" })}</div>
            </div>
            <Toggle on={config.appearance.use_liquid_glass} onChange={(on) => updateAppearance((prev) => ({ ...prev, use_liquid_glass: on, preset: "custom" }))} />
          </div>

          <div className="space-y-3">
            <label className="block">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("appearance.overlayOpacity", { defaultValue: "背景遮罩" })}</span>
                <span>{Math.round(config.appearance.overlay_opacity * 100)}%</span>
              </div>
              <Slider
                min={0}
                max={100}
                step={1}
                value={Math.round(config.appearance.overlay_opacity * 100)}
                onChange={(value) => onAppearanceNumberChange("overlay_opacity", value / 100)}
              />
            </label>

            <label className="block">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("appearance.backgroundBlur", { defaultValue: "背景模糊" })}</span>
                <span>{Math.round(config.appearance.background_blur)}px</span>
              </div>
              <Slider
                min={0}
                max={24}
                step={1}
                value={config.appearance.background_blur}
                onChange={(value) => onAppearanceNumberChange("background_blur", value)}
              />
            </label>

            <label className="block">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("appearance.surfaceOpacity", { defaultValue: "卡片透明度" })}</span>
                <span>{Math.round(config.appearance.surface_opacity * 100)}%</span>
              </div>
              <Slider
                min={0}
                max={100}
                step={1}
                value={Math.round(config.appearance.surface_opacity * 100)}
                onChange={(value) => onAppearanceNumberChange("surface_opacity", value / 100)}
              />
            </label>

            <label className="block">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("appearance.surfaceBlur", { defaultValue: "卡片模糊" })}</span>
                <span>{Math.round(config.appearance.surface_blur)}px</span>
              </div>
              <Slider
                min={0}
                max={20}
                step={1}
                value={config.appearance.surface_blur}
                onChange={(value) => onAppearanceNumberChange("surface_blur", value)}
              />
            </label>

            <label className="block">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("appearance.radius", { defaultValue: "圆角强度" })}</span>
                <span>{Math.round(config.appearance.radius)}px</span>
              </div>
              <Slider
                min={0}
                max={24}
                step={1}
                value={config.appearance.radius}
                onChange={(value) => onAppearanceNumberChange("radius", value)}
              />
            </label>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
