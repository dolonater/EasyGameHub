import React, { Button, useEffect, useState } from "sdk";
import { BiliImage } from "./BiliImage";
import { usePagedFeed } from "../hooks/usePagedFeed";
import { getState } from "../runtime";
import type { BiliLiveArea, BiliLiveRecommendRoom, PluginSdk } from "../types";

interface LiveFeedProps {
  onOpenLive(roomId: number): void;
}

/**
 * 直播 feed（P6）：推荐列表（分页）+ 分区筛选。
 * 推荐接口不支持分区参数，分区筛选为前端过滤（按父/子分区名匹配）。
 */
export function LiveFeed({ onOpenLive }: LiveFeedProps) {
  const feed = usePagedFeed<BiliLiveRecommendRoom>(
    (page, _refresh) =>
      homeCall((sdk) => sdk.bilibili.live.recommend({ page })).then((result) => result.rooms),
    { key: "live-feed" },
  );
  const [areas, setAreas] = useState<BiliLiveArea[]>([]);
  const [parentId, setParentId] = useState(0);
  const [subId, setSubId] = useState(0);

  useEffect(() => {
    homeCall((sdk) => sdk.bilibili.live.areas())
      .then((list) => setAreas(list))
      .catch(() => setAreas([]));
  }, []);

  const activeArea = areas.find((area) => area.id === parentId) ?? null;
  const activeSub = activeArea?.children.find((sub) => sub.id === subId) ?? null;

  const rooms = feed.items.filter((room) => {
    if (!activeArea) return true;
    if (activeArea.name !== room.areaParentName) return false;
    if (activeSub && activeSub.name !== room.areaName) return false;
    return true;
  });

  function pickParent(id: number) {
    setParentId(id);
    setSubId(0);
  }

  return (
    <div className="bili-live-feed">
      <div className="bili-live-areas">
        <Button
          className={parentId === 0 ? "bili-live-area bili-live-area-active" : "bili-live-area"}
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => pickParent(0)}
        >
          全部
        </Button>
        {areas.map((area) => (
          <Button
            key={area.id}
            className={parentId === area.id ? "bili-live-area bili-live-area-active" : "bili-live-area"}
            size="sm"
            type="button"
            variant="ghost"
            onClick={() => pickParent(area.id)}
          >
            {area.name}
          </Button>
        ))}
      </div>
      {activeArea && activeArea.children.length > 0 ? (
        <div className="bili-live-areas bili-live-subareas">
          <Button
            className={subId === 0 ? "bili-live-area bili-live-area-active" : "bili-live-area"}
            size="sm"
            type="button"
            variant="ghost"
            onClick={() => setSubId(0)}
          >
            全部分区
          </Button>
          {activeArea.children.map((sub) => (
            <Button
              key={sub.id}
              className={subId === sub.id ? "bili-live-area bili-live-area-active" : "bili-live-area"}
              size="sm"
              type="button"
              variant="ghost"
              onClick={() => setSubId(sub.id)}
            >
              {sub.name}
            </Button>
          ))}
        </div>
      ) : null}

      {feed.error ? <div className="bili-feed-error">{feed.error}</div> : null}
      {!feed.loading && rooms.length === 0 && !feed.error ? (
        <div className="bili-live-empty">该分区暂无推荐直播</div>
      ) : null}
      {rooms.length > 0 ? (
        <>
          <div className="bili-live-grid">
            {rooms.map((room) => (
              <LiveCard key={room.roomId} room={room} onOpen={() => onOpenLive(room.roomId)} />
            ))}
          </div>
          <div className="bili-live-more">
            <Button size="sm" variant="outline" type="button" onClick={feed.reload} disabled={feed.loading}>
              {feed.loading ? "加载中…" : "换一批"}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function LiveCard({ room, onOpen }: { room: BiliLiveRecommendRoom; onOpen(): void }) {
  return (
    <button type="button" className="bili-live-card" onClick={onOpen}>
      <div className="bili-live-card-cover">
        <BiliImage className="bili-live-card-img" src={room.cover} alt={room.title} loading="lazy" />
        <span className="bili-live-card-badge">直播中</span>
        <span className="bili-live-card-online">{formatOnline(room.online)}人</span>
      </div>
      <strong className="bili-live-card-title" title={room.title}>
        {room.title || "未命名直播"}
      </strong>
      <div className="bili-live-card-owner">
        <BiliImage className="bili-live-card-face" src={room.face} alt={room.uname} loading="lazy" />
        <span className="bili-live-card-name">{room.uname}</span>
        <small className="bili-live-card-area">{room.areaName}</small>
      </div>
    </button>
  );
}

function formatOnline(count: number): string {
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1).replace(/\.0$/, "")}万`;
  }
  return String(count);
}

function homeCall<T>(call: (sdk: PluginSdk) => Promise<T>): Promise<T> {
  const sdk = getState().sdk;
  if (!sdk) return Promise.reject(new Error("Bilibili 插件尚未初始化"));
  return call(sdk);
}
