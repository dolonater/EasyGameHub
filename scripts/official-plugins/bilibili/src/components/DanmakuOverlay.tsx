import React, { useEffect, useRef, useState } from "sdk";
import type { BiliDanmakuItem } from "../types";
import {
  estimateTrackCount,
  maxOnScreenForTracks,
  planDanmakuBatch,
  pruneTrackOccupancy,
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
}

export const defaultDanmakuSettings: DanmakuSettings = {
  enabled: true,
  fontSize: 24,
  opacity: 0.86,
  density: 0.75,
  speed: 1,
};

export function DanmakuOverlay({ items, settings, videoRef }: DanmakuOverlayProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const sortedRef = useRef<BiliDanmakuItem[]>([]);
  const cursorRef = useRef(0);
  const lastVideoTimeRef = useRef(0);
  const activeTracksRef = useRef<TrackOccupancy[]>([]);
  const renderCounterRef = useRef(0);
  const [visibleItems, setVisibleItems] = useState<DanmakuRenderState[]>([]);

  useEffect(() => {
    sortedRef.current = [...items]
      .filter((item) => item.text.trim())
      .sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));
    cursorRef.current = 0;
    activeTracksRef.current = [];
    setVisibleItems([]);
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
      if (!video || !layer || video.paused || video.readyState < 1) {
        frame = requestAnimationFrame(tick);
        return;
      }

      const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
      const jumped = Math.abs(currentTime - lastVideoTimeRef.current) > 1.6;
      if (jumped) {
        cursorRef.current = lowerBoundByTime(sortedRef.current, currentTime - 0.2);
        activeTracksRef.current = [];
        setVisibleItems([]);
      }
      lastVideoTimeRef.current = currentTime;

      const height = layer.clientHeight || 260;
      const trackCount = estimateTrackCount(height, settings.fontSize);
      const maxOnScreen = maxOnScreenForTracks(trackCount, settings.density);
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
        activeTracksRef.current = pruneTrackOccupancy(activeTracksRef.current, currentTime);
        if (batch.length === 0) return alive;

        const planned = planDanmakuBatch(batch, {
          activeTracks: activeTracksRef.current,
          maxTracks: trackCount,
          maxOnScreen: Math.max(maxOnScreen, alive.length),
          durationSeconds,
        });
        activeTracksRef.current = planned.nextTracks;

        const nextItems = planned.planned.map(({ item, track }) => {
          const key = `${item.id}-${renderCounterRef.current++}`;
          return {
            key,
            text: item.text,
            color: item.color || "#ffffff",
            track,
            top: track * (settings.fontSize + 8) + 6,
            durationSeconds,
            fontSize: settings.fontSize,
            opacity: settings.opacity,
            expiresAt: now + durationSeconds * 1000,
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
        <span className="bili-danmaku-item" key={item.key} style={createDanmakuStyle(item)}>
          {item.text}
        </span>
      ))}
    </div>
  );
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
