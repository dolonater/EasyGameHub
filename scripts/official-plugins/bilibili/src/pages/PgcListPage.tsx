import React, { Button, useEffect, useState } from "sdk";
import { PgcCard } from "../components/PgcCard";
import { errorMessage, getState } from "../runtime";
import type { BiliPgcCard, PluginSdk } from "../types";

interface PgcListPageProps {
  seasonType: number;
}

type PgcOrder = 0 | 1;
type FinishFilter = -1 | 0 | 1;

/** PGC 全量列表页（P9 块 2）：season index 排序/连载筛选 + 分页"加载更多"。 */
export function PgcListPage({ seasonType }: PgcListPageProps) {
  const [order, setOrder] = useState<PgcOrder>(0);
  const [finish, setFinish] = useState<FinishFilter>(-1);
  const [items, setItems] = useState<BiliPgcCard[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.season
      .pgcIndex({ seasonType, order, isFinish: finish, page: 1 })
      .then((data) => {
        if (!cancelled) {
          setItems(data.items);
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
  }, [seasonType, order, finish]);

  function loadMore() {
    if (loading || !hasMore) return;
    const targetPage = page + 1;
    setLoading(true);
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.season
      .pgcIndex({ seasonType, order, isFinish: finish, page: targetPage })
      .then((data) => {
        setItems((previous) => [...previous, ...data.items]);
        setPage(targetPage);
        setHasMore(data.hasMore);
      })
      .catch((reason: Error) => setError(errorMessage(reason)))
      .finally(() => setLoading(false));
  }

  return (
    <section className="bili-pgc-list">
      <div className="bili-pgc-list-filters">
        <div className="bili-hot-subtabs" role="tablist" aria-label="排序">
          <Button
            className={order === 0 ? "bili-hot-subtab bili-hot-subtab-active" : "bili-hot-subtab"}
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => setOrder(0)}
          >
            最热
          </Button>
          <Button
            className={order === 1 ? "bili-hot-subtab bili-hot-subtab-active" : "bili-hot-subtab"}
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => setOrder(1)}
          >
            最新
          </Button>
        </div>
        <div className="bili-hot-subtabs" role="tablist" aria-label="连载状态">
          <Button
            className={finish === -1 ? "bili-hot-subtab bili-hot-subtab-active" : "bili-hot-subtab"}
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => setFinish(-1)}
          >
            全部
          </Button>
          <Button
            className={finish === 0 ? "bili-hot-subtab bili-hot-subtab-active" : "bili-hot-subtab"}
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => setFinish(0)}
          >
            连载中
          </Button>
          <Button
            className={finish === 1 ? "bili-hot-subtab bili-hot-subtab-active" : "bili-hot-subtab"}
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => setFinish(1)}
          >
            已完结
          </Button>
        </div>
      </div>

      {error ? <div className="bili-state bili-state-error">{error}</div> : null}
      {!error && loading && items.length === 0 ? <div className="bili-state">正在加载</div> : null}
      {!error && !loading && items.length === 0 ? <div className="bili-state">暂无内容</div> : null}
      {items.length > 0 ? (
        <>
          <div className="bili-pgc-grid">
            {items.map((card) => (
              <PgcCard key={`${card.seasonId}-${card.seasonType}`} card={card} />
            ))}
          </div>
          {hasMore ? (
            <button type="button" className="bili-dynamic-load-more" onClick={loadMore} disabled={loading}>
              {loading ? "正在加载" : "加载更多"}
            </button>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
