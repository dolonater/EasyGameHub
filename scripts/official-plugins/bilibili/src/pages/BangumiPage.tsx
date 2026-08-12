import React, { useEffect, useState } from "sdk";
import { Button } from "sdk";
import { errorMessage, getState, subscribe } from "../runtime";
import type { BiliBangumiFollow } from "../types";
import { openSeason } from "../navigation";
import { BiliImage } from "../components/BiliImage";

/** 追番页（P9 阶段 2 拆页）：从"我的"页内嵌 tab 提取为独立视图。 */
export function BangumiPage() {
  const [state, setState] = useState(getState);
  const [items, setItems] = useState<BiliBangumiFollow[]>([]);
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
    sdk.bilibili.season
      .followList({ page: 1 })
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
        <div className="bili-state">登录后可查看追番</div>
      ) : error ? (
        <div className="bili-state bili-state-error">{error}</div>
      ) : loading ? (
        <div className="bili-state">正在加载追番</div>
      ) : items.length === 0 ? (
        <div className="bili-state">还没有追番</div>
      ) : (
        <div className="bili-bangumi-follow-grid">
          {items.map((item) => (
            <button
              key={item.seasonId}
              type="button"
              className="bili-bangumi-follow-card"
              onClick={() => openSeason(item.seasonId)}
            >
              <span className="bili-cover-wrap">
                {item.cover ? (
                  <BiliImage className="bili-pgc-cover" src={item.cover} loading="lazy" />
                ) : (
                  <span className="bili-cover-empty">Bilibili</span>
                )}
                {item.badge ? <span className="bili-pgc-score">{item.badge}</span> : null}
              </span>
              <span className="bili-video-body">
                <strong title={item.title}>{item.title || "未命名番剧"}</strong>
                <small>{item.isFinish === 1 ? "已完结" : `共 ${item.totalCount} 集`}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
