import React, { Button, Icon, Select, Slider, Toggle, useEffect, useState } from "sdk";
import { defaultConfig, errorMessage, getState, loadConfig, saveConfig } from "../runtime";
import type { BilibiliPluginConfig } from "../runtime";
import { cssText } from "../styles";

type SettingsTab = "player" | "danmaku" | "general";

const TABS: Array<{ key: SettingsTab; label: string; icon: string }> = [
  { key: "player", label: "播放器", icon: "playFilled" },
  { key: "danmaku", label: "弹幕", icon: "playlistFilled" },
  { key: "general", label: "通用", icon: "settings" },
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

interface ToastState {
  kind: "success" | "error";
  text: string;
}

/**
 * 插件内设置页（P9 优化）：左侧 tab 导航 + 分组玻璃卡片，
 * 设置项 = 图标 + 名称 + 描述 + 控件，右上角浮动 toast 保存反馈。
 */
export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>("player");
  const [config, setConfig] = useState<BilibiliPluginConfig>(defaultConfig);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

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
          showToast("error", errorMessage(error));
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
    void saveConfig(merged)
      .then(() => showToast("success", "设置已保存"))
      .catch((error) => showToast("error", errorMessage(error)))
      .finally(() => setSaving(false));
  }

  function showToast(kind: "success" | "error", text: string) {
    setToast({ kind, text });
  }

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <section className="bili-settings">
      <style>{cssText}</style>
      <div className="bili-settings-layout">
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
              <Icon name={item.icon as any} size={15} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div className="bili-settings-content">
          {!loaded ? <div className="bili-state bili-state-compact">正在加载设置…</div> : null}

          {loaded && tab === "player" ? (
            <div className="bili-settings-body">
              <div className="bili-settings-group">
                <div className="bili-settings-group-title">播放</div>
                <SettingRow
                  icon="playtime"
                  label="播放缓冲"
                  description="缓冲档位，越大越流畅但起播稍慢"
                  control={
                    <Select
                      name="bufferMode"
                      value={config.bufferMode}
                      options={BUFFER_OPTIONS}
                      onChange={(bufferMode: string) =>
                        update({ bufferMode: bufferMode as BilibiliPluginConfig["bufferMode"] })
                      }
                    />
                  }
                />
                <SettingRow
                  icon="drive"
                  label="默认视频格式"
                  description="DASH 优先；兼容模式下使用 MP4 直链"
                  control={
                    <Select
                      name="defaultFormat"
                      value={config.defaultFormat}
                      options={FORMAT_OPTIONS}
                      onChange={(defaultFormat: string) =>
                        update({ defaultFormat: defaultFormat as BilibiliPluginConfig["defaultFormat"] })
                      }
                    />
                  }
                />
                <SettingRow
                  icon="chartLine"
                  label="默认编码优先序"
                  description="优先使用的视频编码，失败自动降级 AVC"
                  control={
                    <Select
                      name="codecPreference"
                      value={config.codecPreference}
                      options={CODEC_OPTIONS}
                      onChange={(codecPreference: string) =>
                        update({ codecPreference: codecPreference as BilibiliPluginConfig["codecPreference"] })
                      }
                    />
                  }
                />
                <SettingRow
                  icon="speaker"
                  label="默认音质"
                  description="FLAC 需要大会员，不支持时自动降级 AAC"
                  control={
                    <Select
                      name="audioPreference"
                      value={config.audioPreference}
                      options={AUDIO_OPTIONS}
                      onChange={(audioPreference: string) =>
                        update({ audioPreference: audioPreference as BilibiliPluginConfig["audioPreference"] })
                      }
                    />
                  }
                />
                <SettingRow
                  icon="playFilled"
                  label="详情页自动起播"
                  description="进入视频详情页后自动开始播放"
                  control={<Toggle on={config.autoPlay} onChange={(autoPlay: boolean) => update({ autoPlay })} />}
                />
                <SettingRow
                  icon="cloudUpload"
                  label="同步观看进度到 B 站"
                  description="将本地播放进度写回 B 站账号"
                  control={
                    <Toggle on={config.syncProgress} onChange={(syncProgress: boolean) => update({ syncProgress })} />
                  }
                />
              </div>

              <div className="bili-settings-group">
                <div className="bili-settings-group-title">倍速与清晰度</div>
                <SettingRow
                  icon="repeat"
                  label="默认倍速"
                  description="打开视频时使用的播放速度"
                  control={
                    <Select
                      name="defaultPlaybackRate"
                      value={String(config.defaultPlaybackRate)}
                      options={[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => ({
                        value: String(rate),
                        label: `${rate}x`,
                      }))}
                      onChange={(value: string) => update({ defaultPlaybackRate: Number(value) })}
                    />
                  }
                />
                <SettingRow
                  icon="eye"
                  label="默认清晰度模式"
                  description="自动跟随网速切换；手动固定目标清晰度"
                  control={
                    <Select
                      name="defaultQualityMode"
                      value={config.defaultQualityMode}
                      options={[
                        { value: "auto", label: "自动" },
                        { value: "manual", label: "手动" },
                      ]}
                      onChange={(defaultQualityMode: string) =>
                        update({
                          defaultQualityMode: defaultQualityMode as BilibiliPluginConfig["defaultQualityMode"],
                        })
                      }
                    />
                  }
                />
                {config.defaultQualityMode === "manual" ? (
                  <SettingRow
                    icon="fullscreen"
                    label="默认清晰度"
                    description="手动模式下的目标清晰度上限"
                    control={
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
                    }
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          {loaded && tab === "danmaku" ? (
            <div className="bili-settings-body">
              <div className="bili-settings-group">
                <div className="bili-settings-group-title">弹幕</div>
                <SettingRow
                  icon="playlistFilled"
                  label="默认显示弹幕"
                  description="打开视频时是否自动加载弹幕"
                  control={
                    <Toggle
                      on={config.danmakuEnabled}
                      onChange={(danmakuEnabled: boolean) => update({ danmakuEnabled })}
                    />
                  }
                />
                <SettingRow
                  icon="edit"
                  label="弹幕字号"
                  description={`当前 ${config.danmakuFontSize}px`}
                  control={
                    <Slider
                      max={32}
                      min={16}
                      step={1}
                      value={config.danmakuFontSize}
                      onChange={(danmakuFontSize: number) => update({ danmakuFontSize })}
                    />
                  }
                />
                <SettingRow
                  icon="themeAlt"
                  label="弹幕透明度"
                  description={`当前 ${Math.round(config.danmakuOpacity * 100)}%`}
                  control={
                    <Slider
                      max={1}
                      min={0.2}
                      step={0.05}
                      value={config.danmakuOpacity}
                      onChange={(danmakuOpacity: number) => update({ danmakuOpacity })}
                    />
                  }
                />
                <SettingRow
                  icon="grid"
                  label="弹幕密度"
                  description={`当前 ${Math.round(config.danmakuDensity * 100)}%`}
                  control={
                    <Slider
                      max={1}
                      min={0.25}
                      step={0.05}
                      value={config.danmakuDensity}
                      onChange={(danmakuDensity: number) => update({ danmakuDensity })}
                    />
                  }
                />
                <SettingRow
                  icon="skipForwardFilled"
                  label="弹幕速度"
                  description={`当前 ${config.danmakuSpeed.toFixed(1)}x`}
                  control={
                    <Slider
                      max={1.8}
                      min={0.6}
                      step={0.1}
                      value={config.danmakuSpeed}
                      onChange={(danmakuSpeed: number) => update({ danmakuSpeed })}
                    />
                  }
                />
              </div>
            </div>
          ) : null}

          {loaded && tab === "general" ? (
            <div className="bili-settings-body">
              <div className="bili-settings-group">
                <div className="bili-settings-group-title">侧边栏</div>
                <SettingRow
                  icon="pin"
                  label="收起后悬停展开"
                  description="侧边栏收起为窄条，鼠标悬停时自动展开"
                  control={
                    <Toggle
                      on={config.sidebarAutoHide}
                      onChange={(sidebarAutoHide: boolean) => update({ sidebarAutoHide })}
                    />
                  }
                />
                <SettingRow
                  icon="arrowLeft"
                  label="侧边栏位置"
                  description="导航栏显示在窗口左侧或右侧"
                  control={
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
                  }
                />
              </div>
              <div className="bili-settings-group">
                <div className="bili-settings-group-title">数据</div>
                <SettingRow
                  icon="trash"
                  label="清理缓存"
                  description="清除封面与数据缓存，释放磁盘空间"
                  control={
                    <Button variant="outline" size="sm" disabled={saving} type="button" onClick={clearCache}>
                      清理
                    </Button>
                  }
                />
                <SettingRow
                  icon="screenshots"
                  label="截图目录"
                  description="打开截图保存位置"
                  control={
                    <Button variant="outline" size="sm" disabled={saving} type="button" onClick={openScreenshotFolder}>
                      打开
                    </Button>
                  }
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {toast ? (
        <div className={`bili-settings-toast bili-settings-toast-${toast.kind}`} role="status">
          <Icon name={toast.kind === "success" ? "success" : "error"} size={15} />
          <span>{toast.text}</span>
        </div>
      ) : null}
    </section>
  );

  function clearCache() {
    const sdk = getState().sdk;
    if (!sdk) return;
    setSaving(true);
    void sdk.bilibili.cache
      .clearCache()
      .then((count) => showToast("success", `已清理 ${count} 个缓存文件`))
      .catch((error) => showToast("error", errorMessage(error)))
      .finally(() => setSaving(false));
  }

  function openScreenshotFolder() {
    const sdk = getState().sdk;
    if (!sdk) return;
    setSaving(true);
    void sdk.bilibili.cache
      .openScreenshotFolder()
      .then(() => showToast("success", "截图目录已打开"))
      .catch((error) => showToast("error", errorMessage(error)))
      .finally(() => setSaving(false));
  }
}

/** 设置项行：图标 + 名称 + 描述 + 控件（右对齐）。 */
function SettingRow({
  icon,
  label,
  description,
  control,
}: {
  icon: string;
  label: string;
  description: string;
  control: any;
}) {
  return (
    <div className="bili-setting-row">
      <span className="bili-setting-row-icon">
        <Icon name={icon as any} size={16} />
      </span>
      <span className="bili-setting-row-text">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <span className="bili-setting-row-control">{control}</span>
    </div>
  );
}
