import React, { Button, Select, Slider, Toggle, useEffect, useState } from "sdk";
import { HomePage } from "./pages/HomePage";
import { MinePage } from "./pages/MinePage";
import { WatchPage } from "./pages/WatchPage";
import { attachSdk, defaultConfig, disposeRuntime, errorMessage, getState, loadConfig, saveConfig } from "./runtime";
import { cssText } from "./styles";
import type { PluginSdk } from "./types";

export function setup(sdk: PluginSdk) {
  attachSdk(sdk);

  sdk.lifecycle.onDispose(() => {
    disposeRuntime();
  });

  sdk.ui.registerPage({
    path: "home",
    title: "Bilibili",
    icon: "playFilled",
    render: HomePage,
  });

  sdk.ui.registerPage({
    path: "watch",
    title: "播放",
    icon: "playFilled",
    render: WatchPage,
  });

  sdk.ui.registerPage({
    path: "mine",
    title: "我的",
    icon: "playFilled",
    render: MinePage,
  });

  sdk.ui.registerSettingsSection({
    id: "bilibili",
    title: "Bilibili",
    render: BilibiliSettingsSection,
  });
}

export function teardown() {
  disposeRuntime();
}

function BilibiliSettingsSection() {
  const [config, setConfig] = useState(defaultConfig);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    loadConfig()
      .then((next) => {
        if (active) setConfig(next);
      })
      .catch((error) => {
        if (active) setMessage(errorMessage(error));
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="bili-settings">
      <style>{cssText}</style>
      <div className="bili-section-title">
        <strong>Bilibili</strong>
        <small>内置视频插件</small>
      </div>
      <label className="bili-toggle-line">
        <Toggle on={config.syncProgress} onChange={(syncProgress: boolean) => update({ syncProgress })} />
        <span>同步观看进度到 B 站</span>
      </label>
      <label className="bili-toggle-line">
        <Toggle on={config.danmakuEnabled} onChange={(danmakuEnabled: boolean) => update({ danmakuEnabled })} />
        <span>默认显示弹幕</span>
      </label>
      <label className="bili-slider-line">
        <span>弹幕字号 {config.danmakuFontSize}px</span>
        <Slider
          max={32}
          min={16}
          step={1}
          value={config.danmakuFontSize}
          onChange={(danmakuFontSize: number) => update({ danmakuFontSize })}
        />
      </label>
      <label className="bili-slider-line">
        <span>弹幕透明度 {Math.round(config.danmakuOpacity * 100)}%</span>
        <Slider
          max={1}
          min={0.2}
          step={0.05}
          value={config.danmakuOpacity}
          onChange={(danmakuOpacity: number) => update({ danmakuOpacity })}
        />
      </label>
      <label className="bili-slider-line">
        <span>弹幕密度 {Math.round(config.danmakuDensity * 100)}%</span>
        <Slider
          max={1}
          min={0.25}
          step={0.05}
          value={config.danmakuDensity}
          onChange={(danmakuDensity: number) => update({ danmakuDensity })}
        />
      </label>
      <label className="bili-slider-line">
        <span>弹幕速度 {config.danmakuSpeed.toFixed(1)}x</span>
        <Slider
          max={1.8}
          min={0.6}
          step={0.1}
          value={config.danmakuSpeed}
          onChange={(danmakuSpeed: number) => update({ danmakuSpeed })}
        />
      </label>
      <label className="bili-setting-field">
        <span>默认倍速</span>
        <Select
          name="defaultPlaybackRate"
          value={String(config.defaultPlaybackRate)}
          options={[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => ({ value: String(rate), label: `${rate}x` }))}
          onChange={(value: string) => update({ defaultPlaybackRate: Number(value) })}
        />
      </label>
      <label className="bili-setting-field">
        <span>默认清晰度模式</span>
        <Select
          name="defaultQualityMode"
          value={config.defaultQualityMode}
          options={[{ value: "auto", label: "自动" }]}
          onChange={() => update({ defaultQualityMode: "auto" })}
        />
      </label>
      <div className="bili-action-row">
        <Button variant="outline" size="sm" disabled={saving} type="button" onClick={clearCache}>
          清理缓存
        </Button>
        <Button variant="outline" size="sm" disabled={saving} type="button" onClick={openScreenshotFolder}>
          截图目录
        </Button>
      </div>
      {message ? <div className="bili-state bili-state-compact">{message}</div> : null}
    </section>
  );

  function update(next: Partial<typeof config>) {
    const merged = { ...config, ...next };
    setConfig(merged);
    setSaving(true);
    setMessage("");
    void saveConfig(merged)
      .then(() => setMessage("设置已保存"))
      .catch((error) => setMessage(errorMessage(error)))
      .finally(() => setSaving(false));
  }

  function clearCache() {
    const sdk = getSdk();
    if (!sdk) return;
    setSaving(true);
    setMessage("");
    void sdk.bilibili.cache
      .clearCache()
      .then((count) => setMessage(`已清理 ${count} 个缓存文件`))
      .catch((error) => setMessage(errorMessage(error)))
      .finally(() => setSaving(false));
  }

  function openScreenshotFolder() {
    const sdk = getSdk();
    if (!sdk) return;
    setSaving(true);
    setMessage("");
    void sdk.bilibili.cache
      .openScreenshotFolder()
      .then(() => setMessage("截图目录已打开"))
      .catch((error) => setMessage(errorMessage(error)))
      .finally(() => setSaving(false));
  }
}

function getSdk() {
  return getState().sdk;
}
