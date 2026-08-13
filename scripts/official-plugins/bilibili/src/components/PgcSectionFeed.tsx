import React, { Button, useEffect, useState } from "sdk";
import type { BiliPgcSection } from "../types";
import { openBangumi, openPgcList, openSeason } from "../navigation";
import { errorMessage, getState } from "../runtime";
import { VideoCard, pgcToVideoCard } from "./VideoCard";

interface PgcSectionFeedProps {
  kind: "bangumi" | "cinema";
}

/** kind → season_type（season/index/result）：bangumi=1 番剧、cinema=2 电影。 */
const SEASON_TYPE: Record<"bangumi" | "cinema", number> = { bangumi: 1, cinema: 2 };

/**
 * 追番/影视页：分区行改为 tab（番剧推荐/国创推荐/猜你喜欢/我的追番…），
 * 选中分区显示网格，"查看全部"在 tab 行右侧。
 */
export function PgcSectionFeed({ kind }: PgcSectionFeedProps) {
  const [sections, setSections] = useState<BiliPgcSection[]>([]);
  const [active, setActive] = useState(0);
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
          setActive(0);
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

  const visible = sections.filter((section) => section.items.length > 0);
  const activeSection = visible.length > 0 ? visible[Math.min(active, visible.length - 1)] : null;

  /** 查看全部：我的追番（style=follow）去追番页 follow 列表；其余按分区卡片推断 season_type。 */
  function openSectionAll(section: BiliPgcSection) {
    if (section.style === "follow") {
      openBangumi();
      return;
    }
    const inferred = section.items[0]?.seasonType ?? 0;
    openPgcList(Number(inferred) > 0 ? Number(inferred) : SEASON_TYPE[kind], section.title);
  }

  return (
    <section className="bili-pgc-feed">
      {error ? <div className="bili-state bili-state-error">{error}</div> : null}
      {!error && loading ? <div className="bili-state">正在加载</div> : null}
      {!error && !loading && visible.length === 0 ? <div className="bili-state">暂无内容</div> : null}
      {!error && activeSection ? (
        <>
          <div className="bili-pgc-tabs-row">
            <div className="bili-hot-subtabs" role="tablist" aria-label="分区">
              {visible.map((section, index) => (
                <Button
                  key={`${section.title}-${index}`}
                  aria-selected={index === active}
                  className={index === active ? "bili-hot-subtab bili-hot-subtab-active" : "bili-hot-subtab"}
                  size="sm"
                  variant="ghost"
                  role="tab"
                  type="button"
                  onClick={() => setActive(index)}
                >
                  {section.title || "推荐"}
                </Button>
              ))}
            </div>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => openSectionAll(activeSection)}
            >
              查看全部
            </Button>
          </div>
          <div className="bili-video-grid">
            {activeSection.items.map((card) => (
              <VideoCard
                key={`${card.seasonId}-${card.seasonType}`}
                video={pgcToVideoCard(card)}
                coverRatio="poster"
                onClick={() => openSeason(card.seasonId)}
                meta={
                  <>
                    <span>{card.indexShow || "敬请期待"}</span>
                    {card.score != null ? <span>{card.score.toFixed(1)} 分</span> : null}
                  </>
                }
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
