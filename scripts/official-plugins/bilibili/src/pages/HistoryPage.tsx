import React, { useEffect, useState } from "sdk";
import { errorMessage, getState, subscribe } from "../runtime";
import type { BiliHistoryItem } from "../types";
import { VideoCard } from "../components/VideoCard";

/** 历史记录页（P9 阶段 2 拆页）：从"我的"页内嵌 tab 提取为独立视图。 */
export function HistoryPage() {
  const [state, setState] = useState(getState);
  const [items, setItems] = useState<BiliHistoryItem[]>([]);
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
      .historyList(1)
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
        <div className="bili-state">登录后可查看历史记录</div>
      ) : error ? (
        <div className="bili-state bili-state-error">{error}</div>
      ) : loading ? (
        <div className="bili-state">正在加载历史记录</div>
      ) : items.length === 0 ? (
        <div className="bili-state">暂无历史记录</div>
      ) : (
        <div className="bili-video-grid">
          {items.map((item) => (
            <VideoCard key={`${item.video.bvid}-${item.viewedAt}`} video={item.video} />
          ))}
        </div>
      )}
    </section>
  );
}
