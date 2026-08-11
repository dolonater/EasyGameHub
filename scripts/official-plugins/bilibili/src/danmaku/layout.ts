export interface LayoutDanmakuItem {
  id: string;
  time: number;
  /** 弹幕模式：1 滚动（默认）、2 顶部固定、3 底部固定。 */
  mode?: number;
}

export interface TrackOccupancy {
  track: number;
  occupiedUntil: number;
}

export type FixedSide = "top" | "bottom";

/** 固定弹幕轨道占用（每侧独立，不参与滚动轨道占用）。 */
export interface FixedTrackOccupancy {
  top: TrackOccupancy[];
  bottom: TrackOccupancy[];
}

export interface PlannedDanmaku<T extends LayoutDanmakuItem> {
  item: T;
  /** 滚动轨道号；固定弹幕为 -1。 */
  track: number;
  /** 固定弹幕所在侧；滚动弹幕为 null。 */
  fixed: FixedSide | null;
  /** 固定弹幕槽位（每侧从 0 开始）。 */
  fixedSlot: number;
}

export interface DanmakuLayoutOptions {
  activeTracks: TrackOccupancy[];
  activeFixed: FixedTrackOccupancy;
  maxTracks: number;
  maxOnScreen: number;
  /** 每侧固定弹幕最大同时槽位数。 */
  maxFixedPerSide: number;
  durationSeconds: number;
}

export interface DanmakuBatchResult<T extends LayoutDanmakuItem> {
  planned: PlannedDanmaku<T>[];
  dropped: number;
  nextTracks: TrackOccupancy[];
  nextFixed: FixedTrackOccupancy;
}

export function estimateTrackCount(height: number, fontSize: number) {
  const safeHeight = Math.max(48, height || 0);
  const safeFontSize = Math.max(14, fontSize || 0);
  return Math.max(1, Math.floor(safeHeight / (safeFontSize + 8)));
}

export function maxOnScreenForTracks(trackCount: number, density: number) {
  const safeDensity = Math.min(1, Math.max(0.25, density || 0.25));
  return Math.max(2, Math.floor(Math.max(1, trackCount) * 2.4 * safeDensity));
}

export function planDanmakuBatch<T extends LayoutDanmakuItem>(
  items: T[],
  options: DanmakuLayoutOptions,
): DanmakuBatchResult<T> {
  const nextTracks = options.activeTracks.map((track) => ({ ...track }));
  const nextFixed: FixedTrackOccupancy = {
    top: options.activeFixed.top.map((track) => ({ ...track })),
    bottom: options.activeFixed.bottom.map((track) => ({ ...track })),
  };
  const planned: PlannedDanmaku<T>[] = [];
  let dropped = 0;

  for (const item of items) {
    const fixedSide = fixedSideOf(item.mode);

    if (!fixedSide) {
      if (planned.length + nextTracks.length >= options.maxOnScreen) {
        dropped += 1;
        continue;
      }
      const track = firstAvailableTrack(nextTracks, options.maxTracks, item.time);
      if (track === null) {
        dropped += 1;
        continue;
      }
      planned.push({ item, track, fixed: null, fixedSlot: -1 });
      nextTracks.push({
        track,
        occupiedUntil: item.time + Math.max(1, options.durationSeconds * 0.38),
      });
      continue;
    }

    // 固定弹幕：独立轨道区，不占用滚动轨道
    const occupancy = fixedSide === "top" ? nextFixed.top : nextFixed.bottom;
    const slot = firstAvailableFixedSlot(occupancy, options.maxFixedPerSide, item.time);
    if (slot === null) {
      dropped += 1;
      continue;
    }
    planned.push({ item, track: -1, fixed: fixedSide, fixedSlot: slot });
    occupancy.push({
      track: slot,
      occupiedUntil: item.time + Math.max(1, options.durationSeconds),
    });
  }

  return { planned, dropped, nextTracks, nextFixed };
}

export function pruneTrackOccupancy(activeTracks: TrackOccupancy[], currentTime: number) {
  return activeTracks.filter((track) => track.occupiedUntil > currentTime);
}

export function pruneFixedOccupancy(
  activeFixed: FixedTrackOccupancy,
  currentTime: number,
): FixedTrackOccupancy {
  return {
    top: activeFixed.top.filter((track) => track.occupiedUntil > currentTime),
    bottom: activeFixed.bottom.filter((track) => track.occupiedUntil > currentTime),
  };
}

function fixedSideOf(mode: number | undefined): FixedSide | null {
  if (mode === 2) return "top";
  if (mode === 3) return "bottom";
  return null;
}

function firstAvailableFixedSlot(
  activeSlots: TrackOccupancy[],
  maxSlots: number,
  time: number,
) {
  const safeMaxSlots = Math.max(1, Math.floor(maxSlots || 1));
  for (let slot = 0; slot < safeMaxSlots; slot += 1) {
    const occupied = activeSlots.some(
      (entry) => entry.track === slot && entry.occupiedUntil > time,
    );
    if (!occupied) return slot;
  }
  return null;
}

function firstAvailableTrack(activeTracks: TrackOccupancy[], maxTracks: number, time: number) {
  const safeMaxTracks = Math.max(1, Math.floor(maxTracks || 1));
  for (let track = 0; track < safeMaxTracks; track += 1) {
    const occupied = activeTracks.some(
      (entry) => entry.track === track && entry.occupiedUntil > time,
    );
    if (!occupied) return track;
  }
  return null;
}
