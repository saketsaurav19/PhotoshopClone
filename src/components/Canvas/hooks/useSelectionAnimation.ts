import { useEffect } from 'react';
import type { Point, Rect } from '../types';

/**
 * Options for the useSelectionAnimation hook.
 */
interface SelectionAnimationOptions {
  lassoPaths: Point[][]; // Current freehand or polygonal lasso paths
  vectorPaths: any[]; // Current pen tool paths
  selectionRect: Rect | null; // Rectangular or elliptical selection marquee
  isInverseSelection: boolean; // True if 'Select Inverse' is active
  isInteracting: boolean; // True if the user is currently dragging/drawing
  activeTool: string; // The currently selected tool ID
  currentMousePos: Point | null; // Real-time mouse position for previews
  zoom: number; // Current canvas zoom level
  selectionShape: string; // 'rect' or 'ellipse' for the selection marquee
  activePathIndex: number | null; // The index of the vector path being edited
  penMode: string; // 'path' or 'shape' for the pen tool
  findBestEdgePoint: (x: number, y: number, radius: number) => Point; // Helper for magnetic lasso
}

/**
 * A custom hook that manages a high-performance animation loop for selection overlays.
 * It handles the "marching ants" effect, vector path anchors, and real-time tool previews.
 */
export const useSelectionAnimation = (
  selectionCanvasRef: React.RefObject<HTMLCanvasElement>,
  options: SelectionAnimationOptions
) => {
  const {
    lassoPaths, vectorPaths, selectionRect, isInverseSelection,
    isInteracting, activeTool, currentMousePos, zoom, selectionShape,
    activePathIndex, penMode, findBestEdgePoint
  } = options;

  useEffect(() => {
    const canvas = selectionCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let offset = 0;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (lassoPaths.length === 0 && vectorPaths.length === 0 && !selectionRect) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      ctx.save();
      ctx.scale(0.5, 0.5);

      // 1. Draw Lasso Selections
      if (lassoPaths.length > 0) {
        ctx.beginPath();
        lassoPaths.forEach((path) => {
          if (path.length < 1) return;
          ctx.moveTo(path[0].x, path[0].y);
          path.forEach(p => ctx.lineTo(p.x, p.y));
          ctx.closePath();
        });
        ctx.fillStyle = 'rgba(0, 120, 215, 0.15)';
        ctx.fill(isInverseSelection ? 'nonzero' : 'evenodd');

        offset++;
        
        // Pass 1: Solid White Base
        ctx.setLineDash([]);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        lassoPaths.forEach((path) => {
          if (path.length < 1) return;
          ctx.moveTo(path[0].x, path[0].y);
          path.forEach(p => ctx.lineTo(p.x, p.y));
          ctx.closePath();
        });
        ctx.stroke();

        // Pass 2: Animated Dashed Black Overlay
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -offset;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        lassoPaths.forEach((path) => {
          if (path.length < 1) return;
          ctx.moveTo(path[0].x, path[0].y);
          path.forEach(p => ctx.lineTo(p.x, p.y));
          ctx.closePath();
        });
        ctx.stroke();

        // Pass 3: Draw "Pen Tool" style solid path and anchors
        if (isInteracting && (['polygonal_lasso', 'magnetic_lasso', 'lasso'].includes(activeTool))) {
          const lastPath = lassoPaths[lassoPaths.length - 1];
          if (lastPath && lastPath.length > 0) {
            ctx.save();
            ctx.setLineDash([]);
            ctx.strokeStyle = '#0078d7';
            ctx.lineWidth = 1.5 / (zoom || 1);

            ctx.beginPath();
            ctx.moveTo(lastPath[0].x, lastPath[0].y);
            lastPath.forEach(p => ctx.lineTo(p.x, p.y));

            if (currentMousePos) {
              if (activeTool === 'magnetic_lasso') {
                const snapped = findBestEdgePoint(currentMousePos.x, currentMousePos.y, 15);
                ctx.lineTo(snapped.x, snapped.y);
                const distToStart = Math.hypot(currentMousePos.x - lastPath[0].x, currentMousePos.y - lastPath[0].y);
                if (distToStart < 20 / (zoom || 1)) ctx.lineTo(lastPath[0].x, lastPath[0].y);
              } else {
                ctx.lineTo(currentMousePos.x, currentMousePos.y);
                const distToStart = Math.hypot(currentMousePos.x - lastPath[0].x, currentMousePos.y - lastPath[0].y);
                if (distToStart < 20 / (zoom || 1)) ctx.lineTo(lastPath[0].x, lastPath[0].y);
              }
            }
            ctx.stroke();

            // Draw Anchors
            const pointSize = 6 / (zoom || 1);
            lastPath.forEach((p, idx) => {
              let isNearStart = false;
              if (idx === 0 && currentMousePos) {
                const dist = Math.hypot(currentMousePos.x - p.x, currentMousePos.y - p.y);
                if (dist < 20 / (zoom || 1)) isNearStart = true;
              }

              ctx.strokeStyle = '#fff';
              ctx.lineWidth = 3 / (zoom || 1);

              if (isNearStart) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, pointSize * 0.9, 0, Math.PI * 2);
                ctx.stroke();
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 1.5 / (zoom || 1);
                ctx.stroke();
                ctx.fillStyle = '#fff';
                ctx.fill();
              } else {
                ctx.strokeRect(p.x - pointSize / 2, p.y - pointSize / 2, pointSize, pointSize);
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1 / (zoom || 1);
                ctx.strokeRect(p.x - pointSize / 2, p.y - pointSize / 2, pointSize, pointSize);
                ctx.fillStyle = (idx === lastPath.length - 1) ? '#0078d7' : '#fff';
                ctx.fillRect(p.x - pointSize / 2 + 1, p.y - pointSize / 2 + 1, pointSize - 2, pointSize - 2);
              }
            });
            ctx.restore();
          }
        }
      }

      // 2. Draw Selection Rect/Ellipse
      if (selectionRect) {
        ctx.beginPath();
        if (selectionShape === 'ellipse') {
          const cx = selectionRect.x + selectionRect.w / 2;
          const cy = selectionRect.y + selectionRect.h / 2;
          const rx = Math.abs(selectionRect.w / 2);
          const ry = Math.abs(selectionRect.h / 2);
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        } else {
          ctx.rect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
        }

        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -offset;
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        ctx.lineDashOffset = -offset + 4;
        ctx.strokeStyle = '#000';
        ctx.stroke();
      }

      // 3. Draw Vector Paths
      vectorPaths.forEach((path, idx) => {
        if (path.points.length === 0) return;
        ctx.beginPath();
        ctx.setLineDash([]);
        ctx.moveTo(path.points[0].x, path.points[0].y);
        path.points.forEach(p => ctx.lineTo(p.x, p.y));
        if (path.closed) ctx.closePath();

        let pathColor = '#00ffff';
        if (penMode === 'shape') pathColor = '#a051ff';

        ctx.strokeStyle = idx === activePathIndex ? pathColor : '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        path.points.forEach((p, pIdx) => {
          const isActive = (idx === activePathIndex && pIdx === path.points.length - 1);
          const dist = currentMousePos ? Math.hypot(p.x - currentMousePos.x, p.y - currentMousePos.y) : Infinity;
          const isHovered = dist < 15 / (zoom || 1);
          const size = (isActive ? 8 : 6) * (isHovered ? 1.5 : 1);

          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 3;
          ctx.strokeRect(p.x - size / 2, p.y - size / 2, size, size);
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 1;
          ctx.strokeRect(p.x - size / 2, p.y - size / 2, size, size);
          ctx.fillStyle = isActive ? pathColor : '#fff';
          ctx.fillRect(p.x - size / 2 + 1, p.y - size / 2 + 1, size - 2, size - 2);
        });
      });

      ctx.restore();
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [lassoPaths, vectorPaths, activePathIndex, isInverseSelection, activeTool, currentMousePos, selectionRect, selectionShape, zoom, penMode, findBestEdgePoint, selectionCanvasRef]);
};
