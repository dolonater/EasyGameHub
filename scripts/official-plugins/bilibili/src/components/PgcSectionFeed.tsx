import React, { useEffect, useState } from "sdk";
import type { BiliPgcSection } from "../types";
import { errorMessage, getState } from "../runtime";
import { PgcCard } from "./PgcCard";

interface PgcSectionFeedProps {
  kind: "bangumi" | "cinema";
}

/** 追番/影视页：modules 分区行渲染（标题 + 横向滚动卡片） */
export function PgcSectionFeed({ kind }: PgcSectionFeedProps) {
  const [sections, setSections] = useState<BiliPgcSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.season
      .pgcTabs({ kind })
      .then((data) => {
        if (!cancelled) {
          setSections(data);
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
  }, [kind]);

  return (
    <section className="bili-pgc-feed">
      {error ? <div className="bili-state bili-state-error">{error}</div> : null}
      {!error && loading ? <div className="bili-state">正在加载</div> : null}
      {!error && !loading && sections.length === 0 ? <div className="bili-state">暂无内容</div> : null}
      {!error &&
        sections.map((section) =>
          section.items.length > 0 ? (
            <div className="bili-pgc-section" key={section.title}>
              <div className="bili-pgc-section-title">{section.title}</div>
              <div className="bili-pgc-track">
                {section.items.map((card) => (
                  <PgcCard key={`${card.seasonId}-${card.seasonType}`} card={card} />
                ))}
              </div>
            </div>
          ) : null,
        )}
    </section>
  );
}
