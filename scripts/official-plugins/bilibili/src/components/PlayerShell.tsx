import React, { Button, Icon, useCallback, useEffect, useRef, useState } from "sdk";
import type {
  BiliDanmakuItem,
  BiliPlaybackSource,
  BiliVideoDetail,
  BiliVideoInteractionState,
  BiliVideoPage,
  PluginSdk,
} from "../types";
import { createDashPlayer, type DashPlayerHandle, type DashPlayerState } from "../player/dashPlayer";
import { attachPlayerKeyboard } from "../player/keyboard";
import { createProgressReporter, type ProgressReporterHandle } from "../player/progressReporter";
import { errorMessage } from "../runtime";
import { DanmakuInput } from "./DanmakuInput";
import { DanmakuOverlay, type DanmakuSettings } from "./DanmakuOverlay";
import { DanmakuSettingsPopover } from "./DanmakuSettingsPopover";
import { MenuPopover } from "./MenuPopover";
import { QualityMenu } from "./QualityMenu";
import { ScreenshotButton } from "./ScreenshotButton";
import { VideoInteractionBar } from "./VideoInteractionBar";
import { VideoOwnerRow } from "./VideoOwnerRow";

interface PlayerShellProps {
  detail: BiliVideoDetail;
  sdk: PluginSdk | null;
  selectedPage: BiliVideoPage | null;
  playback: BiliPlaybackSource | null;
  loadingPlayback: boolean;
  error: string;
  startTime: number;
  defaultPlaybackRate: number;
  syncProgress: boolean;
  danmakuItems: BiliDanmakuItem[];
  danmakuLoading: boolean;
  danmakuError: string;
  danmakuSettings: DanmakuSettings;
  loggedIn: boolean;
  interactionState: BiliVideoInteractionState | null;
  interactionLoading: boolean;
  interactionError: string;
  interactionBusy: string;
  onLike(): void;
  onCoin(multiply: 1 | 2, alsoLike: boolean): void;
  onFavorite(addMediaIds: string[], delMediaIds: string[]): void;
  onShare(): void;
  onToView(): void;
  onFollowOwner(): void;
  onReport(): void;
  onPlaybackTime(cid: number, seconds: number): void;
  onReloadPlayback(): void;
  onPlaybackFallback(wasDirect: boolean): void;
  playbackMode: "quality" | "compat";
  onPlaybackModeChange(mode: "quality" | "compat"): void;
  onDanmakuSettingsChange(settings: DanmakuSettings): void;
  onDanmakuSent(item: BiliDanmakuItem): void;
  commentsPanel: any;
}

const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function PlayerShell({
  detail,
  sdk,
  selectedPage,
  playback,
  loadingPlayback,
  error,
  startTime,
  defaultPlaybackRate,
  syncProgress,
  danmakuItems,
  danmakuLoading,
  danmakuError,
  danmakuSettings,
  loggedIn,
  interactionState,
  interactionLoading,
  interactionError,
  interactionBusy,
  onLike,
  onCoin,
  onFavorite,
  onShare,
  onToView,
  onFollowOwner,
  onReport,
  onPlaybackTime,
  onReloadPlayback,
  onPlaybackFallback,
  playbackMode,
  onPlaybackModeChange,
  onDanmakuSettingsChange,
  onDanmakuSent,
  commentsPanel,
}: PlayerShellProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const qualityTriggerRef = useRef<HTMLButtonElement | null>(null);
  const danmakuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const playerRef = useRef<DashPlayerHandle | null>(null);
  const reporterRef = useRef<ProgressReporterHandle | null>(null);
  const sourceStartedAtRef = useRef(0);
  const fallbackRequestedRef = useRef(false);
  const [dashState, setDashState] = useState<DashPlayerState>({
    mode: "auto",
    selectedQualityId: "",
    currentQualityId: "",
    error: "",
  });
  const [mediaError, setMediaError] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(defaultPlaybackRate);
  const [fullscreen, setFullscreen] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [danmakuOpen, setDanmakuOpen] = useState(false);

  const rememberTime = useCallback(() => {
    const video = videoRef.current;
    if (!video || !selectedPage) return;
    if (shouldRememberTime(video)) {
      onPlaybackTime(selectedPage.cid, video.currentTime);
    }
  }, [onPlaybackTime, selectedPage]);

  const syncVideoState = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setIsPlaying(!video.paused);
    setCurrentTime(Number.isFinite(video.currentTime) ? video.currentTime : 0);
    setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    setVolume(video.volume);
    setMuted(video.muted);
    setRate(video.playbackRate || 1);
  }, []);

  const toggleFullscreen = useCallback(() => {
    setFullscreen((value) => !value);
  }, []);

  const toggleDanmakuEnabled = useCallback(() => {
    onDanmakuSettingsChange({ ...danmakuSettings, enabled: !danmakuSettings.enabled });
  }, [danmakuSettings, onDanmakuSettingsChange]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || (!playback?.manifestUrl && !playback?.directUrl)) return;

    setDashState({ mode: "auto", selectedQualityId: "", currentQualityId: "", error: "" });
    setMediaError("");
    sourceStartedAtRef.current = Date.now();
    fallbackRequestedRef.current = false;
    if (playback.directUrl) {
      const onLoadedMetadata = () => {
        if (startTime > 0 && Number.isFinite(video.duration) && startTime < video.duration - 1) {
          video.currentTime = startTime;
        }
        syncVideoState();
      };
      video.src = playback.directUrl;
      video.addEventListener("loadedmetadata", onLoadedMetadata);
      video.load();
      return () => {
        rememberTime();
        video.removeEventListener("loadedmetadata", onLoadedMetadata);
        video.removeAttribute("src");
        video.load();
      };
    }

    const player = createDashPlayer(video, playback.manifestUrl, {
      qualities: playback.qualities,
      startTime,
      onStateChange: (next) => setDashState((previous) => ({ ...previous, ...next })),
    });
    playerRef.current = player;
    player.setPlaybackRate(rate);

    return () => {
      rememberTime();
      player.destroy();
      if (playerRef.current === player) playerRef.current = null;
      video.removeAttribute("src");
      video.load();
    };
  }, [playback?.directUrl, playback?.manifestUrl, playback?.playbackId, startTime, rememberTime, syncVideoState]);

  useEffect(() => {
    if (dashState.error && playback && !playback.directUrl) {
      requestPlaybackFallback(false);
    }
  }, [dashState.error, playback?.directUrl, playback?.playbackId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!sdk || !video || !selectedPage || !playback) return;

    const reporter = createProgressReporter({
      sdk,
      detail,
      page: selectedPage,
      video,
      syncProgress,
      onProgress: (seconds) => onPlaybackTime(selectedPage.cid, seconds),
    });
    reporterRef.current = reporter;
    return () => {
      reporter.destroy();
      if (reporterRef.current === reporter) reporterRef.current = null;
    };
  }, [detail.aid, detail.bvid, playback?.playbackId, selectedPage?.cid, syncProgress]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = volume;
    video.muted = muted;
    video.playbackRate = rate;
    const onEnded = () => {
      if (Date.now() - sourceStartedAtRef.current < 8000 && shouldTreatEarlyEndAsFailure(video)) {
        requestPlaybackFallback(Boolean(playback?.directUrl));
      }
    };
    const onError = () => {
      setMediaError(videoErrorMessage(video));
      requestPlaybackFallback(Boolean(playback?.directUrl));
    };
    const events = ["play", "pause", "timeupdate", "durationchange", "volumechange", "ratechange", "loadedmetadata"];
    events.forEach((eventName) => video.addEventListener(eventName, syncVideoState));
    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onError);
    return () => {
      events.forEach((eventName) => video.removeEventListener(eventName, syncVideoState));
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onError);
      rememberTime();
    };
  }, [playback?.directUrl, rememberTime, syncVideoState]);

  useEffect(() => {
    const video = videoRef.current;
    const shell = shellRef.current;
    if (!video || !shell) return;
    return attachPlayerKeyboard({
      video,
      container: shell,
      onFullscreenToggle: toggleFullscreen,
      onDanmakuToggle: toggleDanmakuEnabled,
      onChange: syncVideoState,
    });
  }, [syncVideoState, toggleDanmakuEnabled, toggleFullscreen]);

  const playbackError = mediaError || dashState.error || error;
  const canControl = Boolean(playback && !loadingPlayback && !playbackError);

  function qualityLabel() {
    if (playbackMode === "compat") return "兼容";
    if (dashState.mode === "manual" && dashState.selectedQualityId) {
      return playback?.qualities.find((quality) => quality.id === dashState.selectedQualityId)?.label ?? "手动";
    }
    return "自动";
  }

  function toggleQuality() {
    setQualityOpen((value) => !value);
  }

  function toggleDanmaku() {
    setDanmakuOpen((value) => !value);
  }

  return (
    <div className="bili-watch-main">
      <div className={`bili-player-shell ${fullscreen ? "bili-player-shell-fullscreen" : ""}`} ref={shellRef}>
        <video className="bili-video-element" playsInline ref={videoRef} />
        <DanmakuOverlay items={danmakuItems} settings={danmakuSettings} videoRef={videoRef} />

        {loadingPlayback || !playback || playbackError ? (
          <div className="bili-player-overlay">
            <strong>{playbackError ? "播放失败" : loadingPlayback ? "正在创建播放会话" : "等待播放源"}</strong>
            {playbackError ? <span>{playbackError}</span> : null}
            {playbackError ? (
              <div className="bili-player-overlay-actions">
                <Button size="sm" type="button" onClick={onReloadPlayback}>
                  重载
                </Button>
                <Button variant="outline" size="sm" type="button" onClick={openExternal}>
                  外部打开
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="bili-player-controls">
          <div className="bili-player-controls-top">
            <input
              aria-label="播放进度"
              className="bili-player-seek"
              disabled={!canControl || duration <= 0}
              max={Math.max(1, duration)}
              min="0"
              step="0.1"
              type="range"
              value={Math.min(currentTime, Math.max(1, duration))}
              onChange={(event: any) => seek(Number(event.currentTarget.value))}
            />
            <span className="bili-player-time">{formatDuration(currentTime)}</span>
            <span className="bili-player-time">{formatDuration(duration)}</span>
          </div>
          <div className="bili-player-controls-bottom">
            <button
              className="bili-player-icon-button"
              disabled={!canControl}
              title={isPlaying ? "暂停" : "播放"}
              type="button"
              onClick={togglePlay}
            >
              <Icon name={isPlaying ? "pauseFilled" : "playFilled"} size={18} />
            </button>
            <button
              className="bili-player-icon-button"
              disabled={!canControl}
              title={muted || volume === 0 ? "取消静音" : "静音"}
              type="button"
              onClick={toggleMute}
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
              onChange={(event: any) => changeVolume(Number(event.currentTarget.value))}
            />
            <span className="bili-player-rate-wrap">
              <Icon name="playtime" size={15} />
              <select
                aria-label="倍速"
                className="bili-player-rate"
                disabled={!canControl}
                value={rate}
                onChange={(event: any) => changeRate(Number(event.currentTarget.value))}
              >
                {playbackRates.map((value) => (
                  <option key={value} value={value}>
                    {value}x
                  </option>
                ))}
              </select>
            </span>
            <button
              className="bili-player-icon-button bili-player-icon-label"
              disabled={!canControl}
              ref={qualityTriggerRef}
              title="清晰度"
              type="button"
              onMouseDown={toggleQuality}
            >
              <Icon name="settings" size={16} />
              <small>{qualityLabel()}</small>
            </button>
            <button
              className="bili-player-icon-button bili-player-icon-label"
              ref={danmakuTriggerRef}
              title="弹幕"
              type="button"
              onMouseDown={toggleDanmaku}
            >
              <Icon name="playlistFilled" size={16} />
              <small>{danmakuSettings.enabled ? "开" : "关"}</small>
            </button>
            <ScreenshotButton
              detail={detail}
              disabled={!canControl}
              sdk={sdk}
              selectedPage={selectedPage}
              videoRef={videoRef}
            />
            <button
              className="bili-player-icon-button"
              disabled={!canControl}
              title={fullscreen ? "退出全屏" : "全屏"}
              type="button"
              onClick={toggleFullscreen}
            >
              <Icon name="fullscreen" size={18} />
            </button>
          </div>
        </div>

        {qualityOpen ? (
          <MenuPopover
            onClose={() => setQualityOpen(false)}
            style={{ position: "absolute", right: 12, bottom: 80, zIndex: 50 }}
            triggerRef={qualityTriggerRef}
          >
            <QualityMenu
              currentQualityId={dashState.currentQualityId}
              disabled={!playerRef.current || loadingPlayback}
              mode={dashState.mode}
              playbackMode={playbackMode}
              qualities={playback?.qualities ?? []}
              selectedQualityId={dashState.selectedQualityId}
              onAuto={() => {
                playerRef.current?.setAutoQuality();
                setQualityOpen(false);
              }}
              onManual={(id) => {
                playerRef.current?.setManualQuality(id);
                setQualityOpen(false);
              }}
              onPlaybackModeChange={onPlaybackModeChange}
            />
          </MenuPopover>
        ) : null}

        {danmakuOpen ? (
          <DanmakuSettingsPopover
            settings={danmakuSettings}
            loading={danmakuLoading}
            count={danmakuItems.length}
            error={danmakuError}
            onChange={onDanmakuSettingsChange}
            onClose={() => setDanmakuOpen(false)}
            style={{ position: "absolute", right: 12, bottom: 80, zIndex: 50 }}
            triggerRef={danmakuTriggerRef}
          />
        ) : null}
      </div>

      <DanmakuInput
        detail={detail}
        disabled={!loggedIn}
        hidden={!danmakuSettings.enabled}
        sdk={sdk}
        selectedPage={selectedPage}
        videoRef={videoRef}
        onSent={onDanmakuSent}
      />

      <VideoInteractionBar
        busy={interactionBusy}
        loggedIn={loggedIn}
        loading={interactionLoading}
        state={interactionState}
        onCoin={onCoin}
        onFavorite={onFavorite}
        onLike={onLike}
        onShare={onShare}
        onToView={onToView}
        onReport={onReport}
        onExternalOpen={openExternal}
        onCopyLink={onShare}
        onOpenScreenshotFolder={openScreenshotFolder}
      />

      {interactionError ? <div className="bili-state bili-state-error bili-state-compact">{interactionError}</div> : null}

      <VideoOwnerRow
        busy={interactionBusy === "follow"}
        loggedIn={loggedIn}
        state={interactionState}
        onFollow={onFollowOwner}
        onOpenSpace={openOwnerSpace}
      />

      <section className="bili-video-detail-panel">
        <div className="bili-video-heading">
          <strong>{detail.title || "Untitled"}</strong>
          <small>
            {detail.owner.name || "未知 UP 主"} · {formatCount(detail.stats.viewCount)} 播放 ·{" "}
            {formatCount(detail.stats.danmakuCount)} 弹幕
          </small>
        </div>
        <p>{detail.description || "暂无简介"}</p>
      </section>

      {commentsPanel}
    </div>
  );

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) playSafely(video);
    else video.pause();
    syncVideoState();
  }

  function seek(seconds: number) {
    const video = videoRef.current;
    if (!video || !Number.isFinite(seconds)) return;
    video.currentTime = Math.max(0, seconds);
    syncVideoState();
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }

  function changeVolume(nextVolume: number) {
    const video = videoRef.current;
    if (!video || !Number.isFinite(nextVolume)) return;
    const clamped = Math.min(1, Math.max(0, nextVolume));
    video.volume = clamped;
    video.muted = clamped <= 0;
    syncVideoState();
  }

  function changeRate(nextRate: number) {
    const video = videoRef.current;
    if (!video || !Number.isFinite(nextRate)) return;
    video.playbackRate = nextRate;
    playerRef.current?.setPlaybackRate(nextRate);
    syncVideoState();
  }

  function openExternal() {
    if (!sdk) {
      window.open(`https://www.bilibili.com/video/${detail.bvid}`, "_blank");
      return;
    }
    void sdk.bilibili.video.openExternal(detail.bvid).catch((err) => {
      sdk.ui.notify(errorMessage(err));
    });
  }

  function requestPlaybackFallback(wasDirect: boolean) {
    if (fallbackRequestedRef.current) return;
    fallbackRequestedRef.current = true;
    onPlaybackFallback(wasDirect);
  }

  function openScreenshotFolder() {
    if (!sdk) return;
    void sdk.bilibili.cache.openScreenshotFolder().catch((err) => {
      sdk.ui.notify(errorMessage(err));
    });
  }

  function openOwnerSpace() {
    const mid = interactionState?.owner.mid || detail.owner.mid;
    if (!mid) return;
    window.open(`https://space.bilibili.com/${mid}`, "_blank");
  }
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const hour = Math.floor(safe / 3600);
  const minute = Math.floor((safe % 3600) / 60);
  const second = safe % 60;
  if (hour > 0) return `${hour}:${pad(minute)}:${pad(second)}`;
  return `${minute}:${pad(second)}`;
}

function formatCount(value: number) {
  if (value >= 100000000) return `${trim(value / 100000000)}亿`;
  if (value >= 10000) return `${trim(value / 10000)}万`;
  return String(Math.max(0, Math.floor(value || 0)));
}

function trim(value: number) {
  return value.toFixed(value >= 10 ? 0 : 1).replace(/\.0$/, "");
}

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function shouldRememberTime(video: HTMLVideoElement) {
  if (!Number.isFinite(video.currentTime) || video.currentTime <= 0) return false;
  if (video.readyState < 1) return false;
  if (Number.isFinite(video.duration) && video.duration > 30 && video.currentTime >= video.duration - 30) {
    return false;
  }
  return true;
}

function shouldTreatEarlyEndAsFailure(video: HTMLVideoElement) {
  if (!Number.isFinite(video.duration) || video.duration <= 30) return true;
  return video.currentTime < video.duration - 30;
}

function videoErrorMessage(video: HTMLVideoElement) {
  const code = video.error?.code;
  if (code === MediaError.MEDIA_ERR_ABORTED) return "媒体加载被中断";
  if (code === MediaError.MEDIA_ERR_NETWORK) return "媒体网络加载失败";
  if (code === MediaError.MEDIA_ERR_DECODE) return "媒体解码失败";
  if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) return "当前播放源不受支持";
  return "媒体播放失败";
}

function playSafely(video: HTMLVideoElement) {
  void video.play().catch((error) => {
    if (error instanceof DOMException && error.name === "AbortError") return;
    throw error;
  });
}
