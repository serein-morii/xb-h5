/**
 * 站内信富文本安全渲染：text / markdown / html 三种内容统一输出经过过滤的 HTML。
 *
 * 安全规则（防 XSS）：
 *  - text / markdown：先整体 HTML 转义，再叠加格式，用户内容永远不会以原始 HTML 出现；
 *  - html：走白名单 sanitizer，标签外的属性、事件、javascript: 链接全部剔除。
 */

export type RichContentType = "text" | "markdown" | "html";

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** 允许保留的 HTML 标签（sanitize 白名单） */
const ALLOWED_TAGS = new Set([
  "p", "br", "hr", "span", "div", "section", "center", "font",
  "strong", "b", "em", "i", "u", "s", "del", "mark", "small", "sub", "sup",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "blockquote", "pre", "code",
  "a", "img", "table", "thead", "tbody", "tfoot", "caption", "tr", "th", "td",
]);

const SAFE_URL = /^(https?:|mailto:|\/|#)/i;

/**
 * 内联样式白名单：只保留排版类属性，值中出现 url()/expression()/position 等危险或定位类内容一律剔除。
 * 这样广播里的 HTML 公告（如邮件模板风格的标题、配色、居中）能正常显示，又不引入 XSS 面。
 */
const SAFE_STYLE_PROPERTIES = new Set([
  "color", "background", "background-color", "opacity",
  "font-size", "font-weight", "font-style", "font-family", "line-height", "letter-spacing",
  "text-align", "text-decoration", "text-indent", "text-transform", "white-space", "word-break",
  "margin", "margin-top", "margin-bottom", "margin-left", "margin-right",
  "padding", "padding-top", "padding-bottom", "padding-left", "padding-right",
  "border", "border-top", "border-bottom", "border-left", "border-right",
  "border-color", "border-width", "border-style", "border-radius",
  "display", "flex-direction", "align-items", "justify-content", "gap", "flex-wrap",
  "width", "max-width", "min-width", "height", "max-height", "min-height",
  "vertical-align", "overflow-wrap", "box-sizing",
  "border-collapse", "border-spacing", "table-layout", "box-shadow",
  "grid-template-columns", "align-self", "flex", "row-gap", "column-gap",
]);

const UNSAFE_STYLE_VALUE = /(url\s*\(|expression|javascript:|@import|position\s*:|fixed|sticky|z-index|calc\s*\(|var\s*\()/i;

function sanitizeStyleAttr(value: string | null): string | null {
  if (!value) return null;
  const kept: string[] = [];
  for (const declaration of value.split(";")) {
    const colon = declaration.indexOf(":");
    if (colon <= 0) continue;
    const property = declaration.slice(0, colon).trim().toLowerCase();
    const styleValue = declaration.slice(colon + 1).trim();
    if (!property || !styleValue) continue;
    if (!SAFE_STYLE_PROPERTIES.has(property)) continue;
    if (UNSAFE_STYLE_VALUE.test(styleValue)) continue;
    if (styleValue.includes("\\") || styleValue.includes("<")) continue;
    kept.push(`${property}: ${styleValue}`);
  }
  return kept.length ? kept.join("; ") : null;
}

function sanitizeUrl(value: string | null): string | null {
  const url = (value || "").trim();
  if (!url || !SAFE_URL.test(url)) return null;
  return url.replace(/"/g, "%22");
}

/** DOM 白名单过滤：仅保留安全标签与必要属性，其余全部剔除。 */
export function sanitizeRichHtml(html: string): string {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") return escapeHtml(html);
  const doc = new DOMParser().parseFromString(html, "text/html");
  // Resolve embedded template CSS only against this detached document. Never mount
  // author styles in the application, where selectors could affect other UI.
  const originalStyles = new Map<Element, string>();
  doc.querySelectorAll("[style]").forEach((node) => originalStyles.set(node, node.getAttribute("style") || ""));
  if (typeof CSSStyleSheet !== "undefined") {
    for (const style of Array.from(doc.querySelectorAll("style"))) {
      try {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(style.textContent || "");
        for (const rule of Array.from(sheet.cssRules)) {
          if (!(rule instanceof CSSStyleRule)) continue;
          const safe = sanitizeStyleAttr(rule.style.cssText);
          if (!safe) continue;
          try {
            doc.querySelectorAll(rule.selectorText).forEach((node) => {
              node.setAttribute("style", `${node.getAttribute("style") || ""};${safe}`);
            });
          } catch { /* Unsupported selectors do not prevent reading the message. */ }
        }
      } catch { /* Invalid template CSS is ignored. */ }
    }
  }
  originalStyles.forEach((style, node) => node.setAttribute("style", `${node.getAttribute("style") || ""};${style}`));
  doc.querySelectorAll("script,style,iframe,frame,object,embed,link,meta,form,input,button,svg,math,audio,video,source,base").forEach((node) => node.remove());
  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      walk(child);
      if (!ALLOWED_TAGS.has(child.tagName.toLowerCase())) {
        // 未知标签：保留其文本内容，丢弃标签与属性
        child.replaceWith(...Array.from(child.childNodes));
        continue;
      }
      for (const attribute of Array.from(child.attributes)) {
        const name = attribute.name.toLowerCase();
        const drop = !["style", "href", "src", "alt", "title", "colspan", "rowspan", "align", "color", "face"].includes(name)
          || ((name === "href" || name === "src") && !sanitizeUrl(child.getAttribute(name)));
        if (drop) { child.removeAttribute(attribute.name); continue; }
        if (name === "style") {
          const safeStyle = sanitizeStyleAttr(child.getAttribute("style"));
          if (safeStyle) child.setAttribute("style", safeStyle);
          else child.removeAttribute("style");
        }
      }
      if (child.tagName.toLowerCase() === "a") {
        const href = sanitizeUrl(child.getAttribute("href"));
        child.setAttribute("rel", "noopener noreferrer nofollow");
        child.setAttribute("target", "_blank");
        if (href) child.setAttribute("href", href);
      }
      if (child.tagName.toLowerCase() === "img") {
        const src = sanitizeUrl(child.getAttribute("src"));
        if (!src) { child.remove(); continue; }
        child.setAttribute("src", src);
        child.setAttribute("loading", "lazy");
        child.setAttribute("alt", child.getAttribute("alt") || "图片");
      }
    }
  };
  walk(doc.body);
  const bodyStyle = sanitizeStyleAttr(doc.body.getAttribute("style"));
  return bodyStyle ? `<div style="${escapeHtml(bodyStyle)}">${doc.body.innerHTML}</div>` : doc.body.innerHTML;
}

/** 极简 Markdown：标题/粗体/斜体/行内代码/代码块/链接/列表/引用/分隔线，输入已转义。 */
export function markdownToSafeHtml(markdown: string): string {
  const escaped = escapeHtml(markdown.replace(/\r\n/g, "\n"));
  const lines = escaped.split("\n");
  const out: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let inCodeBlock = false;
  let paragraph: string[] = [];

  const closeParagraph = () => {
    if (paragraph.length) { out.push(`<p>${inlineMarkdown(paragraph.join("<br />"))}</p>`); paragraph = []; }
  };
  const closeList = () => {
    if (listType) { out.push(`</${listType}>`); listType = null; }
  };
  const inline = (value: string) => inlineMarkdown(value);

  for (const rawLine of lines) {
    if (rawLine.trim().startsWith("```")) {
      closeParagraph(); closeList();
      if (inCodeBlock) { out.push("</code></pre>"); inCodeBlock = false; }
      else { out.push("<pre><code>"); inCodeBlock = true; }
      continue;
    }
    if (inCodeBlock) { out.push(rawLine); continue; }
    const line = rawLine.trimEnd();
    if (!line.trim()) { closeParagraph(); closeList(); continue; }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeParagraph(); closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { closeParagraph(); closeList(); out.push("<hr />"); continue; }
    const bullet = line.match(/^[-*+]\s+(.*)$/);
    if (bullet) {
      closeParagraph();
      if (listType !== "ul") { closeList(); out.push("<ul>"); listType = "ul"; }
      out.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }
    const ordered = line.match(/^\d+[.)]\s+(.*)$/);
    if (ordered) {
      closeParagraph();
      if (listType !== "ol") { closeList(); out.push("<ol>"); listType = "ol"; }
      out.push(`<li>${inline(ordered[1])}</li>`);
      continue;
    }
    const quote = line.match(/^&gt;\s?(.*)$/);
    if (quote) {
      closeParagraph(); closeList();
      out.push(`<blockquote><p>${inline(quote[1])}</p></blockquote>`);
      continue;
    }
    closeList();
    paragraph.push(line);
  }
  if (inCodeBlock) out.push("</code></pre>");
  closeParagraph(); closeList();
  return out.join("\n");
}

function inlineMarkdown(value: string): string {
  const tokens: string[] = [];
  const stash = (html: string) => { tokens.push(html); return `\uE000${tokens.length - 1}\uE000`; };
  return value
    .replace(/\uE000/g, "&#57344;")
    .replace(/`([^`]+)`/g, (_match, code: string) => stash(`<code>${code}</code>`))
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/gi, (_match, label: string, url: string) =>
      stash(`<a href="${url}" target="_blank" rel="noopener noreferrer nofollow">${label}</a>`))
    .replace(/https?:\/\/[^\s<]+/g, (url) => stash(`<a href="${url}" target="_blank" rel="noopener noreferrer nofollow">${url}</a>`))
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/\uE000(\d+)\uE000/g, (_match, index: string) => tokens[Number(index)] || "");
}

/** 统一入口：任意内容类型 → 安全 HTML。 */
export function renderRichText(content: string | null | undefined, contentType: string | null | undefined): string {
  const value = content || "";
  switch ((contentType || "text").toLowerCase()) {
    case "markdown":
      return markdownToSafeHtml(value);
    case "html":
      return sanitizeRichHtml(value);
    default:
      return `<p>${escapeHtml(value).replace(/\n/g, "<br />")}</p>`;
  }
}
