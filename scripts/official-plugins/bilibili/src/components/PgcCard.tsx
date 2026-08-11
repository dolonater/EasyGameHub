import React from "sdk";
import type { BiliPgcCard } from "../types";
import { openSeason } from "../navigation";
import { BiliImage } from "./BiliImage";

interface PgcCardProps {
  card: BiliPgcCard;
}

export function PgcCard({ card }: PgcCardProps) {
  return (
    <button className="bili-pgc-card" type="button" onClick={() => openSeason(card.seasonId)}>
      <span className="bili-cover-wrap">
        {card.cover ? (
          <BiliImage className="bili-pgc-cover" src={card.cover} loading="lazy" />
        ) : (
          <span className="bili-cover-empty">Bilibili</span>
        )}
        {card.score != null ? <span className="bili-pgc-score">{card.score.toFixed(1)}</span> : null}
      </span>
      <span className="bili-video-body">
        <strong title={card.title}>{card.title || "未命名番剧"}</strong>
        <small>{card.indexShow || "敬请期待"}</small>
      </span>
    </button>
  );
}
