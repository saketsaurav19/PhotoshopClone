import React from 'react';

interface TextEditorOverlayProps {
  textEditor: { x: number, y: number, value: string } | null;
  setTextEditor: React.Dispatch<React.SetStateAction<{ x: number, y: number, value: string } | null>>;
  hiddenTextInputRef: React.RefObject<HTMLTextAreaElement>;
  draftTextCanvasRef: React.RefObject<HTMLCanvasElement>;
  documentSize: { w: number, h: number };
  commitText: () => void;
  cancelText: () => void;
}

export const TextEditorOverlay: React.FC<TextEditorOverlayProps> = ({
  textEditor,
  setTextEditor,
  hiddenTextInputRef,
  draftTextCanvasRef,
  documentSize,
  commitText,
  cancelText
}) => {
  if (!textEditor) return null;

  return (
    <>
      <textarea
        ref={hiddenTextInputRef}
        className="text-editor-input"
        style={{
          position: 'absolute',
          left: textEditor.x / 2,
          top: textEditor.y / 2,
          zIndex: 10001
        }}
        value={textEditor.value}
        onChange={(e) => setTextEditor(prev => prev ? { ...prev, value: e.target.value } : null)}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="sentences"
        spellCheck={false}
        inputMode="text"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      />
      <canvas
        ref={draftTextCanvasRef}
        width={documentSize.w}
        height={documentSize.h}
        className="layer-canvas visible"
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '100%', height: '100%',
          opacity: 1,
          zIndex: 9999, // Render above everything while typing
          mixBlendMode: 'normal',
          pointerEvents: 'none'
        }}
      />
      <div
        className="text-tool-interface"
        style={{
          position: 'absolute',
          left: textEditor.x / 2,
          top: textEditor.y / 2 - 45,
          zIndex: 20000,
          display: 'flex',
          gap: '8px',
          pointerEvents: 'auto',
          background: '#222',
          padding: '6px',
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          border: '1px solid #444'
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          className="text-action-btn confirm"
          onClick={(e) => { e.stopPropagation(); commitText(); }}
          style={{ background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          ✓
        </button>
        <button
          className="text-action-btn cancel"
          onClick={(e) => { e.stopPropagation(); cancelText(); }}
          style={{ background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          ✕
        </button>
      </div>
    </>
  );
};
