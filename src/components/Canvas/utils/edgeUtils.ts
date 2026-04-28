import type { Point, CanvasRefs } from '../types';
import type { Layer } from '../../../store/useStore';

export const findBestEdgePoint = (
  x: number,
  y: number,
  radius: number,
  activeLayerId: string | null,
  layers: Layer[],
  canvasRefs: CanvasRefs
): Point => {
  const id = activeLayerId || (layers.length > 0 ? layers[0].id : null);
  if (!id) return { x, y };
  const canvas = canvasRefs.current[id];
  const ctx = canvas?.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { x, y };

  const rx = Math.round(x);
  const ry = Math.round(y);
  const size = radius * 2;
  try {
    const imageData = ctx.getImageData(rx - radius, ry - radius, size, size);
    const data = imageData.data;

    let maxGrad = -1;
    let bestX = x;
    let bestY = y;

    const getEdgeScore = (i: number, j: number) => {
      const idx = (j * size + i) * 4;
      if (idx < 0 || idx >= data.length) return 0;
      return (data[idx] + data[idx + 1] + data[idx + 2]) * (data[idx + 3] / 255);
    };

    for (let j = 1; j < size - 1; j++) {
      for (let i = 1; i < size - 1; i++) {
        const gx = getEdgeScore(i + 1, j) - getEdgeScore(i - 1, j);
        const gy = getEdgeScore(i, j + 1) - getEdgeScore(i, j - 1);
        const grad = gx * gx + gy * gy;

        if (grad > maxGrad) {
          maxGrad = grad;
          bestX = rx - radius + i;
          bestY = ry - radius + j;
        }
      }
    }
    return { x: bestX, y: bestY };
  } catch (e) {
    return { x, y };
  }
};
