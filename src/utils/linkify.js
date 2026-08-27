// Forces every link inside admin-authored HTML (descriptions, narrative
// content, footnotes, etc.) to open in a new tab, so visitors are never
// navigated away from the site by an external link.
export const openLinksInNewTab = (html) => {
  if (!html) return html;
  try {
    const container = document.createElement('div');
    container.innerHTML = html;
    container.querySelectorAll('a[href]').forEach((a) => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });
    return container.innerHTML;
  } catch (e) {
    return html;
  }
};
