import React, { useEffect, useRef, useState } from "sdk";
import type { BiliDanmakuItem, PluginSdk } from "../types";
import { errorMessage } from "../runtime";
import {
  estimateTrackCount,
  maxOnScreenForTracks,
  planDanmakuBatch,
  pruneFixedOccupancy,
  pruneTrackOccupancy,
  type FixedTrackOccupancy,
  type TrackOccupancy,
} from "../danmaku/layout";
import {
  createDanmakuStyle,
  durationForSpeed,
  type DanmakuRenderState,
} from "../danmaku/renderer";

export interface DanmakuSettings {
  enabled: boolean;
  fontSize: number;
  opacity: number;
  density: number;
  speed: number;
}

interface DanmakuOverlayProps {
  items: BiliDanmakuItem[];
  settings: DanmakuSettings;
  videoRef: { current: HTMLVideoElement | null };
  sdk?: PluginSdk | null;
  cid?: number;
  /** 自己发送的弹幕（id → 发送时间戳秒），5 分钟窗口内描边且可点击操作。 */
  selfDanmaku?: Map<string, number>;
  onRecalled?(id: string): void;
}

export const defaultDanmakuSettings: DanmakuSettings = {
  enabled: true,
  fontSize: 24,
  opacity: 0.86,
  density: 0.75,
  speed: 1,
};

/** 弹幕撤回窗口（秒），与 B 站一致。 */
const SELF_DANMAKU_WINDOW = 300;

/** 弹幕举报原因（bilibili-API-collect danmaku/report reasons）。 */
const danmakuReportReasons = [
  { id: 2, label: "色情低俗" },
  { id: 3, label: "人身攻击" },
  { id: 4, label: "违法信息" },
  { id: 5, label: "刷屏" },
  { id: 6, label: "广告" },
  { id: 1, label: "其他" },
];

interface DanmakuMenuState {
  id: string;
  x: number;
  y: number;
  /** 是否为自己发送的弹幕（5 分钟窗口内，菜单多"撤回"项）。 */
  self: boolean;
}

export function DanmakuOverlay({
  items,
  settings,
  videoRef,
  sdk,
  cid,
  selfDanmaku,
  onRecalled,
}: DanmakuOverlayProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const sortedRef = useRef<BiliDanmakuItem[]>([]);
  const cursorRef = useRef(0);
  const lastVideoTimeRef = useRef(0);
  const activeTracksRef = useRef<TrackOccupancy[]>([]);
  const activeFixedRef = useRef<FixedTrackOccupancy>({ top: [], bottom: [] });
  const renderCounterRef = useRef(0);
  const [visibleItems, setVisibleItems] = useState<DanmakuRenderState[]>([]);
  const [menu, setMenu] = useState<DanmakuMenuState | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    if (!menu) return;
    const close = () => {
      setMenu(null);
      setReportOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  useEffect(() => {
    // 分段加载会持续追加 items：增量合并去重（按 id），不重置游标、不清空可见弹幕，
    // 避免已显示弹幕被清空重播。
    const incoming = [...items]
      .filter((item) => item.text.trim())
      .sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
    const old = sortedRef.current;
    const byId = new Map<string, BiliDanmakuItem>();
    for (const item of old) byId.set(item.id, item);
    for (const item of incoming) byId.set(item.id, item);
    const merged = [...byId.values()].sort(
      (left, right) => left.time - right.time || left.id.localeCompare(right.id),
    );
    if (merged.length !== old.length) {
      const cursorTime = old[cursorRef.current]?.time ?? 0;
      const oldIds = new Set(old.map((item) => item.id));
      let minNewTime = Number.POSITIVE_INFINITY;
      for (const item of incoming) {
        if (!oldIds.has(item.id)) minNewTime = Math.min(minNewTime, item.time);
      }
      if (Number.isFinite(minNewTime) && minNewTime < cursorTime - 0.05) {
        // 新增弹幕在游标之前（自己发送/全量降级前插）：
        // 回退游标到新增弹幕处（取 min 而非 max：发送期间视频仍在前进，
        // lastTime 会略大于弹幕 time，max 会把游标推到新弹幕之后导致其被跳过）
        cursorRef.current = lowerBoundByTime(
          merged,
          Math.min(minNewTime, lastVideoTimeRef.current - 0.2),
        );
      } else {
        cursorRef.current = lowerBoundByTime(
          merged,
          Math.max(cursorTime, lastVideoTimeRef.current - 0.2),
        );
      }
    }
    sortedRef.current = merged;
  }, [items]);

  useEffect(() => {
    if (!settings.enabled) {
      activeTracksRef.current = [];
      setVisibleItems([]);
      return;
    }

    let frame = 0;
    let cancelled = false;

    function tick() {
      if (cancelled) return;
      const video = videoRef.current;
      const layer = layerRef.current;
      if (!video || !layer || video.readyState < 1) {
        frame = requestAnimationFrame(tick);
        return;
      }
      // 视频暂停时同步暂停 CSS 滚动动画（动画由浏览器驱动，仅停 JS 推进会继续滚动）
      const paused = video.paused;
      layer.classList.toggle("bili-danmaku-paused", paused);
      if (paused) {
        frame = requestAnimationFrame(tick);
        return;
      }

      const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
      const jumped = Math.abs(currentTime - lastVideoTimeRef.current) > 1.6;
      if (jumped) {
        cursorRef.current = lowerBoundByTime(sortedRef.current, currentTime - 0.2);
        activeTracksRef.current = [];
        activeFixedRef.current = { top: [], bottom: [] };
        setVisibleItems([]);
      }
      lastVideoTimeRef.current = currentTime;

      const height = layer.clientHeight || 260;
      const trackCount = estimateTrackCount(height, settings.fontSize);
      const maxOnScreen = maxOnScreenForTracks(trackCount, settings.density);
      const maxFixedPerSide = Math.max(1, Math.floor(trackCount / 3));
      const durationSeconds = durationForSpeed(settings.speed);
      const batch: BiliDanmakuItem[] = [];
      const sorted = sortedRef.current;

      while (cursorRef.current < sorted.length && sorted[cursorRef.current].time <= currentTime + 0.2) {
        const item = sorted[cursorRef.current];
        cursorRef.current += 1;
        if (item.time >= currentTime - 0.8) batch.push(item);
      }

      setVisibleItems((previous) => {
        const now = performance.now();
        const alive = previous.filter((item) => item.expiresAt > now);
        // 已在屏弹幕按 id 去重，避免游标回退时同一弹幕被重复 push
        const aliveIds = new Set(alive.map((item) => item.id));
        const freshBatch = batch.filter((item) => !aliveIds.has(item.id));
        activeTracksRef.current = pruneTrackOccupancy(activeTracksRef.current, currentTime);
        activeFixedRef.current = pruneFixedOccupancy(activeFixedRef.current, currentTime);
        if (freshBatch.length === 0) return alive;

        const planned = planDanmakuBatch(freshBatch, {
          activeTracks: activeTracksRef.current,
          activeFixed: activeFixedRef.current,
          maxTracks: trackCount,
          maxOnScreen: Math.max(maxOnScreen, alive.length),
          maxFixedPerSide,
          durationSeconds,
        });
        activeTracksRef.current = planned.nextTracks;
        activeFixedRef.current = planned.nextFixed;

        const rowHeight = settings.fontSize + 8;
        const nextItems = planned.planned.map(({ item, track, fixed, fixedSlot }) => {
          const key = `${item.id}-${renderCounterRef.current++}`;
          const mode = item.mode || 1;
          const isFixed = mode === 2 || mode === 3;
          const top =
            fixed === "bottom" ? 0 : fixed === "top" ? fixedSlot * rowHeight + 6 : track * rowHeight + 6;
          const bottom = fixed === "bottom" ? fixedSlot * rowHeight + 6 : 0;
          return {
            key,
            id: item.id,
            text: item.text,
            color: item.color || "#ffffff",
            track,
            top,
            bottom,
            mode,
            durationSeconds: isFixed ? Math.min(durationSeconds, 6) : durationSeconds,
            fontSize: settings.fontSize,
            opacity: settings.opacity,
            expiresAt: now + (isFixed ? Math.min(durationSeconds, 6) : durationSeconds) * 1000,
          };
        });
        return [...alive, ...nextItems].slice(-maxOnScreen);
      });

      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [settings.density, settings.enabled, settings.fontSize, settings.opacity, settings.speed, videoRef]);

  if (!settings.enabled) return null;

  return (
    <div className="bili-danmaku-layer" ref={layerRef}>
      {visibleItems.map((item) => (
        <span
          className={`bili-danmaku-item ${
            item.mode === 2
              ? "bili-danmaku-fixed bili-danmaku-fixed-top"
              : item.mode === 3
                ? "bili-danmaku-fixed bili-danmaku-fixed-bottom"
                : ""
          } ${isSelfItem(item) ? "bili-danmaku-self" : ""}`}
          key={item.key}
          style={createDanmakuStyle(item)}
          onMouseDown={(event: any) => handleDanmakuDown(item, event)}
        >
          {item.text}
        </span>
      ))}
      {menu ? (
        <div
          className="bili-danmaku-menu"
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={(event: any) => event.stopPropagation()}
        >
          {reportOpen ? (
            <>
              <div className="bili-danmaku-menu-title">举报弹幕</div>
              {danmakuReportReasons.map((reason) => (
                <button
                  className="bili-danmaku-menu-item"
                  key={reason.id}
                  type="button"
                  onClick={() => reportDanmaku(reason.id)}
                >
                  {reason.label}
                </button>
              ))}
              <button
                className="bili-danmaku-menu-item"
                type="button"
                onClick={() => setReportOpen(false)}
              >
                返回
              </button>
            </>
          ) : (
            <>
              <div className="bili-danmaku-menu-title">{menu.self ? "我的弹幕" : "弹幕操作"}</div>
              <button className="bili-danmaku-menu-item" type="button" onClick={thumbupDanmaku}>
                点赞
              </button>
              <button
                className="bili-danmaku-menu-item"
                type="button"
                onClick={() => setReportOpen(true)}
              >
                举报
              </button>
              {menu.self ? (
                <button className="bili-danmaku-menu-item" type="button" onClick={recallDanmaku}>
                  撤回
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );

  function handleDanmakuDown(item: DanmakuRenderState, event: any) {
    if (!sdk || !cid) return;
    event.stopPropagation();
    const layer = layerRef.current;
    const span: HTMLElement | null = event.currentTarget ?? null;
    if (!layer || !span) return;
    // 菜单定位到弹幕下方；用弹幕元素相对弹幕层的坐标，避免 fixed/transform containing block 错位；
    // 超出弹幕层边界时向上/向左翻转
    const layerRect = layer.getBoundingClientRect();
    const spanRect = span.getBoundingClientRect();
    const menuWidth = 160;
    const menuHeight = 250;
    let x = spanRect.left - layerRect.left;
    let y = spanRect.bottom - layerRect.top + 4;
    if (x + menuWidth > layerRect.width) x = Math.max(0, spanRect.right - layerRect.left - menuWidth);
    if (y + menuHeight > layerRect.height) y = Math.max(0, spanRect.top - layerRect.top - menuHeight - 4);
    setMenu({ id: item.id, x, y, self: isSelfItem(item) });
    setReportOpen(false);
  }

  function isSelfItem(item: DanmakuRenderState) {
    if (!selfDanmaku || !cid) return false;
    const sentAt = selfDanmaku.get(item.id);
    if (sentAt === undefined) return false;
    return Date.now() / 1000 - sentAt < SELF_DANMAKU_WINDOW;
  }

  function closeMenu() {
    setMenu(null);
    setReportOpen(false);
  }

  function thumbupDanmaku() {
    const current = menu;
    if (!current || !sdk || !cid) return;
    sdk.bilibili.danmaku
      .thumbup({ cid, dmid: Number(current.id), like: true })
      .then((result) => {
        if (!result.ok) throw new Error(result.message || "点赞失败");
        sdk.ui.notify("弹幕已点赞");
      })
      .catch((error) => sdk.ui.notify(errorMessage(error)))
      .finally(closeMenu);
  }

  function reportDanmaku(reason: number) {
    const current = menu;
    if (!current || !sdk || !cid) return;
    sdk.bilibili.danmaku
      .report({ cid, dmid: Number(current.id), reason })
      .then((result) => {
        if (!result.ok) throw new Error(result.message || "举报失败");
        sdk.ui.notify("弹幕已举报");
      })
      .catch((error) => sdk.ui.notify(errorMessage(error)))
      .finally(closeMenu);
  }

  function recallDanmaku() {
    const current = menu;
    if (!current || !sdk || !cid) return;
    sdk.bilibili.danmaku
      .recall({ cid, dmid: Number(current.id) })
      .then((result) => {
        if (!result.ok) throw new Error(result.message || "撤回失败");
        sdk.ui.notify("弹幕已撤回");
        onRecalled?.(current.id);
      })
      .catch((error) => sdk.ui.notify(errorMessage(error)))
      .finally(closeMenu);
  }
}

function lowerBoundByTime(items: BiliDanmakuItem[], time: number) {
  let low = 0;
  let high = items.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (items[middle].time < time) low = middle + 1;
    else high = middle;
  }
  return low;
}
