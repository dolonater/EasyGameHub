import React from "sdk";
import { BiliImage } from "./BiliImage";

type UnknownJson = Record<string, unknown>;

/**
 * 图文内容渲染（专栏 / 笔记共用）。
 *
 * 支持两种格式：
 * 1. 老格式：`[{"type":"text","text":"..."},{"type":"image","src":"..."}]`
 * 2. 新版 opus 格式：`{"paragraphs":[{"para_type":1,"text":{"nodes":[{"node_type":1,"word":{"words":"..."}}]}},...]}`
 *    （para_type 1=文本、2=图片；其余类型跳过）
 */
export function JsonBody({ content, className = "" }: { content: string; className?: string }) {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    return <PlainFallback content={content} className={className} />;
  }
  if (value && typeof value === "object" && Array.isArray((value as UnknownJson).paragraphs)) {
    return (
      <div className={`bili-article-body ${className}`.trim()}>
        {renderOpusParagraphs((value as UnknownJson).paragraphs as unknown[])}
      </div>
    );
  }
  if (Array.isArray(value)) {
    return (
      <div className={`bili-article-body ${className}`.trim()}>
        {value.map((item, index) => renderParagraph(item, index))}
      </div>
    );
  }
  if (!content.trim()) {
    return <div className="bili-state bili-state-compact">暂无内容</div>;
  }
  return <PlainFallback content={content} className={className} />;
}

function PlainFallback({ content, className }: { content: string; className?: string }) {
  return <div className={`bili-article-body bili-article-plain ${className}`.trim()}>{content}</div>;
}

/** 新版 opus 段落：para_type 1=文本（nodes[].word.words / link.show_text 拼接）、2=图片（pic.pics[].url） */
function renderOpusParagraphs(paragraphs: unknown[]): unknown[] {
  return paragraphs.map((item, index) => {
    if (!item || typeof item !== "object") return null;
    const paragraph = item as UnknownJson;
    if (paragraph.para_type === 1) {
      const nodes = (paragraph.text as UnknownJson | undefined)?.nodes;
      const text = Array.isArray(nodes)
        ? nodes
            .map((node) => {
              const raw = node as UnknownJson;
              if (raw.node_type === 1) {
                const word = raw.word as UnknownJson | undefined;
                return typeof word?.words === "string" ? word.words : "";
              }
              if (raw.node_type === 4) {
                // 链接节点：保留链接文字
                const link = raw.link as UnknownJson | undefined;
                return typeof link?.show_text === "string" ? link.show_text : "";
              }
              return "";
            })
            .join("")
        : "";
      return (
        <p key={index} className="bili-article-para">
          {text}
        </p>
      );
    }
    if (paragraph.para_type === 2) {
      const pics = (paragraph.pic as UnknownJson | undefined)?.pics;
      if (!Array.isArray(pics)) return null;
      return (
        <div key={index} className="bili-article-image">
          {pics.map((pic, picIndex) => {
            const url = (pic as UnknownJson)?.url;
            return typeof url === "string" && url ? (
              <BiliImage key={`${index}-${picIndex}`} src={url} loading="lazy" alt="" />
            ) : null;
          })}
        </div>
      );
    }
    return null;
  });
}

/** 老格式段落：type=text / image / 嵌套 children */
function renderParagraph(item: unknown, key: number): unknown {
  if (!item || typeof item !== "object") return null;
  const paragraph = item as { type?: string; text?: string; src?: string; url?: string; children?: unknown[] };
  const type = paragraph.type || "text";
  if (type === "text") {
    const text = paragraph.text || "";
    if (paragraph.children && Array.isArray(paragraph.children)) {
      return (
        <div key={key} className="bili-article-para">
          <p>{text}</p>
          {paragraph.children.map((child, index) => renderParagraph(child, index))}
        </div>
      );
    }
    return (
      <p key={key} className="bili-article-para">
        {text}
      </p>
    );
  }
  if (type === "image") {
    const src = paragraph.src || paragraph.url || "";
    if (!src) return null;
    return (
      <div key={key} className="bili-article-image">
        <BiliImage src={src} loading="lazy" alt="" />
      </div>
    );
  }
  return null;
}
