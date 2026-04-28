import { useEffect } from 'react';
import type { Layer } from '../../../store/useStore';
import type { CanvasRefs } from '../types';

export const useLayerRendering = (
  layers: Layer[],
  documentSize: { w: number, h: number },
  canvasRefs: CanvasRefs
) => {
  useEffect(() => {
    layers.forEach(layer => {
      const canvas = canvasRefs.current[layer.id];
      const ctx = canvas?.getContext('2d', { willReadFrequently: true });
      if (!ctx || !canvas) return;

      if (layer.dataUrl) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        };
        img.src = layer.dataUrl;
      } else if (layer.type === 'paint' && layer.name === 'Background') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, documentSize.w, documentSize.h);
      } else if (layer.type === 'text' && layer.textContent) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = layer.color || '#000000';
        const fs = layer.fontSize || 40;
        ctx.font = `${fs}px Arial`;
        layer.textContent.split('\n').forEach((line, i) => {
          if (layer.isVertical) {
            const chars = line.split('');
            const xPos = i * fs * 1.2;
            chars.forEach((char, j) => {
              const yPos = (j + 1) * fs;
              if (layer.strokeColor && layer.strokeWidth && layer.strokeWidth > 0) {
                ctx.strokeStyle = layer.strokeColor;
                ctx.lineWidth = layer.strokeWidth;
                ctx.strokeText(char, xPos, yPos);
              }
              ctx.fillText(char, xPos, yPos);
            });
          } else {
            const yPos = (i + 1) * fs;
            if (layer.strokeColor && layer.strokeWidth && layer.strokeWidth > 0) {
              ctx.strokeStyle = layer.strokeColor;
              ctx.lineWidth = layer.strokeWidth;
              ctx.strokeText(line, 0, yPos);
            }
            ctx.fillText(line, 0, yPos);
          }
        });
      } else if (layer.type === 'shape' && layer.shapeData) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const { type, w, h, points, fill, stroke, strokeWidth: sw } = layer.shapeData as any;

        if (type === 'rect' || !type) {
          if (fill) {
            ctx.fillStyle = fill;
            ctx.fillRect(0, 0, w || 100, h || 100);
          }
          if (stroke && sw > 0) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = sw;
            ctx.strokeRect(0, 0, w || 100, h || 100);
          }
        } else if (type === 'ellipse') {
          ctx.beginPath();
          ctx.ellipse(w / 2, h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
          if (fill) {
            ctx.fillStyle = fill;
            ctx.fill();
          }
          if (stroke && sw > 0) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = sw;
            ctx.stroke();
          }
        } else if (type === 'path' && points && points.length > 0) {
          ctx.beginPath();
          if (layer.shapeData.smooth && points.length >= 3) {
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 0; i < (layer.shapeData.closed ? points.length : points.length - 1); i++) {
              const p0 = points[(i - 1 + points.length) % points.length];
              const p1 = points[i % points.length];
              const p2 = points[(i + 1) % points.length];
              const p3 = points[(i + 2) % points.length];

              const cp1x = p1.x + (p2.x - p0.x) / 6;
              const cp1y = p1.y + (p2.y - p0.y) / 6;
              const cp2x = p2.x - (p3.x - p1.x) / 6;
              const cp2y = p2.y - (p3.y - p1.y) / 6;

              ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
            }
          } else {
            ctx.moveTo(points[0].x, points[0].y);
            points.forEach((p: any) => ctx.lineTo(p.x, p.y));
          }

          if (layer.shapeData.closed || layer.shapeData.smooth) ctx.closePath();

          if (fill) {
            ctx.fillStyle = fill;
            ctx.fill();
          }
          if (stroke && sw > 0) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = sw;
            ctx.stroke();
          }
        }
      }
    });
  }, [layers, documentSize]);
};
