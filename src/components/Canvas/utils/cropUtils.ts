import type { Rect, Point, CanvasRefs } from '../types';
import type { Layer } from '../../../store/useStore';

export const isCropUiTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false;
  return !!target.closest('.crop-marquee, .crop-handle, .crop-actions-bar, .perspective-crop-ui, .perspective-actions-bar');
};

export const applyCrop = (
  cropRect: Rect | null,
  layers: Layer[],
  lassoPaths: Point[][],
  canvasRefs: CanvasRefs,
  setLayers: (layers: Layer[]) => void,
  setLassoPaths: (paths: Point[][]) => void,
  setSelectionRect: (rect: Rect | null) => void,
  setDocumentSize: (size: { w: number, h: number }) => void,
  setCanvasOffset: (offset: { x: number, y: number }) => void,
  setCropRect: (rect: Rect | null) => void,
  recordHistory: (label: string) => void,
  setIsInverseSelection: (val: boolean) => void
) => {
  if (!cropRect) return;
  const { x, y, w, h } = cropRect;
  const absW = Math.round(Math.abs(w));
  const absH = Math.round(Math.abs(h));
  const startX = Math.round(w >= 0 ? x : x + w);
  const startY = Math.round(h >= 0 ? y : y + h);

  if (absW < 5 || absH < 5) return;

  const newLayers = layers.map(layer => {
    const canvas = canvasRefs.current[layer.id];
    if (!canvas) return { ...layer, position: { x: layer.position.x - startX, y: layer.position.y - startY } };

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = absW;
    tempCanvas.height = absH;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return layer;

    const lx = startX - layer.position.x;
    const ly = startY - layer.position.y;

    tempCtx.drawImage(canvas, lx, ly, absW, absH, 0, 0, absW, absH);

    return {
      ...layer,
      position: { x: 0, y: 0 },
      dataUrl: tempCanvas.toDataURL()
    };
  });

  const newLassoPaths = lassoPaths.map(path =>
    path.map(p => ({ x: p.x - startX, y: p.y - startY }))
  );

  setSelectionRect(null);
  setIsInverseSelection(false);
  setLayers(newLayers);
  setLassoPaths(newLassoPaths);
  setDocumentSize({ w: absW, h: absH });
  setCanvasOffset({ x: 0, y: 0 });
  setCropRect(null);
  recordHistory('Crop');
};
