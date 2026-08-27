// Shared support for the <footnote><text>..</text><content>..</content></footnote>
// inline markup: turns it into a clickable span plus a lookup of span id ->
// footnote content HTML. Used anywhere admin-authored HTML might contain
// footnotes (narrative chapters, map descriptions, ...).

export const decodeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
};

export const escapeHtml = (str) =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Returns { html, store } where `html` has every <footnote> replaced with a
// clickable span carrying a data-fn id, and `store` maps that id to the
// footnote's inner content HTML.
export function extractFootnotes(html, idPrefix) {
  if (!html) return { html: '', store: {} };

  const store = {};
  const dec = decodeHtml(html);
  const footnoteRe = /<footnote\b[^>]*>([\s\S]*?)<\/footnote\s*>/gi;
  let counter = 0;

  const transformed = dec.replace(footnoteRe, (_full, inner) => {
    const textMatch = /<text\b[^>]*>([\s\S]*?)<\/text\s*>/i.exec(inner);
    const contentMatch = /<content\b[^>]*>([\s\S]*?)<\/content\s*>/i.exec(inner);

    const displayTextRaw = textMatch ? textMatch[1] : '';
    const displayText = escapeHtml(displayTextRaw.replace(/<[^>]*>/g, ''));
    const modalHtml = contentMatch ? contentMatch[1] : '';

    const id = `fn-${idPrefix}-${counter++}`;
    store[id] = modalHtml;

    return `<span class="footnote-inline" data-fn="${id}" role="button" tabindex="0" style="cursor:pointer;text-decoration:underline;">${displayText}</span>`;
  });

  return { html: transformed, store };
}
