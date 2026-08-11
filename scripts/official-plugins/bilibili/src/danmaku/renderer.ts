export interface DanmakuRenderState {
  key: string;
  text: string;
  color: string;
  track: number;
  top: number;
  durationSeconds: number;
  fontSize: number;
  opacity: number;
  expiresAt: number;
}

export function createDanmakuStyle(item: DanmakuRenderState) {
  return {
    "--bili-danmaku-top": `${item.top}px`,
    "--bili-danmaku-duration": `${item.durationSeconds}s`,
    color: item.color || "#ffffff",
    fontSize: `${item.fontSize}px`,
    opacity: item.opacity,
  } as Record<string, string | number>;
}

export function durationForSpeed(speed: number) {
  const safeSpeed = Math.min(1.8, Math.max(0.6, speed || 1));
  return Math.max(4.5, Math.min(14, 8.5 / safeSpeed));
}
