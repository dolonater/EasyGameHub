import React, { Icon } from "sdk";
import type { BiliVideoDetail, BiliVideoPage, PluginSdk } from "../types";
import { ScreenshotButton } from "./ScreenshotButton";

interface VideoPlayerControlsProps {
  canControl: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  rate: number;
  rates: number[];
  danmakuEnabled: boolean;
  qualityLabel: string;
  /** hover 播放器 / 暂停 / 加载错误 / 弹层打开时为 true，控制栏常显；否则淡出 */
  visible: boolean;
  sdk: PluginSdk | null;
  detail: BiliVideoDetail;
  selectedPage: BiliVideoPage | null;
  videoRef: { current: HTMLVideoElement | null };
  qualityTriggerRef: { current: HTMLButtonElement | null };
  danmakuTriggerRef: { current: HTMLButtonElement | null };
  onTogglePlay(): void;
  onSeek(seconds: number): void;
  onToggleMute(): void;
  onChangeVolume(volume: number): void;
  onChangeRate(rate: number): void;
  onToggleQuality(): void;
  onToggleDanmaku(): void;
  onToggleFullscreen(): void;
}

/**
 * 播放器控制栏（共享组件）。样式参考 animotion/视频控制栏：
 * 圆形图标按钮、细进度条、hover 显示控件。
 */
export function VideoPlayerControls({
  canControl,
  isPlaying,
  currentTime,
  duration,
  volume,
  muted,
  rate,
  rates,
  danmakuEnabled,
  qualityLabel,
  visible,
  sdk,
  detail,
  selectedPage,
  videoRef,
  qualityTriggerRef,
  danmakuTriggerRef,
  onTogglePlay,
  onSeek,
  onToggleMute,
  onChangeVolume,
  onChangeRate,
  onToggleQuality,
  onToggleDanmaku,
  onToggleFullscreen,
}: VideoPlayerControlsProps) {
  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const seekStyle = { "--progress": `${progress}%` } as Record<string, string>;

  return (
    <div className={`bili-player-controls ${visible ? "" : "bili-player-controls-hidden"}`}>
      <div className="bili-player-playbar">
        <input
          aria-label="播放进度"
          className="bili-player-seek"
          disabled={!canControl || duration <= 0}
          max={Math.max(1, duration)}
          min="0"
          step="0.1"
          style={seekStyle}
          type="range"
          value={Math.min(currentTime, Math.max(1, duration))}
          onChange={(event: any) => onSeek(Number(event.currentTarget.value))}
        />
        <span className="bili-player-time">{formatDuration(currentTime)}</span>
        <span className="bili-player-time">{formatDuration(duration)}</span>
      </div>
      <div className="bili-player-controls-row">
        <button
          className="bili-ctrl-btn"
          disabled={!canControl}
          title={isPlaying ? "暂停" : "播放"}
          type="button"
          onClick={onTogglePlay}
        >
          <Icon name={isPlaying ? "pauseFilled" : "playFilled"} size={18} />
        </button>
        <button
          className="bili-ctrl-btn"
          disabled={!canControl}
          title={muted || volume === 0 ? "取消静音" : "静音"}
          type="button"
          onClick={onToggleMute}
        >
          <Icon name={muted || volume === 0 ? "speakerMute" : "speaker"} size={18} />
        </button>
        <input
          aria-label="音量"
          className="bili-player-volume"
          disabled={!canControl}
          max="1"
          min="0"
          step="0.01"
          type="range"
          value={muted ? 0 : volume}
          onChange={(event: any) => onChangeVolume(Number(event.currentTarget.value))}
        />
        <span className="bili-player-rate-wrap">
          <select
            aria-label="倍速"
            className="bili-player-rate"
            disabled={!canControl}
            value={rate}
            onChange={(event: any) => onChangeRate(Number(event.currentTarget.value))}
          >
            {rates.map((value) => (
              <option key={value} value={value}>
                {value}x
              </option>
            ))}
          </select>
        </span>
        <button
          className="bili-ctrl-btn bili-ctrl-btn-label"
          disabled={!canControl}
          ref={qualityTriggerRef}
          title="清晰度"
          type="button"
          onMouseDown={onToggleQuality}
        >
          <Icon name="settings" size={16} />
          <small>{qualityLabel}</small>
        </button>
        <button
          className="bili-ctrl-btn bili-ctrl-btn-label"
          ref={danmakuTriggerRef}
          title="弹幕"
          type="button"
          onMouseDown={onToggleDanmaku}
        >
          <Icon name="playlistFilled" size={16} />
          <small>{danmakuEnabled ? "开" : "关"}</small>
        </button>
        <ScreenshotButton detail={detail} disabled={!canControl} sdk={sdk} selectedPage={selectedPage} videoRef={videoRef} />
        <button
          className="bili-ctrl-btn"
          disabled={!canControl}
          title="全屏"
          type="button"
          onClick={onToggleFullscreen}
        >
          <Icon name="fullscreen" size={18} />
        </button>
      </div>
    </div>
  );
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const hour = Math.floor(safe / 3600);
  const minute = Math.floor((safe % 3600) / 60);
  const second = safe % 60;
  if (hour > 0) return `${hour}:${pad(minute)}:${pad(second)}`;
  return `${minute}:${pad(second)}`;
}

function pad(value: number) {
  return value.toString().padStart(2, "0");
}
