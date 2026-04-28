import type { Point, CanvasRefs } from '../types';
import type { Layer } from '../../../store/useStore';

export const applyGradient = (
  start: Point,
  end: Point,
  activeLayerId: string | null,
  layers: Layer[],
  canvasRefs: CanvasRefs,
  brushColor: string,
  secondaryColor: string,
  recordHistory: (label: string) => void
) => {
  const id = activeLayerId || layers[0]?.id;
  const canvas = canvasRefs.current[id];
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;

  const layer = layers.find(l => l.id === id);
  const lx1 = start.x - (layer?.position.x || 0);
  const ly1 = start.y - (layer?.position.y || 0);
  const lx2 = end.x - (layer?.position.x || 0);
  const ly2 = end.y - (layer?.position.y || 0);

  const grad = ctx.createLinearGradient(lx1, ly1, lx2, ly2);
  grad.addColorStop(0, brushColor);
  grad.addColorStop(1, secondaryColor);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  recordHistory('Gradient');
};
