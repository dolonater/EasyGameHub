import React from "sdk";
import { openWatch } from "../navigation";
import type { BiliPgcCard, BiliVideoCard } from "../types";
import { BiliImage } from "./BiliImage";

/** 番剧/影视卡片适配为通用视频卡片数据（无 BV 号，点击行为由调用方覆盖）。 */
export function pgcToVideoCard(card: BiliPgcCard): BiliVideoCard {
  return {
    bvid: "",
    aid: 0,
    cid: 0,
    title: card.title,
    cover: card.cover,
    ownerName: "",
    ownerMid: 0,
    duration: 0,
    viewCount: 0,
    danmakuCount: 0,
    publishedAt: 0,
    progress: 0,
  };
}

interface VideoCardProps {
  video: BiliVideoCard;
  /** 覆盖默认点击行为（如番剧打开详情页） */
  onClick?(): void;
  /** 封面比例：video=横版 16:9（默认）、poster=竖版海报（番剧） */
  coverRatio?: "video" | "poster";
  /** 自定义 meta 行（如番剧"更新至第12话 · 9.7分"）；缺省显示播放/弹幕 */
  meta?: any;
}

export function VideoCard({ video, onClick, coverRatio = "video", meta }: VideoCardProps) {
  const openVideo = () => {
    openWatch({ name: "watch", bvid: video.bvid, aid: video.aid, cid: video.cid });
  };

  return (
    <button className="bili-video-card" type="button" onClick={onClick ?? openVideo}>
      <span className="bili-cover-wrap" data-ratio={coverRatio}>
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
          {meta ??
            (
              <>
                <span>{formatCount(video.viewCount)} 播放</span>
                <span>{formatCount(video.danmakuCount)} 弹幕</span>
              </>
            )}
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
