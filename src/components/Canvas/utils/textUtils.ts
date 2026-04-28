import type { Point } from '../types';

export const commitText = (
  textEditor: (Point & { value: string }) | null,
  brushSize: number,
  brushColor: string,
  primaryOpacity: number,
  strokeWidth: number,
  secondaryColor: string,
  secondaryOpacity: number,
  hexToRgba: (hex: string, alpha: number) => string,
  addLayer: (layer: any) => void,
  recordHistory: (label: string) => void,
  setTextEditor: (val: any) => void,
  hiddenTextInputRef: React.RefObject<HTMLTextAreaElement>
) => {
  hiddenTextInputRef.current?.blur();

  if (textEditor && textEditor.value.trim()) {
    const typedText = textEditor.value.trim();
    addLayer({
      name: typedText.length > 20 ? typedText.substring(0, 20) + '...' : typedText,
      type: 'text',
      textContent: textEditor.value,
      position: { x: textEditor.x, y: textEditor.y },
      fontSize: brushSize * 2,
      color: hexToRgba(brushColor, primaryOpacity),
      strokeColor: strokeWidth > 0 ? hexToRgba(secondaryColor, secondaryOpacity) : undefined,
      strokeWidth: strokeWidth,
      isVertical: (window as any)._lastTextTool === 'vertical_text',
      visible: true, opacity: 1
    });
    recordHistory('Add Text Layer');
  }
  setTextEditor(null);
};

export const cancelText = (
  setTextEditor: (val: any) => void,
  hiddenTextInputRef: React.RefObject<HTMLTextAreaElement>
) => {
  hiddenTextInputRef.current?.blur();
  setTextEditor(null);
};
