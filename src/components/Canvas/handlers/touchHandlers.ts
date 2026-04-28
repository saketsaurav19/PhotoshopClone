import type { Point } from '../types';

export const handleTouchStart = (
  e: React.TouchEvent,
  zoom: number,
  canvasOffset: Point,
  handlers: {
    setInitialTouchDistance: (val: number | null) => void;
    setInitialTouchMidpoint: (p: Point | null) => void;
    setInitialTouchZoom: (val: number) => void;
    setInitialTouchOffset: (p: Point) => void;
    setIsInteracting: (val: boolean) => void;
    startAction: (x: number, y: number, e: React.TouchEvent) => void;
    isCropUiTarget: (target: EventTarget | null) => boolean;
  }
) => {
  if (handlers.isCropUiTarget(e.target)) {
    return;
  }

  if (e.touches.length === 2) {
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    const midpoint = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };

    handlers.setInitialTouchDistance(dist);
    handlers.setInitialTouchMidpoint(midpoint);
    handlers.setInitialTouchZoom(zoom);
    handlers.setInitialTouchOffset(canvasOffset);
    handlers.setIsInteracting(false);
  } else if (e.touches.length === 1) {
    handlers.startAction(e.touches[0].clientX, e.touches[0].clientY, e);
  }
};

export const handleTouchMove = (
  e: TouchEvent,
  initialTouchDistance: number | null,
  initialTouchMidpoint: Point | null,
  initialTouchZoom: number,
  initialTouchOffset: Point,
  zoom: number,
  handlers: {
    setZoom: (val: number) => void;
    setCanvasOffset: (p: Point) => void;
    moveAction: (x: number, y: number) => void;
  }
) => {
  if (e.touches.length === 2 && initialTouchDistance !== null && initialTouchMidpoint !== null) {
    e.preventDefault();

    const t1 = e.touches[0];
    const t2 = e.touches[1];
    const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    const midpoint = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };

    const zoomFactor = dist / initialTouchDistance;
    const newZoom = Math.min(32, Math.max(0.01, initialTouchZoom * zoomFactor));
    handlers.setZoom(newZoom);

    const dx = midpoint.x - initialTouchMidpoint.x;
    const dy = midpoint.y - initialTouchMidpoint.y;
    handlers.setCanvasOffset({
      x: initialTouchOffset.x + (dx * 2) / zoom,
      y: initialTouchOffset.y + (dy * 2) / zoom
    });
  } else if (e.touches.length === 1) {
    handlers.moveAction(e.touches[0].clientX, e.touches[0].clientY);
  }
};
