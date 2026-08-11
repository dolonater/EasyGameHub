export interface DanmakuRenderState {
  key: string;
  /** 原始弹幕 id（自己弹幕的 dmid / 本地 id）。 */
  id: string;
  text: string;
  color: string;
  track: number;
  top: number;
  bottom: number;
  /** 弹幕模式：1 滚动、2 顶部固定、3 底部固定。 */
  mode: number;
  durationSeconds: number;
  fontSize: number;
  opacity: number;
  expiresAt: number;
}

export function createDanmakuStyle(item: DanmakuRenderState) {
  const style: Record<string, string | number> = {
    "--bili-danmaku-duration": `${item.durationSeconds}s`,
    color: item.color || "#ffffff",
    fontSize: `${item.fontSize}px`,
    opacity: item.opacity,
  };
  if (item.mode === 1) {
    style["--bili-danmaku-top"] = `${item.top}px`;
  } else if (item.mode === 2) {
    style.top = `${item.top}px`;
  } else if (item.mode === 3) {
    style.bottom = `${item.bottom}px`;
  }
  return style;
}

export function durationForSpeed(speed: number) {
  const safeSpeed = Math.min(1.8, Math.max(0.6, speed || 1));
  return Math.max(4.5, Math.min(14, 8.5 / safeSpeed));
}
