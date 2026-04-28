import type { CanvasRefs } from '../types';
import type { Layer } from '../../../store/useStore';
import { colorDistance } from './colorUtils';

export const handlePaintBucket = (
  x: number,
  y: number,
  activeLayerId: string | null,
  layers: Layer[],
  canvasRefs: CanvasRefs,
  brushColor: string,
  primaryOpacity: number,
  updateLayer: (id: string, updates: Partial<Layer>) => void,
  recordHistory: (label: string) => void
) => {
  const id = activeLayerId || layers[0]?.id;
  const canvas = canvasRefs.current[id];
  const ctx = canvas?.getContext('2d', { willReadFrequently: true });
  if (!ctx || !canvas) return;

  const layer = layers.find(l => l.id === id);
  const lx = Math.round(x - (layer?.position.x || 0));
  const ly = Math.round(y - (layer?.position.y || 0));

  if (lx < 0 || ly < 0 || lx >= canvas.width || ly >= canvas.height) return;

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const targetIdx = (ly * canvas.width + lx) * 4;
  const targetR = data[targetIdx];
  const targetG = data[targetIdx + 1];
  const targetB = data[targetIdx + 2];
  const targetA = data[targetIdx + 3];

  const colorMatch = brushColor.match(/[A-Za-z0-9]{2}/g);
  if (!colorMatch) return;
  const [fillR, fillG, fillB] = colorMatch.map(h => parseInt(h, 16));
  const fillA = Math.round(primaryOpacity * 255);

  if (targetR === fillR && targetG === fillG && targetB === fillB && targetA === fillA) return;

  const tolerance = 40;
  const w = canvas.width;
  const h = canvas.height;
  const stack: [number, number][] = [[lx, ly]];
  const filled = new Uint8Array(w * h);

  while (stack.length > 0) {
    const [cx, cy] = stack.pop()!;
    const idx = (cy * w + cx) * 4;

    if (filled[cy * w + cx]) continue;
    if (colorDistance(data, idx, targetR, targetG, targetB, targetA) > tolerance) continue;

    data[idx] = fillR;
    data[idx + 1] = fillG;
    data[idx + 2] = fillB;
    data[idx + 3] = fillA;
    filled[cy * w + cx] = 1;

    if (cx > 0) stack.push([cx - 1, cy]);
    if (cx < w - 1) stack.push([cx + 1, cy]);
    if (cy > 0) stack.push([cx, cy - 1]);
    if (cy < h - 1) stack.push([cx, cy + 1]);
  }

  ctx.putImageData(imgData, 0, 0);
  updateLayer(id, { dataUrl: canvas.toDataURL() });
  recordHistory('Paint Bucket');
};
