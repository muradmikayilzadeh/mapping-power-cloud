import React, { useState } from 'react';
import styles from './style.module.css';

/**
 * Renders an entry description that is collapsed to a single line by default
 * and can be expanded with a "see more" toggle. Used on the admin list pages
 * (Eras, Maps, Narratives) so long descriptions don't get in the way.
 *
 * `html` is rendered as HTML (descriptions in this app are stored as HTML).
 */
export default function CollapsibleDescription({ html, className }) {
  const [expanded, setExpanded] = useState(false);

  const text = html == null ? '' : String(html);
  const hasContent = text.replace(/<[^>]*>/g, '').trim().length > 0;
  if (!hasContent) return null;

  return (
    <div className={`${styles.wrapper} ${className || ''}`}>
      <div
        className={expanded ? styles.expanded : styles.collapsed}
        dangerouslySetInnerHTML={{ __html: text }}
      />
      <button
        type="button"
        className={styles.toggle}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setExpanded((v) => !v);
        }}
      >
        {expanded ? 'see less' : '… see more'}
      </button>
    </div>
  );
}
