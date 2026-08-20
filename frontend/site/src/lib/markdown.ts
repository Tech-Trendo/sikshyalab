/**
 * Lightweight Markdown → HTML for trusted admin blog content.
 * Also passes through existing HTML bodies unchanged.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineFormat(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
}

function looksLikeHtml(source: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(source.trim());
}

/** Strip script/style/handlers from trusted CMS HTML before rendering. */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

/** Convert Markdown (or pass through HTML) into safe-enough HTML for blog display. */
export function renderBlogContent(source: string): string {
  const raw = (source || "").trim();
  if (!raw) return "";
  if (looksLikeHtml(raw)) return sanitizeHtml(raw);

  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let inUl = false;
  let inOl = false;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inlineFormat(paragraph.join(" ").trim())}</p>`);
    paragraph = [];
  };

  const closeLists = () => {
    if (inUl) {
      html.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      html.push("</ol>");
      inOl = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      closeLists();
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeLists();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineFormat(heading[2])}</h${level}>`);
      continue;
    }

    const ul = trimmed.match(/^[-*+]\s+(.+)$/);
    if (ul) {
      flushParagraph();
      if (inOl) {
        html.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        html.push("<ul>");
        inUl = true;
      }
      html.push(`<li>${inlineFormat(ul[1])}</li>`);
      continue;
    }

    const ol = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      flushParagraph();
      if (inUl) {
        html.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        html.push("<ol>");
        inOl = true;
      }
      html.push(`<li>${inlineFormat(ol[1])}</li>`);
      continue;
    }

    if (trimmed.startsWith("> ")) {
      flushParagraph();
      closeLists();
      html.push(`<blockquote><p>${inlineFormat(trimmed.slice(2))}</p></blockquote>`);
      continue;
    }

    closeLists();
    paragraph.push(trimmed);
  }

  flushParagraph();
  closeLists();
  return sanitizeHtml(html.join("\n"));
}
