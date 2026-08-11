import type { BiliVideoCard } from "./types";

const PLUGIN_ID = "com.easygamehub.bilibili";

export function homeUrl() {
  return `/plugin/${PLUGIN_ID}/home`;
}

export function mineUrl() {
  return `/plugin/${PLUGIN_ID}/mine`;
}

export function watchUrl(video: BiliVideoCard) {
  const params = new URLSearchParams();
  if (video.bvid) params.set("bvid", video.bvid);
  if (video.cid > 0) params.set("cid", String(video.cid));
  return `/plugin/${PLUGIN_ID}/watch?${params.toString()}`;
}
