import React, { Slider, Toggle } from "sdk";
import type { DanmakuSettings } from "./DanmakuOverlay";
import { MenuPopover } from "./MenuPopover";

interface DanmakuSettingsPopoverProps {
  settings: DanmakuSettings;
  loading: boolean;
  count: number;
  error: string;
  onChange(settings: DanmakuSettings): void;
  onClose(): void;
  style?: Record<string, string | number>;
  triggerRef?: { current: HTMLElement | null };
}

/**
 * 弹幕设置弹层（控制栏"弹幕"按钮点开）。沿用菜单样式浮层语言。
 */
export function DanmakuSettingsPopover({
  settings,
  loading,
  count,
  error,
  onChange,
  onClose,
  style,
  triggerRef,
}: DanmakuSettingsPopoverProps) {
  return (
    <MenuPopover onClose={onClose} style={style} triggerRef={triggerRef}>
      <div className="bili-menu-heading">
        <strong>弹幕</strong>
        <small>{loading ? "加载中" : `${count} 条`}</small>
      </div>
      {error ? <div className="bili-state bili-state-error bili-state-compact">{error}</div> : null}
      <label className="bili-toggle-line">
        <Toggle on={settings.enabled} onChange={(enabled: boolean) => onChange({ ...settings, enabled })} />
        <span>显示弹幕</span>
      </label>
      <label className="bili-slider-line">
        <span>字号 {settings.fontSize}px</span>
        <Slider
          max={32}
          min={16}
          step={1}
          value={settings.fontSize}
          onChange={(fontSize: number) => onChange({ ...settings, fontSize })}
        />
      </label>
      <label className="bili-slider-line">
        <span>透明度 {Math.round(settings.opacity * 100)}%</span>
        <Slider
          max={1}
          min={0.2}
          step={0.05}
          value={settings.opacity}
          onChange={(opacity: number) => onChange({ ...settings, opacity })}
        />
      </label>
      <label className="bili-slider-line">
        <span>密度 {Math.round(settings.density * 100)}%</span>
        <Slider
          max={1}
          min={0.25}
          step={0.05}
          value={settings.density}
          onChange={(density: number) => onChange({ ...settings, density })}
        />
      </label>
      <label className="bili-slider-line">
        <span>速度 {settings.speed.toFixed(1)}x</span>
        <Slider
          max={1.8}
          min={0.6}
          step={0.1}
          value={settings.speed}
          onChange={(speed: number) => onChange({ ...settings, speed })}
        />
      </label>
    </MenuPopover>
  );
}
