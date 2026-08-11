import dashjs from "dashjs";
import type { BiliQualityOption } from "../types";

export type QualityMode = "auto" | "manual";

export interface DashPlayerState {
  mode: QualityMode;
  selectedQualityId: string;
  currentQualityId: string;
  error: string;
}

export interface DashPlayerHandle {
  destroy(): void;
  setAutoQuality(): void;
  setManualQuality(representationId: string): void;
  getCurrentQuality(): string;
  setPlaybackRate(rate: number): void;
}

interface DashPlayerOptions {
  qualities: BiliQualityOption[];
  startTime: number;
  onStateChange(state: Partial<DashPlayerState>): void;
}

type DashBitrateInfo = {
  bitrate?: number;
  width?: number;
  height?: number;
  qualityIndex?: number;
  id?: string;
};

export function createDashPlayer(
  video: HTMLVideoElement,
  manifestUrl: string,
  options: DashPlayerOptions,
): DashPlayerHandle {
  const player = dashjs.MediaPlayer().create();
  let mode: QualityMode = "auto";
  let selectedQualityId = "";
  let currentQualityId = "";

  const emitState = (next: Partial<DashPlayerState>) => {
    options.onStateChange(next);
  };

  const readCurrentQuality = () => {
    const index = player.getQualityFor("video");
    currentQualityId = qualityIdForIndex(player, options.qualities, index);
    emitState({ currentQualityId });
    return currentQualityId;
  };

  const onStreamInitialized = () => {
    readCurrentQuality();
  };

  const onQualityRendered = () => {
    readCurrentQuality();
  };

  const onError = (event: unknown) => {
    emitState({ error: dashErrorMessage(event) });
  };

  player.updateSettings({
    streaming: {
      abr: {
        autoSwitchBitrate: {
          video: true,
        },
      },
      buffer: {
        fastSwitchEnabled: true,
      },
    },
  });

  player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, onStreamInitialized);
  player.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, onQualityRendered);
  player.on(dashjs.MediaPlayer.events.ERROR, onError);
  player.initialize(video, manifestUrl, false, options.startTime > 0 ? options.startTime : undefined);

  return {
    destroy() {
      player.off(dashjs.MediaPlayer.events.STREAM_INITIALIZED, onStreamInitialized);
      player.off(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, onQualityRendered);
      player.off(dashjs.MediaPlayer.events.ERROR, onError);
      player.pause();
      player.reset();
    },
    setAutoQuality() {
      mode = "auto";
      selectedQualityId = "";
      player.updateSettings({
        streaming: {
          abr: {
            autoSwitchBitrate: {
              video: true,
            },
          },
        },
      });
      emitState({ mode, selectedQualityId, currentQualityId: readCurrentQuality(), error: "" });
    },
    setManualQuality(representationId: string) {
      const qualityIndex = qualityIndexForId(player, options.qualities, representationId);
      if (qualityIndex < 0) {
        emitState({ error: "未找到对应清晰度" });
        return;
      }
      mode = "manual";
      selectedQualityId = representationId;
      player.updateSettings({
        streaming: {
          abr: {
            autoSwitchBitrate: {
              video: false,
            },
          },
        },
      });
      player.setQualityFor("video", qualityIndex, true);
      emitState({ mode, selectedQualityId, currentQualityId: readCurrentQuality(), error: "" });
    },
    getCurrentQuality() {
      return readCurrentQuality();
    },
    setPlaybackRate(rate: number) {
      player.setPlaybackRate(rate);
    },
  };
}

function qualityIndexForId(
  player: dashjs.MediaPlayerClass,
  qualities: BiliQualityOption[],
  representationId: string,
) {
  const bitrates = player.getBitrateInfoListFor("video") as DashBitrateInfo[];
  const exact = bitrates.find((item) => item.id === representationId);
  if (typeof exact?.qualityIndex === "number") return exact.qualityIndex;

  const byOptionIndex = qualities.findIndex((quality) => quality.id === representationId);
  if (byOptionIndex >= 0) {
    const option = qualities[byOptionIndex];
    const byShape = bitrates.find((item) => sameShape(item, option));
    if (typeof byShape?.qualityIndex === "number") return byShape.qualityIndex;
    if (byShape) return bitrates.indexOf(byShape);
    return byOptionIndex;
  }

  const parsed = Number(representationId);
  return Number.isInteger(parsed) ? parsed : -1;
}

function qualityIdForIndex(
  player: dashjs.MediaPlayerClass,
  qualities: BiliQualityOption[],
  qualityIndex: number,
) {
  const bitrates = player.getBitrateInfoListFor("video") as DashBitrateInfo[];
  const bitrate = bitrates.find((item) => item.qualityIndex === qualityIndex) ?? bitrates[qualityIndex];
  if (!bitrate) return "";
  const exact = qualities.find((quality) => quality.id === bitrate.id);
  if (exact) return exact.id;
  return qualities.find((quality) => sameShape(bitrate, quality))?.id ?? String(qualityIndex);
}

function sameShape(bitrate: DashBitrateInfo, quality: BiliQualityOption) {
  const sameSize =
    (!quality.width || bitrate.width === quality.width) && (!quality.height || bitrate.height === quality.height);
  const sameBandwidth =
    !quality.bandwidth || !bitrate.bitrate || Math.abs(bitrate.bitrate - quality.bandwidth) <= 4096;
  return sameSize && sameBandwidth;
}

function dashErrorMessage(event: unknown) {
  const payload = event as {
    error?: { message?: string | null; code?: number | null };
    message?: string;
  };
  const message = payload.error?.message || payload.message;
  const code = payload.error?.code;
  return code ? `DASH 播放错误 ${code}: ${message || "未知错误"}` : `DASH 播放错误: ${message || "未知错误"}`;
}
