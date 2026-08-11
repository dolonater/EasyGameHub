import { errorMessage } from "../runtime";
import type { BiliVideoDetail, BiliVideoPage, PluginSdk } from "../types";

interface ProgressReporterOptions {
  sdk: PluginSdk;
  detail: BiliVideoDetail;
  page: BiliVideoPage;
  video: HTMLVideoElement;
  syncProgress: boolean;
  onProgress(seconds: number): void;
}

export interface ProgressReporterHandle {
  flush(): void;
  destroy(): void;
}

export function createProgressReporter(options: ProgressReporterOptions): ProgressReporterHandle {
  let destroyed = false;
  let lastLocalSavedAt = 0;
  let lastRemoteReportedAt = 0;
  let seekStableAt = 0;
  let lastNotifyAt = 0;

  const save = (forceRemote: boolean) => {
    if (destroyed) return;
    const progress = currentSecond(options.video);
    if (progress <= 0) return;

    const now = Date.now();
    options.onProgress(progress);
    if (forceRemote || now - lastLocalSavedAt >= 5000) {
      lastLocalSavedAt = now;
      void options.sdk.bilibili.playback.saveLocalProgress({
        bvid: options.detail.bvid,
        aid: options.detail.aid,
        cid: options.page.cid,
        progressSeconds: progress,
      });
    }

    if (!options.syncProgress) return;
    if (!forceRemote && now - lastRemoteReportedAt < 20000) return;
    if (!forceRemote && now < seekStableAt) return;
    lastRemoteReportedAt = now;
    void options.sdk.bilibili.playback
      .reportProgress({
        aid: options.detail.aid,
        cid: options.page.cid,
        progress,
      })
      .then((result) => {
        if (!result.ok && result.message !== "notLoggedIn") notifyOnce(result.message || "观看进度同步失败");
      })
      .catch((error) => notifyOnce(errorMessage(error)));
  };

  const onTimeUpdate = () => save(false);
  const onSeeking = () => {
    seekStableAt = Date.now() + 3000;
  };
  const onFlush = () => save(true);
  const timer = setInterval(() => save(false), 5000);

  options.video.addEventListener("timeupdate", onTimeUpdate);
  options.video.addEventListener("seeking", onSeeking);
  options.video.addEventListener("pause", onFlush);
  options.video.addEventListener("ended", onFlush);

  function notifyOnce(message: string) {
    const now = Date.now();
    if (now - lastNotifyAt < 60000) return;
    lastNotifyAt = now;
    options.sdk.ui.notify(message || "观看进度同步失败");
  }

  return {
    flush() {
      save(true);
    },
    destroy() {
      if (destroyed) return;
      clearInterval(timer);
      options.video.removeEventListener("timeupdate", onTimeUpdate);
      options.video.removeEventListener("seeking", onSeeking);
      options.video.removeEventListener("pause", onFlush);
      options.video.removeEventListener("ended", onFlush);
      save(true);
      destroyed = true;
    },
  };
}

function currentSecond(video: HTMLVideoElement) {
  if (video.readyState < 1 || !Number.isFinite(video.currentTime)) return 0;
  if (Number.isFinite(video.duration) && video.duration > 30 && video.currentTime >= video.duration - 30) return 0;
  return Math.max(0, Math.floor(video.currentTime));
}
