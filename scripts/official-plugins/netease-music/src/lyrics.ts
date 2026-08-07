import type { LyricLine } from "./types";

const timePattern = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

export function parseLrc(lyric: string, translation: string): LyricLine[] {
  const translations = new Map<number, string>();
  for (const line of parsePlainLrc(translation)) {
    translations.set(roundTime(line.time), line.text);
  }

  return parsePlainLrc(lyric)
    .map((line) => ({
      ...line,
      translation: translations.get(roundTime(line.time)),
    }))
    .filter((line) => line.text || line.translation)
    .sort((a, b) => a.time - b.time);
}

export function activeLyricIndex(lines: LyricLine[], currentTime: number): number {
  if (!lines.length) return -1;
  let low = 0;
  let high = lines.length - 1;
  let result = -1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lines[mid].time <= currentTime + 0.15) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return result;
}

function parsePlainLrc(input: string): LyricLine[] {
  const rows: LyricLine[] = [];
  for (const rawLine of input.split(/\r?\n/)) {
    timePattern.lastIndex = 0;
    const matches = Array.from(rawLine.matchAll(timePattern));
    if (!matches.length) continue;
    const text = rawLine.replace(timePattern, "").trim();
    for (const match of matches) {
      rows.push({ time: toSeconds(match), text });
    }
  }
  return rows;
}

function toSeconds(match: RegExpMatchArray): number {
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const fraction = match[3] ?? "0";
  const ms = Number(fraction.padEnd(3, "0").slice(0, 3));
  return minutes * 60 + seconds + ms / 1000;
}

function roundTime(value: number): number {
  return Math.round(value * 10) / 10;
}
