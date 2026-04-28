import type { Point, Rect, CanvasRefs } from '../types';
import type { Layer } from '../../../store/useStore';

export const applySelectionClip = (
  ctx: CanvasRenderingContext2D,
  selectionRect: Rect | null,
  isInverseSelection: boolean,
  lassoPaths: Point[][],
  selectionShape: string,
  offsetX: number,
  offsetY: number,
  canvasWidth: number,
  canvasHeight: number
): boolean => {
  if (selectionRect) {
    ctx.beginPath();
    if (isInverseSelection) {
      ctx.rect(0, 0, canvasWidth, canvasHeight);
    }

    if (selectionShape === 'ellipse') {
      const cx = selectionRect.x - offsetX + selectionRect.w / 2;
      const cy = selectionRect.y - offsetY + selectionRect.h / 2;
      const rx = Math.abs(selectionRect.w / 2);
      const ry = Math.abs(selectionRect.h / 2);
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    } else {
      ctx.rect(selectionRect.x - offsetX, selectionRect.y - offsetY, selectionRect.w, selectionRect.h);
    }

    ctx.clip(isInverseSelection ? 'evenodd' : 'nonzero');
    return true;
  }

  if (lassoPaths.length > 0) {
    ctx.beginPath();
    if (isInverseSelection) {
      ctx.rect(0, 0, canvasWidth, canvasHeight);
    }
    lassoPaths.forEach(path => {
      if (path.length < 2) return;
      ctx.moveTo(path[0].x - offsetX, path[0].y - offsetY);
      path.forEach(p => ctx.lineTo(p.x - offsetX, p.y - offsetY));
      ctx.closePath();
    });
    ctx.clip('evenodd');
    return true;
  }

  return false;
};

export const getSelectionPathData = (
  selectionRect: Rect | null,
  lassoPaths: Point[][],
  selectionShape: string
): string => {
  let d = '';
  if (selectionRect) {
    const x = (selectionRect.w >= 0 ? selectionRect.x : selectionRect.x + selectionRect.w) / 2;
    const y = (selectionRect.h >= 0 ? selectionRect.y : selectionRect.y + selectionRect.h) / 2;
    const w = Math.abs(selectionRect.w) / 2;
    const h = Math.abs(selectionRect.h) / 2;

    if (selectionShape === 'ellipse') {
      const rx = w / 2;
      const ry = h / 2;
      const cx = x + rx;
      const cy = y + ry;
      d += `M ${cx - rx},${cy} a ${rx},${ry} 0 1,0 ${rx * 2},0 a ${rx},${ry} 0 1,0 -${rx * 2},0 Z `;
    } else {
      d += `M ${x},${y} L ${x + w},${y} L ${x + w},${y + h} L ${x},${y + h} Z `;
    }
  }

  lassoPaths.forEach(path => {
    if (path.length < 2) return;
    d += `M ${path.map(p => `${p.x / 2},${p.y / 2}`).join(' L ')} Z `;
  });

  return d;
};

export const clearSelection = (
  activeLayerId: string | null,
  layers: Layer[],
  canvasRefs: CanvasRefs,
  selectionRect: Rect | null,
  lassoPaths: Point[][],
  isInverseSelection: boolean,
  selectionShape: string,
  updateLayer: (id: string, updates: Partial<Layer>) => void,
  recordHistory: (label: string) => void,
  setSelectionRect: (rect: Rect | null) => void,
  setLassoPaths: (paths: Point[][]) => void,
  setIsInverseSelection: (val: boolean) => void
) => {
  if ((!selectionRect && lassoPaths.length === 0) || !activeLayerId) return;
  const canvas = canvasRefs.current[activeLayerId];
  const ctx = canvas?.getContext('2d', { willReadFrequently: true });
  if (ctx && canvas) {
    const layer = layers.find(l => l.id === activeLayerId);
    const offsetX = layer?.position.x || 0;
    const offsetY = layer?.position.y || 0;

    if (selectionRect && !isInverseSelection) {
      ctx.clearRect(selectionRect.x - offsetX, selectionRect.y - offsetY, selectionRect.w, selectionRect.h);
    } else if (selectionRect || lassoPaths.length > 0) {
      ctx.save();
      applySelectionClip(ctx, selectionRect, isInverseSelection, lassoPaths, selectionShape, offsetX, offsetY, canvas.width, canvas.height);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    updateLayer(activeLayerId, { dataUrl: canvas.toDataURL() });
    recordHistory('Delete Selection');
    setSelectionRect(null);
    setLassoPaths([]);
    setIsInverseSelection(false);
  }
};
