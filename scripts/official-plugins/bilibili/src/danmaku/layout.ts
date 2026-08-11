export interface LayoutDanmakuItem {
  id: string;
  time: number;
}

export interface TrackOccupancy {
  track: number;
  occupiedUntil: number;
}

export interface PlannedDanmaku<T extends LayoutDanmakuItem> {
  item: T;
  track: number;
}

export interface DanmakuLayoutOptions {
  activeTracks: TrackOccupancy[];
  maxTracks: number;
  maxOnScreen: number;
  durationSeconds: number;
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
) {
  const nextTracks = options.activeTracks.map((track) => ({ ...track }));
  const planned: PlannedDanmaku<T>[] = [];
  let dropped = 0;

  for (const item of items) {
    if (planned.length + nextTracks.length >= options.maxOnScreen) {
      dropped += 1;
      continue;
    }

    const track = firstAvailableTrack(nextTracks, options.maxTracks, item.time);
    if (track === null) {
      dropped += 1;
      continue;
    }

    planned.push({ item, track });
    nextTracks.push({
      track,
      occupiedUntil: item.time + Math.max(1, options.durationSeconds * 0.38),
    });
  }

  return { planned, dropped, nextTracks };
}

export function pruneTrackOccupancy(activeTracks: TrackOccupancy[], currentTime: number) {
  return activeTracks.filter((track) => track.occupiedUntil > currentTime);
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
