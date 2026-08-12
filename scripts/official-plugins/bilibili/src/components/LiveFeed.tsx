import React, { Button, useEffect, useRef, useState } from "sdk";
import { BiliImage } from "./BiliImage";
import { MenuPopover } from "./MenuPopover";
import { usePagedFeed } from "../hooks/usePagedFeed";
import { errorMessage, getState } from "../runtime";
import type { BiliLiveArea, BiliLiveRecommendRoom, PluginSdk } from "../types";

/** 分区/子分区平铺数量上限，超出收纳进"更多"下拉（P9 块 3）。 */
const VISIBLE_AREAS = 8;
const VISIBLE_SUBS = 8;

interface LiveFeedProps {
  onOpenLive(roomId: number): void;
}

/**
 * 直播 feed（P9 改造）：
 * - "全部"：推荐流（分页，换一批）
 * - 具体分区：second/getList 分区房间（分页累积，加载更多）
 */
export function LiveFeed({ onOpenLive }: LiveFeedProps) {
  const [areas, setAreas] = useState<BiliLiveArea[]>([]);
  const [parentId, setParentId] = useState(0);
  const [subId, setSubId] = useState(0);
  const [parentMoreOpen, setParentMoreOpen] = useState(false);
  const [subMoreOpen, setSubMoreOpen] = useState(false);
  const parentMoreRef = useRef<HTMLButtonElement | null>(null);
  const subMoreRef = useRef<HTMLButtonElement | null>(null);
  const [rooms, setRooms] = useState<BiliLiveRecommendRoom[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const recommend = usePagedFeed<BiliLiveRecommendRoom>(
    (pageNum, _refresh) =>
      homeCall((sdk) => sdk.bilibili.live.recommend({ page: pageNum })).then((result) => result.rooms),
    { key: "live-feed", enabled: parentId === 0 },
  );

  useEffect(() => {
    homeCall((sdk) => sdk.bilibili.live.areas())
      .then((list) => setAreas(list))
      .catch(() => setAreas([]));
  }, []);

  const activeArea = areas.find((area) => area.id === parentId) ?? null;

  // 分区模式：切分区/子分区重载第一页
  useEffect(() => {
    if (parentId === 0) {
      setRooms([]);
      setHasMore(false);
      setPage(1);
      setError("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.live
      .rooms({ parentAreaId: parentId, areaId: subId, page: 1 })
      .then((data) => {
        if (!cancelled) {
          setRooms(data.rooms);
          setPage(1);
          setHasMore(data.hasMore);
        }
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(errorMessage(reason));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [parentId, subId]);

  function loadMore() {
    if (loading || !hasMore) return;
    const targetPage = page + 1;
    setLoading(true);
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.live
      .rooms({ parentAreaId: parentId, areaId: subId, page: targetPage })
      .then((data) => {
        setRooms((previous) => [...previous, ...data.rooms]);
        setPage(targetPage);
        setHasMore(data.hasMore);
      })
      .catch((reason: Error) => setError(errorMessage(reason)))
      .finally(() => setLoading(false));
  }

  function pickParent(id: number) {
    setParentId(id);
    setSubId(0);
  }

  const isAreaMode = parentId !== 0;
  const shownRooms = isAreaMode ? rooms : recommend.items;
  const currentError = isAreaMode ? error : recommend.error;
  const currentLoading = isAreaMode ? loading : recommend.loading;

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
        {areas.slice(0, VISIBLE_AREAS).map((area) => (
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
        {areas.length > VISIBLE_AREAS ? (
          <>
            <button
              ref={parentMoreRef}
              className="bili-live-area bili-live-area-more"
              type="button"
              onClick={() => setParentMoreOpen((value) => !value)}
            >
              更多
            </button>
            {parentMoreOpen ? (
              <MenuPopover
                onClose={() => setParentMoreOpen(false)}
                triggerRef={parentMoreRef}
                style={{ position: "absolute", top: "calc(100% - 4px)", right: 0, zIndex: 60 }}
              >
                {areas.slice(VISIBLE_AREAS).map((area) => (
                  <button
                    className={parentId === area.id ? "bili-menu-item bili-menu-item-active" : "bili-menu-item"}
                    key={area.id}
                    type="button"
                    onClick={() => {
                      pickParent(area.id);
                      setParentMoreOpen(false);
                    }}
                  >
                    {area.name}
                  </button>
                ))}
              </MenuPopover>
            ) : null}
          </>
        ) : null}
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
          {activeArea.children.slice(0, VISIBLE_SUBS).map((sub) => (
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
          {activeArea.children.length > VISIBLE_SUBS ? (
            <>
              <button
                ref={subMoreRef}
                className="bili-live-area bili-live-area-more"
                type="button"
                onClick={() => setSubMoreOpen((value) => !value)}
              >
                更多
              </button>
              {subMoreOpen ? (
                <MenuPopover
                  onClose={() => setSubMoreOpen(false)}
                  triggerRef={subMoreRef}
                  style={{ position: "absolute", top: "calc(100% - 4px)", right: 0, zIndex: 60 }}
                >
                  {activeArea.children.slice(VISIBLE_SUBS).map((sub) => (
                    <button
                      className={subId === sub.id ? "bili-menu-item bili-menu-item-active" : "bili-menu-item"}
                      key={sub.id}
                      type="button"
                      onClick={() => {
                        setSubId(sub.id);
                        setSubMoreOpen(false);
                      }}
                    >
                      {sub.name}
                    </button>
                  ))}
                </MenuPopover>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {currentError ? <div className="bili-feed-error">{currentError}</div> : null}
      {!currentLoading && shownRooms.length === 0 && !currentError ? (
        <div className="bili-live-empty">{isAreaMode ? "该分区暂无直播" : "暂无推荐直播"}</div>
      ) : null}
      {shownRooms.length > 0 ? (
        <>
          <div className="bili-live-grid">
            {shownRooms.map((room) => (
              <LiveCard key={room.roomId} room={room} onOpen={() => onOpenLive(room.roomId)} />
            ))}
          </div>
          <div className="bili-live-more">
            {isAreaMode ? (
              <Button size="sm" variant="outline" type="button" onClick={loadMore} disabled={loading || !hasMore}>
                {loading ? "加载中…" : hasMore ? "加载更多" : "已加载全部"}
              </Button>
            ) : (
              <Button size="sm" variant="outline" type="button" onClick={recommend.reload} disabled={recommend.loading}>
                {recommend.loading ? "加载中…" : "换一批"}
              </Button>
            )}
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
