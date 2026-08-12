/**
 * 专栏 HTML 白名单 sanitize（P8）。
 *
 * 允许常见排版标签与 img/a 等，禁止 script/iframe/style/事件处理器与危险属性；
 * 无法识别或解析失败时调用方可降级纯文本。
 */

/** 允许的标签白名单 */
const ALLOWED_TAGS = new Set([
  "p", "br", "img", "a", "strong", "b", "em", "i", "u", "s",
  "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
  "blockquote", "code", "pre", "hr", "span", "div",
  "table", "thead", "tbody", "tr", "th", "td",
  "figure", "figcaption", "sup", "sub",
]);

/** 允许的属性白名单（按标签） */
const ALLOWED_ATTRS: Record<string, string[]> = {
  img: ["src", "alt", "title", "width", "height"],
  a: ["href", "title", "target", "rel"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan"],
};

/** 事件处理器属性前缀（全部禁止） */
const EVENT_ATTR_PREFIX = "on";

/** 危险链接协议（href/src） */
const DANGEROUS_PROTOCOLS = ["javascript:", "data:text/html", "vbscript:"];

/**
 * 对专栏 HTML 做白名单清洗，返回安全 HTML；输入不是有效 HTML 时返回空字符串。
 */
export function sanitizeHtml(raw: string): string {
  if (typeof DOMParser === "undefined") return "";
  const doc = new DOMParser().parseFromString(raw, "text/html");
  if (!doc.body) return "";

  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      const tag = child.tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) {
        // 不允许的标签：保留纯文本内容，去掉标签本身（script/style 内容直接丢弃）
        const isDangerous = tag === "script" || tag === "style" || tag === "iframe" || tag === "object" || tag === "embed";
        const replacement = (child.ownerDocument ?? doc).createDocumentFragment();
        if (!isDangerous) {
          while (child.firstChild) replacement.appendChild(child.firstChild);
        }
        node.replaceChild(replacement, child);
        continue;
      }
      // 清洗属性
      for (const attr of Array.from(child.attributes)) {
        const name = attr.name.toLowerCase();
        if (name.startsWith(EVENT_ATTR_PREFIX)) {
          child.removeAttribute(attr.name);
          continue;
        }
        const allowed = ALLOWED_ATTRS[tag] ?? [];
        if (!allowed.includes(name)) {
          child.removeAttribute(attr.name);
          continue;
        }
        if (name === "href" || name === "src") {
          const value = attr.value.trim().toLowerCase();
          if (DANGEROUS_PROTOCOLS.some((protocol) => value.startsWith(protocol))) {
            child.removeAttribute(attr.name);
          } else if (name === "href" && child.getAttribute("target")) {
            child.setAttribute("rel", "noreferrer");
          }
        }
      }
      if (tag === "a") {
        // 外链默认新窗口打开
        if (!child.getAttribute("target")) child.setAttribute("target", "_blank");
        if (!child.getAttribute("rel")) child.setAttribute("rel", "noreferrer");
      }
      walk(child);
    }
  };

  walk(doc.body);
  return doc.body.innerHTML;
}

/**
 * 把 HTML 中的专栏图片 src 换成本地代理 URL（Bilibili 图片在 webview 直连 403）。
 * 逐张异步替换；URL 无法代理时保留原值。
 */
export async function proxyArticleImages(
  container: HTMLElement,
  proxy: (rawUrl: string) => Promise<string | null>,
): Promise<void> {
  const images = Array.from(container.querySelectorAll<HTMLImageElement>("img[src]"));
  await Promise.all(
    images.map(async (img) => {
      const rawUrl = img.getAttribute("src") || "";
      if (!rawUrl) return;
      try {
        const proxied = await proxy(rawUrl);
        if (proxied) img.setAttribute("src", proxied);
        img.setAttribute("loading", "lazy");
      } catch {
        // 代理失败保留原地址，浏览器自行处理
      }
    }),
  );
}
