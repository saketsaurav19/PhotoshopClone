import type { ToolModule } from '../types';
import { findBestEdgePoint } from '../../utils/canvasUtils';
import { shouldClear } from './utils';

export const lassoTools: ToolModule[] = [
  {
    id: 'lasso',
    start: ({ coords, setLassoPaths, setIsInteracting, selectionMode, isShift, isAlt }) => {
      if (shouldClear(selectionMode, isShift, isAlt)) setLassoPaths([]);
      setLassoPaths((prev: any) => [...prev, [coords]]);
      setIsInteracting(true);
    },
    move: ({ coords, setLassoPaths }) => {
      setLassoPaths((prev: any) => {
        const next = [...prev];
        next[next.length - 1] = [...next[next.length - 1], coords];
        return next;
      });
    }
  },
  {
    id: 'polygonal_lasso',
    start: ({ coords, setLassoPaths, setIsInteracting, selectionMode, isShift, isAlt, zoom, recordHistory, isInteracting }) => {
      let closed = false;
      setLassoPaths((prev: any) => {
        // Only start a brand new path if we aren't already building one
        if (!isInteracting || prev.length === 0 || (shouldClear(selectionMode, isShift, isAlt) && prev[prev.length-1].length === 0)) {
          setIsInteracting(true);
          return [[coords]];
        }
        
        const currentPath = prev[prev.length - 1];
        if (currentPath.length === 0) {
          const next = [...prev];
          next[next.length - 1] = [coords];
          return next;
        }
        
        const firstPoint = currentPath[0];
        const dist = Math.hypot(coords.x - firstPoint.x, coords.y - firstPoint.y);
        
        // Close path if clicking near start
        if (dist < 15 / (zoom || 1) && currentPath.length > 2) {
          setIsInteracting(false);
          closed = true;
          return prev;
        }
        
        const next = [...prev];
        next[next.length - 1] = [...next[next.length - 1], coords];
        return next;
      });

      // Record history after the point is added (or path closed)
      if (closed) {
        recordHistory('Polygonal Lasso (Closed)');
      } else {
        recordHistory('Polygonal Lasso Point');
      }
    },
    doubleClick: ({ setIsInteracting, recordHistory }) => {
      setIsInteracting(false);
      recordHistory('Polygonal Lasso');
    }
  },
  {
    id: 'magnetic_lasso',
    start: ({ coords, ctx, setLassoPaths, setIsInteracting, selectionMode, isShift, isAlt }) => {
      if (shouldClear(selectionMode, isShift, isAlt)) setLassoPaths([]);
      const bestPoint = findBestEdgePoint(ctx, coords.x, coords.y, 15);
      setLassoPaths((prev: any) => [...prev, [bestPoint]]);
      setIsInteracting(true);
    },
    move: ({ coords, ctx, zoom, setLassoPaths }) => {
      setLassoPaths((prev: any) => {
        const next = [...prev];
        const currentPath = next[next.length - 1];
        const lastPoint = currentPath[currentPath.length - 1];
        const dist = Math.hypot(coords.x - lastPoint.x, coords.y - lastPoint.y);
        if (dist > 10 / (zoom || 1)) {
          const bestPoint = findBestEdgePoint(ctx, coords.x, coords.y, 15);
          next[next.length - 1] = [...currentPath, bestPoint];
        }
        return next;
      });
    },
    doubleClick: ({ setIsInteracting, recordHistory }) => {
      setIsInteracting(false);
      recordHistory('Magnetic Lasso');
    }
  }
];
