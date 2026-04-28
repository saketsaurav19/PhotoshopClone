import type { CanvasRefs } from '../types';
import type { Layer } from '../../../store/useStore';

export const colorDistance = (data: Uint8ClampedArray, idx: number, r: number, g: number, b: number, a: number): number => {
  return Math.abs(data[idx] - r) + Math.abs(data[idx + 1] - g) + Math.abs(data[idx + 2] - b) + Math.abs(data[idx + 3] - a);
};

export const handleEyedropper = (
  x: number,
  y: number,
  activeLayerId: string | null,
  layers: Layer[],
  canvasRefs: CanvasRefs,
  setBrushColor: (color: string) => void
) => {
  const id = activeLayerId || layers[0]?.id;
  const canvas = canvasRefs.current[id];
  const ctx = canvas?.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  const layer = layers.find(l => l.id === id);
  const lx = x - (layer?.position.x || 0);
  const ly = y - (layer?.position.y || 0);

  const pixel = ctx.getImageData(lx, ly, 1, 1).data;
  const hex = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`;
  setBrushColor(hex);
};

export const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
