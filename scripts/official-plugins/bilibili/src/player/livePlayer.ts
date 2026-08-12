/**
 * 直播播放器（P6）：mpegts.js 封装。
 * 初始化/销毁/画质切换（qn 重建流）/错误事件。
 */
import mpegts from "mpegts.js";

export interface LivePlayerCallbacks {
  onError(message: string): void;
}

export class LivePlayer {
  private player: mpegts.Player | null = null;
  private destroyed = false;
  private readonly video: HTMLVideoElement;
  private readonly onError: (message: string) => void;

  constructor(video: HTMLVideoElement, onError: (message: string) => void) {
    this.video = video;
    this.onError = onError;
  }

  /** 播放 http-flv 流；切换画质时用新 URL 重建播放器 */
  load(url: string): void {
    if (this.destroyed) return;
    this.destroyPlayer();
    if (!mpegts.isSupported()) {
      this.onError("当前环境不支持直播播放，可尝试外部打开");
      return;
    }
    const player = mpegts.createPlayer(
      { type: "flv", isLive: true, url },
      {
        enableWorker: false,
        lazyLoad: false,
        liveBufferLatencyChasing: true,
        liveBufferLatencyMaxLatency: 3,
        liveBufferLatencyMinRemain: 1,
      },
    );
    player.on(mpegts.Events.ERROR, () => {
      this.onError("直播流播放失败，可尝试切换画质或外部打开");
    });
    player.attachMediaElement(this.video);
    player.load();
    Promise.resolve(player.play()).catch(() => {
      // 自动播放被拦截时用户可手动点击播放
      this.onError("直播播放被浏览器拦截，请点击播放");
    });
    this.player = player;
  }

  destroy(): void {
    this.destroyed = true;
    this.destroyPlayer();
  }

  private destroyPlayer(): void {
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
  }
}
