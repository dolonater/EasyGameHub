import React, { useEffect, useState } from "sdk";
import { errorMessage, getState, subscribe } from "../runtime";
import type { BiliToViewItem } from "../types";
import { VideoCard } from "../components/VideoCard";

/** 稍后再看页（P9 阶段 2 拆页）：从"我的"页内嵌 tab 提取为独立视图。 */
export function WatchLaterPage() {
  const [state, setState] = useState(getState);
  const [items, setItems] = useState<BiliToViewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const loggedIn = Boolean(state.loginInfo?.loggedIn);

  useEffect(() => subscribe(() => setState(getState())), []);

  useEffect(() => {
    if (!loggedIn) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.library
      .toViewList()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loggedIn]);

  return (
    <section className="bili-page-library">
      {!loggedIn ? (
        <div className="bili-state">登录后可查看稍后再看</div>
      ) : error ? (
        <div className="bili-state bili-state-error">{error}</div>
      ) : loading ? (
        <div className="bili-state">正在加载稍后再看</div>
      ) : items.length === 0 ? (
        <div className="bili-state">稍后再看列表为空</div>
      ) : (
        <div className="bili-video-grid">
          {items.map((item) => (
            <VideoCard key={`${item.video.bvid}-${item.addedAt}`} video={item.video} />
          ))}
        </div>
      )}
    </section>
  );
}
