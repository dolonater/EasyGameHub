import React, { Button, Select, Slider, Toggle, useEffect, useState } from "sdk";
import { defaultConfig, errorMessage, getState, loadConfig, saveConfig } from "../runtime";
import type { BilibiliPluginConfig } from "../runtime";
import { cssText } from "../styles";

type SettingsTab = "player" | "danmaku" | "general";

const TABS: Array<{ key: SettingsTab; label: string }> = [
  { key: "player", label: "播放器" },
  { key: "danmaku", label: "弹幕" },
  { key: "general", label: "通用" },
];

const BUFFER_OPTIONS = [
  { value: "auto", label: "自动" },
  { value: "small", label: "小" },
  { value: "medium", label: "中" },
  { value: "large", label: "大" },
];

const FORMAT_OPTIONS = [
  { value: "dash", label: "DASH 高清" },
  { value: "mp4", label: "MP4 兼容" },
];

const CODEC_OPTIONS = [
  { value: "avc", label: "AVC" },
  { value: "hevc", label: "HEVC" },
  { value: "av1", label: "AV1" },
];

const AUDIO_OPTIONS = [
  { value: "standard", label: "标准 AAC" },
  { value: "flac", label: "无损 FLAC" },
];

/**
 * 插件内设置页（P7）：播放器 / 弹幕 / 通用 三个 tab。
 * 取代宿主"设置→插件"区块（index.tsx 不再注册 settings section）。
 */
export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>("player");
  const [config, setConfig] = useState<BilibiliPluginConfig>(defaultConfig);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    loadConfig()
      .then((next) => {
        if (!active) return;
        setConfig(next);
        setLoaded(true);
      })
      .catch((error) => {
        if (active) {
          setLoaded(true);
          setMessage(errorMessage(error));
        }
      });
    return () => {
      active = false;
    };
  }, []);

  function update(next: Partial<BilibiliPluginConfig>) {
    const merged = { ...config, ...next };
    setConfig(merged);
    setSaving(true);
    setMessage("");
    void saveConfig(merged)
      .then(() => setMessage("设置已保存"))
      .catch((error) => setMessage(errorMessage(error)))
      .finally(() => setSaving(false));
  }

  return (
    <section className="bili-settings">
      <style>{cssText}</style>
      <div className="bili-settings-tabs" role="tablist" aria-label="插件设置">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            className={tab === item.key ? "bili-settings-tab bili-settings-tab-active" : "bili-settings-tab"}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {!loaded ? <div className="bili-state bili-state-compact">正在加载设置…</div> : null}

      {loaded && tab === "player" ? (
        <div className="bili-settings-body">
          <div className="bili-settings-group">
            <div className="bili-settings-group-title">播放</div>
            <div className="bili-setting-field">
              <span>播放缓冲</span>
              <Select
                name="bufferMode"
                value={config.bufferMode}
                options={BUFFER_OPTIONS}
                onChange={(bufferMode: string) => update({ bufferMode: bufferMode as BilibiliPluginConfig["bufferMode"] })}
              />
            </div>
            <div className="bili-setting-field">
              <span>默认视频格式</span>
              <Select
                name="defaultFormat"
                value={config.defaultFormat}
                options={FORMAT_OPTIONS}
                onChange={(defaultFormat: string) => update({ defaultFormat: defaultFormat as BilibiliPluginConfig["defaultFormat"] })}
              />
            </div>
            <div className="bili-setting-field">
              <span>默认编码优先序</span>
              <Select
                name="codecPreference"
                value={config.codecPreference}
                options={CODEC_OPTIONS}
                onChange={(codecPreference: string) => update({ codecPreference: codecPreference as BilibiliPluginConfig["codecPreference"] })}
              />
            </div>
            <div className="bili-setting-field">
              <span>默认音质</span>
              <Select
                name="audioPreference"
                value={config.audioPreference}
                options={AUDIO_OPTIONS}
                onChange={(audioPreference: string) => update({ audioPreference: audioPreference as BilibiliPluginConfig["audioPreference"] })}
              />
            </div>
            <label className="bili-toggle-line">
              <Toggle on={config.autoPlay} onChange={(autoPlay: boolean) => update({ autoPlay })} />
              <span>详情页自动起播</span>
            </label>
            <label className="bili-toggle-line">
              <Toggle on={config.syncProgress} onChange={(syncProgress: boolean) => update({ syncProgress })} />
              <span>同步观看进度到 B 站</span>
            </label>
          </div>

          <div className="bili-settings-group">
            <div className="bili-settings-group-title">倍速与清晰度</div>
            <div className="bili-setting-field">
              <span>默认倍速</span>
              <Select
                name="defaultPlaybackRate"
                value={String(config.defaultPlaybackRate)}
                options={[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => ({ value: String(rate), label: `${rate}x` }))}
                onChange={(value: string) => update({ defaultPlaybackRate: Number(value) })}
              />
            </div>
            <div className="bili-setting-field">
              <span>默认清晰度模式</span>
              <Select
                name="defaultQualityMode"
                value={config.defaultQualityMode}
                options={[
                  { value: "auto", label: "自动" },
                  { value: "manual", label: "手动" },
                ]}
                onChange={(defaultQualityMode: string) =>
                  update({ defaultQualityMode: defaultQualityMode as BilibiliPluginConfig["defaultQualityMode"] })
                }
              />
            </div>
            {config.defaultQualityMode === "manual" ? (
              <div className="bili-setting-field">
                <span>默认清晰度</span>
                <Select
                  name="defaultQualityQn"
                  value={String(config.defaultQualityQn)}
                  options={[
                    { value: "0", label: "最高可用" },
                    { value: "80", label: "1080P" },
                    { value: "64", label: "720P" },
                    { value: "32", label: "480P" },
                    { value: "16", label: "360P" },
                  ]}
                  onChange={(defaultQualityQn: string) => update({ defaultQualityQn: Number(defaultQualityQn) })}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {loaded && tab === "danmaku" ? (
        <div className="bili-settings-body">
          <div className="bili-settings-group">
            <div className="bili-settings-group-title">弹幕</div>
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
          </div>
        </div>
      ) : null}

      {loaded && tab === "general" ? (
        <div className="bili-settings-body">
          <div className="bili-settings-group">
            <div className="bili-settings-group-title">侧边栏</div>
            <label className="bili-toggle-line">
              <Toggle
                on={config.sidebarAutoHide}
                onChange={(sidebarAutoHide: boolean) => update({ sidebarAutoHide })}
              />
              <span>收起后悬停展开</span>
            </label>
            <div className="bili-setting-field">
              <span>侧边栏位置</span>
              <Select
                name="sidebarPosition"
                value={config.sidebarPosition}
                options={[
                  { value: "left", label: "左侧" },
                  { value: "right", label: "右侧" },
                ]}
                onChange={(sidebarPosition: string) =>
                  update({ sidebarPosition: sidebarPosition as BilibiliPluginConfig["sidebarPosition"] })
                }
              />
            </div>
          </div>
          <div className="bili-settings-group">
            <div className="bili-settings-group-title">数据</div>
            <div className="bili-action-row">
              <Button variant="outline" size="sm" disabled={saving} type="button" onClick={clearCache}>
                清理缓存
              </Button>
              <Button variant="outline" size="sm" disabled={saving} type="button" onClick={openScreenshotFolder}>
                截图目录
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {message ? <div className="bili-state bili-state-compact">{message}</div> : null}
    </section>
  );

  function clearCache() {
    const sdk = getState().sdk;
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
    const sdk = getState().sdk;
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
