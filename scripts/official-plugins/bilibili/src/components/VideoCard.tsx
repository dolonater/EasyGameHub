import React from "sdk";
import type { BiliVideoCard } from "../types";
import { watchUrl } from "../routes";
import { BiliImage } from "./BiliImage";

interface VideoCardProps {
  video: BiliVideoCard;
}

export function VideoCard({ video }: VideoCardProps) {
  const openVideo = () => {
    window.location.assign(watchUrl(video));
  };

  return (
    <button className="bili-video-card" type="button" onClick={openVideo}>
      <span className="bili-cover-wrap">
        {video.cover ? (
          <BiliImage className="bili-cover" src={video.cover} loading="lazy" />
        ) : (
          <span className="bili-cover-empty">Bilibili</span>
        )}
        <span className="bili-duration">{formatDuration(video.duration)}</span>
      </span>
      <span className="bili-video-body">
        <strong title={video.title}>{video.title || "Untitled"}</strong>
        <small>{video.ownerName || "未知 UP 主"}</small>
        <span className="bili-video-meta">
          <span>{formatCount(video.viewCount)} 播放</span>
          <span>{formatCount(video.danmakuCount)} 弹幕</span>
        </span>
        {video.progress > 0 && video.duration > 0 ? (
          <span className="bili-video-progress" title={`看到 ${formatDuration(video.progress)}`}>
            <span style={{ width: `${progressPercent(video)}%` }} />
          </span>
        ) : null}
      </span>
    </button>
  );
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const hour = Math.floor(safe / 3600);
  const minute = Math.floor((safe % 3600) / 60);
  const second = safe % 60;
  if (hour > 0) {
    return `${hour}:${pad(minute)}:${pad(second)}`;
  }
  return `${minute}:${pad(second)}`;
}

function formatCount(value: number) {
  if (value >= 100000000) return `${trim(value / 100000000)}亿`;
  if (value >= 10000) return `${trim(value / 10000)}万`;
  return String(Math.max(0, Math.floor(value || 0)));
}

function trim(value: number) {
  return value.toFixed(value >= 10 ? 0 : 1).replace(/\.0$/, "");
}

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function progressPercent(video: BiliVideoCard) {
  if (video.duration <= 0) return 0;
  return Math.min(100, Math.max(0, (video.progress / video.duration) * 100));
}
