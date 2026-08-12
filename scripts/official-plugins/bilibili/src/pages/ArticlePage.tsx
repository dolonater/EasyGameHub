import React, { useEffect, useRef, useState } from "sdk";
import { BiliImage } from "../components/BiliImage";
import { JsonBody } from "../components/JsonBody";
import { proxyArticleImages, sanitizeHtml } from "../lib/sanitize";
import { openSpace } from "../navigation";
import { errorMessage, getState } from "../runtime";
import type { BiliArticleView } from "../types";

interface ArticlePageProps {
  articleId: number;
}

/**
 * 专栏阅读页（P8）：type=3 JSON 段落优先渲染；type=0 HTML 白名单 sanitize
 * （失败降级纯文本）；点赞/投币乐观更新回滚；图片懒加载。
 */
export function ArticlePage({ articleId }: ArticlePageProps) {
  const [article, setArticle] = useState<BiliArticleView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [likeBusy, setLikeBusy] = useState(false);
  const [coinBusy, setCoinBusy] = useState(false);
  const [coinMessage, setCoinMessage] = useState("");
  const htmlRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const sdk = getState().sdk;
    if (!sdk) return;
    sdk.bilibili.article
      .view({ articleId })
      .then((data) => {
        if (active) setArticle(data);
      })
      .catch((err: Error) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [articleId]);

  // HTML 正文：渲染后把图片 src 换成代理 URL（懒加载）
  useEffect(() => {
    const container = htmlRef.current;
    if (!container || !article || article.contentType !== "html") return;
    const sdk = getState().sdk;
    if (!sdk) return;
    void proxyArticleImages(container, (rawUrl) =>
      sdk.bilibili.cache.coverProxyUrl(rawUrl),
    );
  }, [article]);

  if (loading) return <div className="bili-state">正在加载专栏…</div>;
  if (error || !article) return <div className="bili-state bili-state-error">{error || "专栏加载失败"}</div>;

  function toggleLike() {
    if (likeBusy || !article) return;
    const sdk = getState().sdk;
    if (!sdk) return;
    const previous = article;
    const next = !article.isLiked;
    setLikeBusy(true);
    setArticle({ ...article, isLiked: next, stats: { ...article.stats, like: article.stats.like + (next ? 1 : -1) } });
    sdk.bilibili.article
      .like({ articleId, like: next })
      .catch((err: Error) => {
        // 乐观更新回滚
        setArticle(previous);
        setCoinMessage(errorMessage(err));
      })
      .finally(() => setLikeBusy(false));
  }

  function coin() {
    if (coinBusy || !article) return;
    const sdk = getState().sdk;
    if (!sdk) return;
    setCoinBusy(true);
    setCoinMessage("");
    sdk.bilibili.article
      .coin({ articleId, upid: article.author.mid })
      .then(() => {
        setCoinMessage("投币成功");
        setArticle((current) =>
          current ? { ...current, stats: { ...current.stats, coin: current.stats.coin + 1 } } : current,
        );
      })
      .catch((err: Error) => setCoinMessage(errorMessage(err)))
      .finally(() => setCoinBusy(false));
  }

  return (
    <section className="bili-article">
      <header className="bili-article-head">
        <h1 className="bili-article-title">{article.title}</h1>
        <div className="bili-article-author">
          <button type="button" className="bili-article-author-main" onClick={() => openSpace(article.author.mid)}>
            <BiliImage className="bili-article-avatar" src={article.author.face} alt={article.author.name} />
            <span>{article.author.name}</span>
          </button>
          <small>{formatPubTime(article.pubTime)}</small>
          <small>{article.words > 0 ? `${formatCount(article.words)} 字` : ""}</small>
        </div>
        <div className="bili-article-stats">
          <button
            type="button"
            className={article.isLiked ? "bili-article-stat bili-article-stat-active" : "bili-article-stat"}
            onClick={toggleLike}
            disabled={likeBusy}
          >
            {article.isLiked ? "已赞" : "点赞"} {formatCount(article.stats.like)}
          </button>
          <button type="button" className="bili-article-stat" onClick={coin} disabled={coinBusy}>
            投币 {formatCount(article.stats.coin)}
          </button>
          <span className="bili-article-stat">{formatCount(article.stats.view)} 阅读</span>
          {coinMessage ? <span className="bili-article-coin-message">{coinMessage}</span> : null}
        </div>
      </header>

      {article.contentType === "json" ? (
        <JsonBody content={article.content} />
      ) : (
        <HtmlContent content={article.content} htmlRef={htmlRef} />
      )}

      {article.tags.length > 0 ? (
        <div className="bili-article-tags">
          {article.tags.map((tag) => (
            <span key={tag} className="bili-article-tag">{tag}</span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** type=0：白名单 sanitize 后渲染；无有效内容时降级纯文本 */
function HtmlContent({ content, htmlRef }: { content: string; htmlRef: { current: HTMLDivElement | null } }) {
  const [html, setHtml] = useState("");
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const sanitized = sanitizeHtml(content);
    if (!sanitized) {
      setFallback(true);
      return;
    }
    setHtml(sanitized);
  }, [content]);

  if (fallback) {
    return <div className="bili-article-body bili-article-plain">{content}</div>;
  }
  return <div className="bili-article-body bili-article-html" ref={htmlRef} dangerouslySetInnerHTML={{ __html: html }} />;
}

function formatCount(value: number): string {
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)} 亿`;
  if (value >= 10000) return `${(value / 10000).toFixed(1)} 万`;
  return String(value);
}

function formatPubTime(value: number): string {
  if (!value) return "";
  const date = new Date(value * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
