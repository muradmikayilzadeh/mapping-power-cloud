import React, { useMemo, useRef, useState } from 'react';
import styles from './style.module.css';
import { openLinksInNewTab } from '../../utils/linkify';
import { extractFootnotes } from '../../utils/footnotes';

const hasVisibleText = (html) => !!html && String(html).replace(/<[^>]*>/g, '').trim().length > 0;

const Modal = ({ isOpen, onClose, title, content, footnotes, image, type }) => {
  const [footnoteOpen, setFootnoteOpen] = useState(false);
  const [footnoteHtml, setFootnoteHtml] = useState('');
  const footnoteStoreRef = useRef({});

  const processedContent = useMemo(() => {
    const { html, store } = extractFootnotes(content, 'modal-content');
    Object.assign(footnoteStoreRef.current, store);
    return html;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  const processedFootnotes = useMemo(() => {
    const { html, store } = extractFootnotes(footnotes, 'modal-footnotes');
    Object.assign(footnoteStoreRef.current, store);
    return html;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [footnotes]);

  const handleContentClick = (e) => {
    e.stopPropagation();
    const el = e.target.closest && e.target.closest('.footnote-inline');
    if (!el) return;
    const id = el.getAttribute('data-fn');
    setFootnoteHtml((id && footnoteStoreRef.current[id]) || '');
    setFootnoteOpen(true);
  };

  if (!isOpen) return null;

  // If it's a share modal, use the special share layout
  if (type === 'share') {
    return (
      <div className={styles.shareModalOverlay} onClick={onClose}>
        <div className={styles.shareModalContent} onClick={(e) => e.stopPropagation()}>
          <span className={styles.closeButton} onClick={onClose}>×</span>
          
          <h5>Share current view</h5>
          
          {/* Social Icons */}
          <div className={styles.socialIconsContainer}>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.socialLink}
            >
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg"
                alt="Facebook"
                className={styles.socialIcon}
              />
              <span>Facebook</span>
            </a>
            <a
              href={`https://x.com/intent/tweet?url=${encodeURIComponent(window.location.href)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.socialLink}
            >
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/c/cc/X_icon.svg"
                alt="X"
                className={styles.socialIcon}
              />
              <span>X</span>
            </a>

          </div>

          <div className={styles.orDivider}>-OR-</div>

          {/* Link to share */}
          <p>Link to share</p>
          <textarea
            className={styles.shareLink}
            readOnly
            value={window.location.href}
          />
        </div>
      </div>
    );
  }

  // Default modal layout (for non-share modals)
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <span className={styles.closeButton} onClick={onClose}>×</span>
        {image && <img src={image} alt="Modal" className={styles.modalImage} />}
        <h2>{title}</h2>
        <div onClick={handleContentClick} dangerouslySetInnerHTML={{ __html: openLinksInNewTab(processedContent) }} />
        {hasVisibleText(footnotes) && (
          <div className={styles.footnotesSection}>
            <h3>Footnotes</h3>
            <div onClick={handleContentClick} dangerouslySetInnerHTML={{ __html: openLinksInNewTab(processedFootnotes) }} />
          </div>
        )}
      </div>

      {footnoteOpen && (
        <div
          className={styles.footnotePopupOverlay}
          onClick={(e) => { e.stopPropagation(); setFootnoteOpen(false); }}
        >
          <div className={styles.footnotePopupContent} onClick={(e) => e.stopPropagation()}>
            <div dangerouslySetInnerHTML={{ __html: openLinksInNewTab(footnoteHtml) }} />
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button type="button" onClick={() => setFootnoteOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Modal;
