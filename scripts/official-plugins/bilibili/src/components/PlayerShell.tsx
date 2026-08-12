import React, { Button, useCallback, useEffect, useRef, useState } from "sdk";
import type {
  BiliDanmakuItem,
  BiliPlaybackSource,
  BiliQualityOption,
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
import { QualityMenu, qualityText } from "./QualityMenu";
import { VideoInteractionBar } from "./VideoInteractionBar";
import { VideoPlayerControls } from "./VideoPlayerControls";

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
  autoPlay?: boolean;
  bufferMode?: "auto" | "small" | "medium" | "large";
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
  onReport(): void;
  onPlaybackTime(cid: number, seconds: number): void;
  onTimeUpdate?(seconds: number): void;
  onReloadPlayback(): void;
  onPlaybackFallback(wasDirect: boolean): void;
  playbackMode: "quality" | "compat";
  onPlaybackModeChange(mode: "quality" | "compat"): void;
  /** 默认清晰度模式（设置页）：manual 时开局锁定清晰度 */
  qualityMode?: "auto" | "manual";
  /** manual 时的目标 qn（0 = 最高可用） */
  qualityQn?: number;
  onDanmakuSettingsChange(settings: DanmakuSettings): void;
  onDanmakuSent(item: BiliDanmakuItem): void;
  /** 自己发送的弹幕（id → 发送时间戳秒），5 分钟窗口内可点击操作。 */
  selfDanmaku?: Map<string, number>;
  /** 自己弹幕撤回成功后回调（上层从列表移除）。 */
  onDanmakuRecalled?(id: string): void;
  /** 视频笔记入口（P8）：详情面板显示"笔记"按钮 */
  onOpenNotes?(): void;
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
  autoPlay = true,
  bufferMode = "auto",
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
  onReport,
  onPlaybackTime,
  onTimeUpdate,
  onReloadPlayback,
  onPlaybackFallback,
  playbackMode,
  onPlaybackModeChange,
  qualityMode = "auto",
  qualityQn = 0,
  onDanmakuSettingsChange,
  onDanmakuSent,
  selfDanmaku,
  onDanmakuRecalled,
  commentsPanel,
  onOpenNotes,
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
  // 真实时长：video.duration 在 MPD 毫秒值格式下可能偏大（dashjs 不修正），
  // 用 selectedPage.duration（后端换算好的秒）保证进度条/时间显示正确
  const selectedPageRef = useRef(selectedPage);
  selectedPageRef.current = selectedPage;
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(defaultPlaybackRate);
  const [fullscreen, setFullscreen] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [danmakuOpen, setDanmakuOpen] = useState(false);
  const [hovering, setHovering] = useState(false);
  // 分段弹幕加载驱动：timeupdate 时把当前播放时间转发给上层（ref 模式避免闭包过期）
  const onTimeUpdateRef = useRef(onTimeUpdate);
  onTimeUpdateRef.current = onTimeUpdate;

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
    const page = selectedPageRef.current;
    const realDuration =
      page && page.duration > 0 ? page.duration : Number.isFinite(video.duration) ? video.duration : 0;
    setDuration(realDuration);
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
      if (autoPlay) {
        video.play().catch(() => {});
      }
      return () => {
        rememberTime();
        video.removeEventListener("loadedmetadata", onLoadedMetadata);
        video.removeAttribute("src");
        video.load();
      };
    }

    // data: URI 内嵌 MPD（manifest 零往返，参考 bili-rust）；manifest_url 兜底
    const manifestUri = playback.manifest
      ? `data:application/dash+xml;charset=utf-8,${encodeURIComponent(playback.manifest)}`
      : playback.manifestUrl;
    const player = createDashPlayer(video, manifestUri, {
      qualities: playback.qualities,
      startTime,
      autoPlay,
      bufferMode,
      initialMode: qualityMode === "manual" ? "manual" : undefined,
      initialQualityId: qualityMode === "manual" ? initialQualityFor(playback.qualities, qualityQn) : undefined,
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
  }, [playback?.directUrl, playback?.manifestUrl, playback?.playbackId, qualityMode, qualityQn, syncVideoState]);

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
    const onVideoTimeUpdate = () => {
      onTimeUpdateRef.current?.(videoRef.current?.currentTime ?? 0);
    };
    video.addEventListener("timeupdate", onVideoTimeUpdate);
    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onError);
    return () => {
      events.forEach((eventName) => video.removeEventListener(eventName, syncVideoState));
      video.removeEventListener("timeupdate", onVideoTimeUpdate);
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
  const controlsVisible = hovering || !isPlaying || !canControl || qualityOpen || danmakuOpen;

  function qualityLabel() {
    if (playbackMode === "compat") return "兼容";
    if (dashState.mode === "manual" && dashState.selectedQualityId) {
      const quality = playback?.qualities.find((item) => item.id === dashState.selectedQualityId);
      return quality ? qualityText(quality) : "手动";
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
      <div
        className={`bili-player-shell ${fullscreen ? "bili-player-shell-fullscreen" : ""}`}
        ref={shellRef}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <video className="bili-video-element" playsInline ref={videoRef} />
        <DanmakuOverlay
          items={danmakuItems}
          settings={danmakuSettings}
          videoRef={videoRef}
          sdk={sdk}
          cid={selectedPage?.cid ?? 0}
          selfDanmaku={selfDanmaku}
          onRecalled={onDanmakuRecalled}
        />

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

        <VideoPlayerControls
          canControl={canControl}
          currentTime={currentTime}
          danmakuEnabled={danmakuSettings.enabled}
          danmakuTriggerRef={danmakuTriggerRef}
          detail={detail}
          duration={duration}
          isPlaying={isPlaying}
          muted={muted}
          onSeek={seek}
          onChangeRate={changeRate}
          onChangeVolume={changeVolume}
          onToggleDanmaku={toggleDanmaku}
          onToggleFullscreen={toggleFullscreen}
          onToggleMute={toggleMute}
          onTogglePlay={togglePlay}
          onToggleQuality={toggleQuality}
          qualityLabel={qualityLabel()}
          qualityTriggerRef={qualityTriggerRef}
          rate={rate}
          rates={playbackRates}
          sdk={sdk}
          selectedPage={selectedPage}
          videoRef={videoRef}
          visible={controlsVisible}
          volume={volume}
        />

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
              onManual={(id: string) => {
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

      <section className="bili-video-detail-panel">
        <div className="bili-video-heading">
          <strong>{detail.title || "Untitled"}</strong>
          <small>
            {detail.owner.name || "未知 UP 主"} · {formatCount(detail.stats.viewCount)} 播放 ·{" "}
            {formatCount(detail.stats.danmakuCount)} 弹幕
            {onOpenNotes ? (
              <button type="button" className="bili-video-notes-btn" onClick={onOpenNotes}>
                笔记
              </button>
            ) : null}
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
}

function formatCount(value: number) {
  if (value >= 100000000) return `${trim(value / 100000000)}亿`;
  if (value >= 10000) return `${trim(value / 10000)}万`;
  return String(Math.max(0, Math.floor(value || 0)));
}

function trim(value: number) {
  return value.toFixed(value >= 10 ? 0 : 1).replace(/\.0$/, "");
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


/** 默认清晰度目标：qn>0 时取 ≤qn 的最高轨；qn=0 时取全部里最高轨（最高可用）。 */
function initialQualityFor(qualities: BiliQualityOption[], qn: number): string {
  const candidates =
    qn > 0 ? qualities.filter((quality) => quality.quality <= qn) : qualities;
  const sorted = [...candidates].sort((a, b) => b.quality - a.quality);
  return sorted[0]?.id ?? "";
}
