import React, { useEffect, useState } from "sdk";
import type { BiliHotWord } from "../types";
import { getState } from "../runtime";

interface SearchEmptyPanelProps {
  history: string[];
  onPick(keyword: string): void;
  onClearHistory(): void;
}

/** 搜索 Tab 空态：搜索历史 + 热搜榜 */
export function SearchEmptyPanel({ history, onPick, onClearHistory }: SearchEmptyPanelProps) {
  const [hotwords, setHotwords] = useState<BiliHotWord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.search
      .hotwords()
      .then((data) => {
        if (!cancelled) {
          setHotwords(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="bili-search-empty">
      {history.length > 0 ? (
        <section className="bili-search-empty-section">
          <div className="bili-search-empty-head">
            <span>搜索历史</span>
            <button type="button" className="bili-search-clear" onClick={onClearHistory}>
              清空
            </button>
          </div>
          <div className="bili-search-words">
            {history.map((item) => (
              <button key={item} type="button" className="bili-search-word" onClick={() => onPick(item)}>
                {item}
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <section className="bili-search-empty-section">
        <div className="bili-search-empty-head">
          <span>热搜榜</span>
        </div>
        {loading ? (
          <div className="bili-state">正在加载热搜</div>
        ) : hotwords.length > 0 ? (
          <ol className="bili-hotword-list">
            {hotwords.slice(0, 20).map((item, index) => (
              <li key={item.keyword}>
                <button type="button" className="bili-hotword-item" onClick={() => onPick(item.show_name || item.keyword)}>
                  <span className={index < 3 ? "bili-hotword-rank bili-hotword-rank-top" : "bili-hotword-rank"}>
                    {index + 1}
                  </span>
                  {item.show_name || item.keyword}
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <div className="bili-state">暂无热搜</div>
        )}
      </section>
    </div>
  );
}
