import React from "sdk";
import { openArticle } from "../navigation";
import type { BiliArticleCard } from "../types";
import { BiliImage } from "./BiliImage";

/** 专栏卡片（UP 主页专栏 tab / 搜索），点击进 article 视图（P8）。 */
export function ArticleCard({ article }: { article: BiliArticleCard }) {
  return (
    <button type="button" className="bili-article-card" onClick={() => openArticle(article.id)}>
      {(article.bannerUrl || article.imageUrls?.[0]) ? (
        <div className="bili-article-card-cover">
          <BiliImage src={article.bannerUrl || article.imageUrls?.[0]} alt={article.title} loading="lazy" />
        </div>
      ) : null}
      <strong className="bili-article-card-title">{article.title}</strong>
      {article.summary ? <span className="bili-article-card-summary">{article.summary}</span> : null}
      <div className="bili-article-card-meta">
        <span>{formatPubTime(article.pubTime)}</span>
        {article.viewCount > 0 ? <span>{formatCount(article.viewCount)} 阅读</span> : null}
        {article.likeCount > 0 ? <span>{formatCount(article.likeCount)} 点赞</span> : null}
      </div>
    </button>
  );
}

function formatCount(value: number): string {
  if (value >= 10000) return `${(value / 10000).toFixed(1)} 万`;
  return String(value);
}

function formatPubTime(value: number): string {
  if (!value) return "";
  const date = new Date(value * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
