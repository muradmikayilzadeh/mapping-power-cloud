import React, { useRef, useState } from 'react';
import styles from './style.module.css';

// Full-screen preview for pin images: click to open, scroll/wheel or
// double-click to zoom, drag to pan while zoomed in.
export default function Lightbox({ src, caption, onClose }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);

  const clampScale = (s) => Math.min(6, Math.max(1, s));

  const handleWheel = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const next = clampScale(scale + (e.deltaY < 0 ? 0.2 : -0.2));
    setScale(next);
    if (next === 1) setPos({ x: 0, y: 0 });
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (scale > 1) {
      setScale(1);
      setPos({ x: 0, y: 0 });
    } else {
      setScale(2.5);
    }
  };

  const handleMouseDown = (e) => {
    if (scale <= 1) return;
    e.stopPropagation();
    dragRef.current = { startX: e.clientX - pos.x, startY: e.clientY - pos.y };
  };

  const handleMouseMove = (e) => {
    if (!dragRef.current) return;
    setPos({
      x: e.clientX - dragRef.current.startX,
      y: e.clientY - dragRef.current.startY,
    });
  };

  const stopDrag = () => {
    dragRef.current = null;
  };

  return (
    <div className={styles.lightboxOverlay} onClick={onClose}>
      <button
        type="button"
        className={styles.lightboxClose}
        onClick={onClose}
        aria-label="Close enlarged image"
      >
        ×
      </button>
      <div
        className={styles.lightboxImageWrap}
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
      >
        <img
          src={src}
          alt={caption ? caption.replace(/<[^>]*>/g, '') : 'Enlarged view'}
          className={styles.lightboxImage}
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            cursor: scale > 1 ? 'grab' : 'zoom-in',
          }}
          draggable={false}
          onDoubleClick={handleDoubleClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={stopDrag}
          onMouseLeave={stopDrag}
        />
      </div>
    </div>
  );
}
