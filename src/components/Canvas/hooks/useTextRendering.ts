import { useEffect } from 'react';

/**
 * Options for the useTextRendering hook.
 */
interface TextRenderingOptions {
  textEditor: { x: number, y: number, value: string } | null; // Current text editor state (position and content)
  brushSize: number; // Font size (calculated from brush size)
  brushColor: string; // Primary text color
  primaryOpacity: number; // Opacity of the text
  strokeWidth: number; // Width of the text outline
  secondaryColor: string; // Color of the text outline
  secondaryOpacity: number; // Opacity of the text outline
  hexToRgba: (hex: string, opacity: number) => string; // Color conversion utility
}

/**
 * A custom hook that manages the real-time rendering of text on a temporary canvas.
 * It provides immediate visual feedback while the user is typing, including an animated cursor.
 */
export const useTextRendering = (
  draftTextCanvasRef: React.RefObject<HTMLCanvasElement>,
  options: TextRenderingOptions
) => {
  const {
    textEditor, brushSize, brushColor, primaryOpacity, strokeWidth,
    secondaryColor, secondaryOpacity, hexToRgba
  } = options;

  useEffect(() => {
    if (!textEditor) return;

    let animationFrameId: number;
    const canvas = draftTextCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderLoop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const fs = brushSize * 2;
      ctx.fillStyle = hexToRgba(brushColor, primaryOpacity);
      ctx.font = `${fs}px Arial`;

      const lines = textEditor.value.split('\n');
      let maxWidth = 10;
      lines.forEach((line) => {
        const w = ctx.measureText(line).width;
        if (w > maxWidth) maxWidth = w;
      });

      const padding = 10;
      ctx.strokeStyle = '#aaaaaa';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(textEditor.x - padding, textEditor.y, maxWidth + padding * 2 + 10, lines.length * fs + padding);
      ctx.setLineDash([]);

      const isVertical = (window as any)._lastTextTool === 'vertical_text';
      lines.forEach((line, i) => {
        if (isVertical) {
          const chars = line.split('');
          const xPos = textEditor.x + i * fs * 1.2;
          chars.forEach((char, j) => {
            const yPos = textEditor.y + (j + 1) * fs;
            if (strokeWidth > 0) {
              ctx.strokeStyle = hexToRgba(secondaryColor, secondaryOpacity);
              ctx.lineWidth = strokeWidth;
              ctx.strokeText(char, xPos, yPos);
            }
            ctx.fillText(char, xPos, yPos);
          });
        } else {
          const yPos = textEditor.y + (i + 1) * fs;
          if (strokeWidth > 0) {
            ctx.strokeStyle = hexToRgba(secondaryColor, secondaryOpacity);
            ctx.lineWidth = strokeWidth;
            ctx.strokeText(line, textEditor.x, yPos);
          }
          ctx.fillText(line, textEditor.x, yPos);
        }
      });

      // Cursor animation
      const lastLine = lines[lines.length - 1];
      const textWidth = ctx.measureText(lastLine).width;
      const time = Date.now();
      if (Math.floor(time / 500) % 2 === 0) {
        ctx.beginPath();
        ctx.moveTo(textEditor.x + textWidth + 2, textEditor.y + (lines.length - 1) * fs + fs * 0.2);
        ctx.lineTo(textEditor.x + textWidth + 2, textEditor.y + lines.length * fs + fs * 0.2);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [textEditor, brushSize, brushColor, primaryOpacity, strokeWidth, secondaryColor, secondaryOpacity, hexToRgba, draftTextCanvasRef]);
};
