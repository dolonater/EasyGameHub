import React, { useEffect, useRef, useState } from "sdk";
import type { BiliVideoCard, BiliWeeklySeries } from "../types";
import { getState } from "../runtime";
import { MenuPopover } from "./MenuPopover";
import { VideoCard } from "./VideoCard";

export function WeeklyPanel() {
  const [series, setSeries] = useState<BiliWeeklySeries[]>([]);
  const [number, setNumber] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [videos, setVideos] = useState<BiliVideoCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.ranking
      .weeks()
      .then((data) => {
        if (!cancelled) {
          setSeries(data);
          setNumber((previous) => previous ?? data[0]?.number ?? null);
        }
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (number == null) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.ranking
      .weekDetail(number)
      .then((data) => {
        if (!cancelled) {
          setVideos(data);
          setLoading(false);
        }
      })
      .catch((reason: Error) => {
        if (!cancelled) {
          setError(reason.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [number]);

  return (
    <section className="bili-rank-panel">
      <div className="bili-weekly-select">
        <button
          ref={triggerRef}
          type="button"
          className="bili-rank-rid bili-rank-rid-active"
          onClick={() => setOpen((value) => !value)}
        >
          {series.find((item) => item.number === number)
            ? series.find((item) => item.number === number)?.name || `第 ${number} 期`
            : "选择期数"}
        </button>
        {open ? (
          <MenuPopover
            onClose={() => setOpen(false)}
            triggerRef={triggerRef}
            style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 60 }}
          >
            {series.map((item) => (
              <button
                className={number === item.number ? "bili-menu-item bili-menu-item-active" : "bili-menu-item"}
                key={item.number}
                type="button"
                onClick={() => {
                  setNumber(item.number);
                  setOpen(false);
                }}
              >
                {item.name || `第 ${item.number} 期`}
              </button>
            ))}
          </MenuPopover>
        ) : null}
      </div>
      {error ? <div className="bili-state bili-state-error">{error}</div> : null}
      {!error && loading ? <div className="bili-state">正在加载每周必看</div> : null}
      {!error && !loading && videos.length === 0 && number != null ? (
        <div className="bili-state">暂无视频</div>
      ) : null}
      {!error && videos.length > 0 ? (
        <div className="bili-video-grid">
          {videos.map((video) => (
            <VideoCard key={`${video.bvid}-${video.cid || video.aid}`} video={video} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
