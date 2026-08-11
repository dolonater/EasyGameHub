import React, { Button, Slider, Toggle, useCallback, useEffect, useRef, useState } from "sdk";
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
import { QualityMenu } from "./QualityMenu";
import { ScreenshotButton } from "./ScreenshotButton";
import { VideoInteractionBar } from "./VideoInteractionBar";
import { VideoOwnerRow } from "./VideoOwnerRow";
import { WatchSidebarTabs } from "./WatchSidebarTabs";

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
  onSelectPage(page: BiliVideoPage): void;
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
  onSelectPage,
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
  const [moreNonce, setMoreNonce] = useState(0);

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

  const toggleDanmaku = useCallback(() => {
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
      onDanmakuToggle: toggleDanmaku,
      onChange: syncVideoState,
    });
  }, [syncVideoState, toggleDanmaku, toggleFullscreen]);

  const playbackError = mediaError || dashState.error || error;
  const canControl = Boolean(playback && !loadingPlayback && !playbackError);
  const defaultSidebarTab = detail.pages.length > 1 ? "pages" : "quality";
  const pagesPanel = (
    <section className="bili-sidebar-section">
      <div className="bili-section-title">
        <strong>分 P</strong>
        <small>{detail.pages.length} 个</small>
      </div>
      <div className="bili-page-list">
        {detail.pages.map((page) => (
          <button
            className={`bili-page-item ${selectedPage?.cid === page.cid ? "bili-page-item-active" : ""}`}
            key={page.cid}
            type="button"
            onClick={() => {
              rememberTime();
              reporterRef.current?.flush();
              onSelectPage(page);
            }}
          >
            <span>{page.page}. {page.title || `CID ${page.cid}`}</span>
            <small>{formatDuration(page.duration)}</small>
          </button>
        ))}
      </div>
    </section>
  );
  const qualityPanel = (
    <section className="bili-sidebar-section">
      <QualityMenu
        currentQualityId={dashState.currentQualityId}
        disabled={!playerRef.current || loadingPlayback}
        mode={dashState.mode}
        playbackMode={playbackMode}
        qualities={playback?.qualities ?? []}
        selectedQualityId={dashState.selectedQualityId}
        onAuto={() => playerRef.current?.setAutoQuality()}
        onManual={(id) => playerRef.current?.setManualQuality(id)}
        onPlaybackModeChange={onPlaybackModeChange}
      />
      {error ? <div className="bili-state bili-state-error bili-state-compact">{error}</div> : null}
    </section>
  );
  const danmakuPanel = (
    <section className="bili-sidebar-section">
      <div className="bili-danmaku-settings">
        <div className="bili-section-title">
          <strong>弹幕</strong>
          <small>{danmakuLoading ? "加载中" : `${danmakuItems.length} 条`}</small>
        </div>
        {danmakuError ? <div className="bili-state bili-state-error bili-state-compact">{danmakuError}</div> : null}
        <label className="bili-toggle-line">
          <Toggle
            on={danmakuSettings.enabled}
            onChange={(enabled: boolean) => onDanmakuSettingsChange({ ...danmakuSettings, enabled })}
          />
          <span>显示弹幕</span>
        </label>
        <label className="bili-slider-line">
          <span>字号 {danmakuSettings.fontSize}px</span>
          <Slider
            max={32}
            min={16}
            step={1}
            value={danmakuSettings.fontSize}
            onChange={(fontSize: number) => onDanmakuSettingsChange({ ...danmakuSettings, fontSize })}
          />
        </label>
        <label className="bili-slider-line">
          <span>透明度 {Math.round(danmakuSettings.opacity * 100)}%</span>
          <Slider
            max={1}
            min={0.2}
            step={0.05}
            value={danmakuSettings.opacity}
            onChange={(opacity: number) => onDanmakuSettingsChange({ ...danmakuSettings, opacity })}
          />
        </label>
        <label className="bili-slider-line">
          <span>密度 {Math.round(danmakuSettings.density * 100)}%</span>
          <Slider
            max={1}
            min={0.25}
            step={0.05}
            value={danmakuSettings.density}
            onChange={(density: number) => onDanmakuSettingsChange({ ...danmakuSettings, density })}
          />
        </label>
        <label className="bili-slider-line">
          <span>速度 {danmakuSettings.speed.toFixed(1)}x</span>
          <Slider
            max={1.8}
            min={0.6}
            step={0.1}
            value={danmakuSettings.speed}
            onChange={(speed: number) => onDanmakuSettingsChange({ ...danmakuSettings, speed })}
          />
        </label>
      </div>
    </section>
  );
  const morePanel = (
    <section className="bili-sidebar-section">
      <div className="bili-section-title">
        <strong>更多</strong>
        <small>{loggedIn ? "已登录" : "部分功能需登录"}</small>
      </div>
      <div className="bili-action-row">
        <Button variant="outline" size="sm" type="button" onClick={openExternal}>
          外部打开
        </Button>
        <Button variant="outline" size="sm" type="button" onClick={onShare}>
          复制链接
        </Button>
        <Button variant="outline" size="sm" type="button" onClick={openScreenshotFolder}>
          截图目录
        </Button>
      </div>
    </section>
  );

  return (
    <section className="bili-watch-grid">
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
            <button className="bili-player-icon-button" disabled={!canControl} type="button" onClick={togglePlay}>
              {isPlaying ? "暂停" : "播放"}
            </button>
            <span className="bili-player-time">{formatDuration(currentTime)}</span>
            <input
              aria-label="播放进度"
              className="bili-player-seek"
              disabled={!canControl || duration <= 0}
              max={Math.max(1, duration)}
              min="0"
              step="0.1"
              type="range"
              value={Math.min(currentTime, Math.max(1, duration))}
              onChange={(event) => seek(Number(event.currentTarget.value))}
            />
            <span className="bili-player-time">{formatDuration(duration)}</span>
            <button className="bili-player-icon-button" disabled={!canControl} type="button" onClick={toggleMute}>
              {muted || volume === 0 ? "静音" : "音量"}
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
              onChange={(event) => changeVolume(Number(event.currentTarget.value))}
            />
            <select
              aria-label="倍速"
              className="bili-player-rate"
              disabled={!canControl}
              value={rate}
              onChange={(event) => changeRate(Number(event.currentTarget.value))}
            >
              {playbackRates.map((value) => (
                <option key={value} value={value}>
                  {value}x
                </option>
              ))}
            </select>
            <button className="bili-player-icon-button" disabled={!canControl} type="button" onClick={toggleFullscreen}>
              {fullscreen ? "退出" : "全屏"}
            </button>
            <ScreenshotButton
              detail={detail}
              disabled={!canControl}
              sdk={sdk}
              selectedPage={selectedPage}
              videoRef={videoRef}
            />
          </div>
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
          onMore={() => setMoreNonce((value) => value + 1)}
          onReport={onReport}
          onShare={onShare}
          onToView={onToView}
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
      </div>

      <WatchSidebarTabs
        commentsPanel={commentsPanel}
        danmakuPanel={danmakuPanel}
        defaultTab={defaultSidebarTab}
        focusMoreNonce={moreNonce}
        morePanel={morePanel}
        pagesCount={detail.pages.length}
        pagesPanel={pagesPanel}
        qualityPanel={qualityPanel}
      />
    </section>
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
