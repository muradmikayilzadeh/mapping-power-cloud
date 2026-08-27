import React, { useRef, useState } from 'react';
import {
  BtnBold,
  BtnBulletList,
  BtnClearFormatting,
  BtnItalic,
  BtnLink,
  BtnNumberedList,
  BtnRedo,
  BtnStrikeThrough,
  BtnStyles,
  BtnUnderline,
  BtnUndo,
  Editor,
  EditorProvider,
  HtmlButton,
  Separator,
  Toolbar,
  useEditorState,
} from 'react-simple-wysiwyg';

// Inserts a <footnote><text>marker</text><content>popup body</content></footnote>
// span at the cursor — the same markup the public site already knows how to
// turn into a clickable, popup-triggering footnote. Saves people from having
// to hand-write (or macro-type) that markup themselves.
function BtnFootnote() {
  const editorState = useEditorState();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [content, setContent] = useState('');
  const savedRangeRef = useRef(null);

  // Hidden in HTML source mode — insertion below targets the rendered
  // contentEditable, not the raw-HTML textarea.
  if (editorState.htmlMode) return null;

  const openModal = () => {
    const selection = window.getSelection();
    savedRangeRef.current =
      selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
    setLabel('');
    setContent('');
    setOpen(true);
  };

  const insertFootnote = () => {
    const el = editorState.$el;
    if (el) {
      el.focus();
      const selection = window.getSelection();
      if (savedRangeRef.current) {
        selection.removeAllRanges();
        selection.addRange(savedRangeRef.current);
      }
      const marker = (label.trim() || 'note').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const html = `<footnote><text>${marker}</text><content>${content}</content></footnote>&nbsp;`;
      document.execCommand('insertHTML', false, html);
    }
    setOpen(false);
  };

  return (
    <>
      <button type="button" className="rsw-btn" title="Insert footnote" onClick={openModal}>
        [fn]
      </button>
      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: 8, padding: '18px 20px', width: '90%', maxWidth: 480 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Insert Footnote</h3>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              Marker text (what readers click)
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. 1"
              style={{ width: '100%', marginBottom: 12, padding: '8px 10px' }}
              autoFocus
            />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              Footnote content (shown in the pop-up — basic HTML tags are OK)
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              style={{ width: '100%', padding: '8px 10px', fontFamily: 'inherit' }}
            />
            <div style={{ marginTop: 14, textAlign: 'right', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" onClick={insertFootnote} disabled={!content.trim()}>Insert</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Drop-in replacement for the default react-simple-wysiwyg <Editor>, with an
// added "Insert Footnote" toolbar button. Same props (value/onChange/className).
export default function RichTextEditor(props) {
  return (
    <EditorProvider>
      <Editor {...props}>
        <Toolbar>
          <BtnUndo />
          <BtnRedo />
          <Separator />
          <BtnBold />
          <BtnItalic />
          <BtnUnderline />
          <BtnStrikeThrough />
          <Separator />
          <BtnNumberedList />
          <BtnBulletList />
          <Separator />
          <BtnLink />
          <BtnClearFormatting />
          <HtmlButton />
          <Separator />
          <BtnStyles />
          <Separator />
          <BtnFootnote />
        </Toolbar>
      </Editor>
    </EditorProvider>
  );
}
