import { flushSync } from 'react-dom';
import type { CanvasContext, Point, Rect, CanvasRefs } from '../types';
import { getToolModule } from '../../../tools';
import { useStore } from '../../../store/useStore';

export const startAction = (
  clientX: number,
  clientY: number,
  e: React.MouseEvent | React.TouchEvent,
  context: CanvasContext,
  handlers: {
    setIsInteracting: (val: boolean) => void;
    setZoom: (val: number) => void;
    setTextEditor: (val: any) => void;
    setCropRect: (val: Rect | null) => void;
    setDraftShape: (val: Rect | null) => void;
    setVectorPaths: (val: any) => void;
    setActivePathIndex: (val: number | null) => void;
    setSelectedPoint: (val: any) => void;
    recordHistory: (label: string) => void;
    handleEyedropper: (x: number, y: number) => void;
  },
  refs: {
    lastPointRef: React.MutableRefObject<Point | null>;
    startMouseRef: React.MutableRefObject<Point | null>;
    startOffsetRef: React.MutableRefObject<Point | null>;
    hiddenTextInputRef: React.RefObject<HTMLTextAreaElement>;
  }
) => {
  const { coords, activeTool, zoom, canvasOffset, cropRect, lassoPaths, vectorPaths, activePathIndex, layers, activeLayerId, primaryOpacity } = context;

  const isAltPressedLocal = (e as any).altKey || context.isAlt;
  const isCtrlPressedLocal = (e as any).ctrlKey || (e as any).metaKey || context.isCtrl;
  let currentTool = activeTool;

  if (['pen', 'curvature_pen', 'free_pen', 'add_anchor', 'delete_anchor'].includes(activeTool as string)) {
    if (isCtrlPressedLocal) currentTool = 'direct_select' as any;
    else if (isAltPressedLocal) currentTool = 'convert_point' as any;
  }

  if (activeTool === 'crop' && cropRect) {
    const cropLeft = Math.min(cropRect.x, cropRect.x + cropRect.w);
    const cropRight = Math.max(cropRect.x, cropRect.x + cropRect.w);
    const cropTop = Math.min(cropRect.y, cropRect.y + cropRect.h);
    const cropBottom = Math.max(cropRect.y, cropRect.y + cropRect.h);
    const isInsideCrop =
      coords.x >= cropLeft &&
      coords.x <= cropRight &&
      coords.y >= cropTop &&
      coords.y <= cropBottom;

    if (isInsideCrop) {
      handlers.setIsInteracting(true);
      // setActiveCropHandle is handled in the component for now or passed in
      refs.lastPointRef.current = coords;
      refs.startMouseRef.current = { x: clientX, y: clientY };
      refs.startOffsetRef.current = { ...canvasOffset };
      return;
    }
  }

  if (activeTool === 'perspective_crop' && lassoPaths.length > 0 && lassoPaths[0].length === 4) {
    const quad = lassoPaths[0];
    let isInsideQuad = false;

    for (let i = 0, j = quad.length - 1; i < quad.length; j = i++) {
      if (
        ((quad[i].y > coords.y) !== (quad[j].y > coords.y)) &&
        (coords.x < (quad[j].x - quad[i].x) * (coords.y - quad[i].y) / (quad[j].y - quad[i].y) + quad[i].x)
      ) {
        isInsideQuad = !isInsideQuad;
      }
    }

    if (isInsideQuad) {
      (window as any)._pcPoints = quad.map(point => ({ ...point }));
      (window as any)._pcDragIdx = 8;
      (window as any)._pcStartPoint = { ...coords };
      (window as any)._pcOrigPoints = quad.map(point => ({ ...point }));
      handlers.setIsInteracting(true);
      refs.lastPointRef.current = coords;
      refs.startMouseRef.current = { x: clientX, y: clientY };
      refs.startOffsetRef.current = { ...canvasOffset };
      return;
    }
  }

  (window as any)._primaryOpacity = primaryOpacity;

  const activeToolModule = getToolModule(activeTool);
  if (activeToolModule?.start) {
    activeToolModule.start(context as any);
    refs.lastPointRef.current = coords;
    refs.startMouseRef.current = { x: clientX, y: clientY };
    refs.startOffsetRef.current = { ...canvasOffset };
    return;
  }

  handlers.setIsInteracting(true);
  refs.lastPointRef.current = coords;
  refs.startMouseRef.current = { x: clientX, y: clientY };
  refs.startOffsetRef.current = { ...canvasOffset };

  if (activeTool === 'hand') return;

  if (activeTool === 'zoom_tool') {
    const delta = (e as any).altKey ? -0.5 : 0.5;
    handlers.setZoom(Math.min(32, Math.max(0.01, zoom + delta)));
    return;
  }

  if (activeTool === 'text' || activeTool === 'vertical_text') {
    // Only allow explicit commit via buttons or keys to prevent accidental closure on mobile
    if (context.setIsTyping) context.setIsTyping(true);
    flushSync(() => {
      handlers.setTextEditor({ ...coords, value: '' });
    });
    (window as any)._lastTextTool = activeTool;
    const input = refs.hiddenTextInputRef.current;
    if (input) {
      input.focus();
      input.setSelectionRange(0, 0);
    }
    return;
  } else if (currentTool === 'crop') {
    if (cropRect) handlers.setCropRect(null);
    else handlers.setCropRect({ x: coords.x, y: coords.y, w: 0, h: 0 });
    return;
  } else if (['shape', 'ellipse_shape', 'line_shape', 'triangle_shape', 'polygon_shape', 'custom_shape'].includes(currentTool as string)) {
    handlers.setDraftShape({ x: coords.x, y: coords.y, w: 0, h: 0 });
    return;
  }

  const isCurrentToolVector = ['pen', 'free_pen', 'curvature_pen', 'add_anchor', 'delete_anchor', 'convert_point', 'path_select', 'direct_select'].includes(currentTool as string);
  if (isCurrentToolVector) {
    const activeLayer = layers.find(l => l.id === activeLayerId);
    if (activeLayer?.type === 'shape' && activeLayer.shapeData?.type === 'path' && vectorPaths.length === 0) {
      handlers.setVectorPaths([{
        points: activeLayer.shapeData.points || [],
        closed: activeLayer.shapeData.closed || false,
        smooth: activeLayer.shapeData.smooth || false
      }]);
      handlers.setActivePathIndex(0);
    }
  }

  if ((currentTool as any) === 'convert_point') {
    vectorPaths.forEach((path: any, pIdx: number) => {
      const isNearPoint = path.points.some((p: Point) => Math.hypot(p.x - coords.x, p.y - coords.y) < 10 / (zoom || 1));
      if (isNearPoint) {
        handlers.setVectorPaths((prev: any) => {
          const next = [...prev];
          next[pIdx] = { ...next[pIdx], smooth: !next[pIdx].smooth };
          return next;
        });
        handlers.recordHistory('Convert Path Type');
        return;
      }
    });
    return;
  }

  if ((currentTool as any) === 'add_anchor') {
    for (let pIdx = 0; pIdx < vectorPaths.length; pIdx++) {
      const path = vectorPaths[pIdx];
      const len = path.points.length;
      for (let i = 0; i < (path.closed ? len : len - 1); i++) {
        const p1 = path.points[i];
        const p2 = path.points[(i + 1) % len];
        const dist = Math.abs((p2.y - p1.y) * coords.x - (p2.x - p1.x) * coords.y + p2.x * p1.y - p2.y * p1.x) / Math.hypot(p2.y - p1.y, p2.x - p1.x);

        const minX = Math.min(p1.x, p2.x) - 5;
        const maxX = Math.max(p1.x, p2.x) + 5;
        const minY = Math.min(p1.y, p2.y) - 5;
        const maxY = Math.max(p1.y, p2.y) + 5;

        if (dist < 8 / (zoom || 1) && coords.x >= minX && coords.x <= maxX && coords.y >= minY && coords.y <= maxY) {
          handlers.setVectorPaths((prev: any) => {
            const next = [...prev];
            next[pIdx].points.splice(i + 1, 0, coords);
            return next;
          });
          handlers.setActivePathIndex(pIdx);
          handlers.recordHistory('Add Anchor Point');
          return;
        }
      }
    }
    return;
  }

  if ((currentTool as any) === 'delete_anchor') {
    for (let pIdx = 0; pIdx < vectorPaths.length; pIdx++) {
      const path = vectorPaths[pIdx];
      const pIdxToDelete = path.points.findIndex((p: Point) => Math.hypot(p.x - coords.x, p.y - coords.y) < 12 / (zoom || 1));
      if (pIdxToDelete !== -1) {
        handlers.setVectorPaths((prev: any) => {
          const next = [...prev];
          next[pIdx].points.splice(pIdxToDelete, 1);
          if (next[pIdx].points.length === 0) {
            next.splice(pIdx, 1);
            handlers.setActivePathIndex(null);
          } else {
            handlers.setActivePathIndex(pIdx);
          }
          return next;
        });
        handlers.recordHistory('Delete Anchor Point');
        return;
      }
    }
    return;
  }

  if ((currentTool as any) === 'pen' || (currentTool as any) === 'curvature_pen') {
    if (activePathIndex !== null) {
      const path = vectorPaths[activePathIndex];
      const firstPoint = path.points[0];
      const dist = Math.hypot(coords.x - firstPoint.x, coords.y - firstPoint.y);

      if (dist < 10 / (zoom || 1) && path.points.length > 2) {
        handlers.setVectorPaths((prev: any) => {
          const next = [...prev];
          next[activePathIndex] = { ...next[activePathIndex], closed: true };
          return next;
        });
        handlers.setActivePathIndex(null);
        handlers.recordHistory('Close Path');
        return;
      }

      if (!path.closed) {
        handlers.setVectorPaths((prev: any) => {
          const next = [...prev];
          next[activePathIndex].points.push(coords);
          return next;
        });
        return;
      }
    }

    const newIdx = vectorPaths.length;
    handlers.setVectorPaths((prev: any) => [...prev, { points: [coords], closed: false, smooth: currentTool === 'curvature_pen' }]);
    handlers.setActivePathIndex(newIdx);
    return;
  }

  if ((currentTool as any) === 'free_pen') {
    const newIdx = vectorPaths.length;
    handlers.setVectorPaths((prev: any) => [...prev, { points: [coords], closed: false }]);
    handlers.setActivePathIndex(newIdx);
    handlers.setIsInteracting(true);
    return;
  }
  if ((currentTool as any) === 'path_select' || (currentTool as any) === 'direct_select') {
    let closestPathIdx = -1, closestPointIdx = -1, minDist = 100;
    vectorPaths.forEach((path: any, pIdx: number) => {
      path.points.forEach((p: Point, ptIdx: number) => {
        const d = Math.hypot(p.x - coords.x, p.y - coords.y);
        if (d < minDist) { minDist = d; closestPathIdx = pIdx; closestPointIdx = ptIdx; }
      });
    });
    if (closestPathIdx !== -1 && minDist < 15 / (zoom || 1)) {
      handlers.setActivePathIndex(closestPathIdx);
      if ((currentTool as any) === 'direct_select') {
        handlers.setSelectedPoint({ pathIdx: closestPathIdx, pointIdx: closestPointIdx });
      } else {
        handlers.setSelectedPoint(null);
      }
      handlers.setIsInteracting(true);
      refs.lastPointRef.current = coords;
    } else {
      handlers.setActivePathIndex(null);
      handlers.setSelectedPoint(null);
    }
    return;
  }

  if ((currentTool as any) === 'move') {
    if (activeLayerId) {
      handlers.setIsInteracting(true);
      refs.startMouseRef.current = { x: clientX, y: clientY };
      const layer = layers.find(l => l.id === activeLayerId);
      if (layer) refs.startOffsetRef.current = { x: layer.position.x, y: layer.position.y };
    }
    return;
  }

  if ((currentTool as any) === 'hand') {
    handlers.setIsInteracting(true);
    refs.startMouseRef.current = { x: clientX, y: clientY };
    refs.startOffsetRef.current = { x: canvasOffset.x, y: canvasOffset.y };
    return;
  }

  if ((currentTool as any) === 'eyedropper' || (currentTool as any) === 'color_sampler') {
    handlers.handleEyedropper(coords.x, coords.y);
    return;
  }

  handlers.setIsInteracting(true);
  refs.lastPointRef.current = coords;
  refs.startMouseRef.current = { x: clientX, y: clientY };
  refs.startOffsetRef.current = { ...canvasOffset };
};

export const moveAction = (
  clientX: number,
  clientY: number,
  context: CanvasContext,
  handlers: {
    setCurrentMousePos: (p: Point) => void;
    setCanvasOffset: (p: Point) => void;
    setCanvasRotation: (val: number) => void;
    setCropRect: (val: any) => void;
    setDraftShape: (val: any) => void;
    setSelectionRect: (val: any) => void;
    setVectorPaths: (val: any) => void;
    setIsInteracting: (val: boolean) => void;
  },
  refs: {
    lastPointRef: React.MutableRefObject<Point | null>;
    startMouseRef: React.MutableRefObject<Point | null>;
    startOffsetRef: React.MutableRefObject<Point | null>;
    getCoordinates: (x: number, y: number) => Point | null;
    getSnappedCoords: (p: Point, exclude?: any) => Point;
  },
  state: {
    isInteracting: boolean;
    activeCropHandle: string | null;
    selectedPoint: any;
    activePathIndex: number | null;
  }
) => {
  const { coords, activeTool, zoom, cropRect, vectorPaths, isAlt, isCtrl } = context;
  handlers.setCurrentMousePos(coords);

  if (!state.isInteracting) return;

  let currentTool = activeTool;
  if (['pen', 'curvature_pen', 'free_pen', 'add_anchor', 'delete_anchor'].includes(activeTool as string)) {
    if (isCtrl) currentTool = 'direct_select' as any;
    else if (isAlt) currentTool = 'convert_point' as any;
  }

  const isCropManipulation = activeTool === 'crop' && state.activeCropHandle !== null && cropRect !== null;
  const toolModule = getToolModule(currentTool);
  if (toolModule?.move && !isCropManipulation) {
    toolModule.move(context as any);
    refs.lastPointRef.current = coords;
    return;
  }

  if (currentTool === 'hand' && refs.startMouseRef.current && refs.startOffsetRef.current) {
    const dx = clientX - refs.startMouseRef.current.x;
    const dy = clientY - refs.startMouseRef.current.y;
    handlers.setCanvasOffset({
      x: refs.startOffsetRef.current.x + (dx * 2) / zoom,
      y: refs.startOffsetRef.current.y + (dy * 2) / zoom
    });
    return;
  }

  if (currentTool === 'free_pen' && state.activePathIndex !== null) {
    const path = vectorPaths[state.activePathIndex];
    const lastP = path.points[path.points.length - 1];
    if (Math.hypot(coords.x - lastP.x, coords.y - lastP.y) > 5 / (zoom || 1)) {
      handlers.setVectorPaths((prev: any) => {
        const next = [...prev];
        next[state.activePathIndex!].points.push(coords);
        return next;
      });
    }
    return;
  }

  if ((currentTool === 'path_select' || currentTool === 'direct_select') && state.activePathIndex !== null && refs.lastPointRef.current) {
    const dx = coords.x - refs.lastPointRef.current.x;
    const dy = coords.y - refs.lastPointRef.current.y;

    if (currentTool === 'direct_select' && state.selectedPoint) {
      handlers.setVectorPaths((prev: any) => {
        const next = [...prev];
        const pt = next[state.selectedPoint.pathIdx].points[state.selectedPoint.pointIdx];
        const newCoords = refs.getSnappedCoords({ x: pt.x + dx, y: pt.y + dy }, state.selectedPoint);
        next[state.selectedPoint.pathIdx].points[state.selectedPoint.pointIdx] = newCoords;
        return next;
      });
    } else {
      handlers.setVectorPaths((prev: any) => {
        const next = [...prev];
        next[state.activePathIndex!].points = next[state.activePathIndex!].points.map((p: Point) => ({ x: p.x + dx, y: p.y + dy }));
        return next;
      });
    }
    refs.lastPointRef.current = coords;
    return;
  }

  if (activeTool === 'rotate_view' && refs.lastPointRef.current) {
    const dx = coords.x - refs.lastPointRef.current.x;
    handlers.setCanvasRotation(useStore.getState().canvasRotation + dx * 0.5);
    refs.lastPointRef.current = coords;
    return;
  }

  if (activeTool === 'crop' && state.activeCropHandle && cropRect) {
    const { x, y, w, h } = cropRect;

    if (state.activeCropHandle === 'move' && refs.lastPointRef.current) {
      const dx = coords.x - refs.lastPointRef.current.x;
      const dy = coords.y - refs.lastPointRef.current.y;
      handlers.setCropRect((prev: any) => prev ? { ...prev, x: prev.x + dx, y: prev.y + dy } : null);
      refs.lastPointRef.current = coords;
      return;
    }

    handlers.setCropRect((prev: any) => {
      if (!prev) return null;
      let nr = { ...prev };
      if (state.activeCropHandle === 'tl') { nr.x = coords.x; nr.y = coords.y; nr.w = w + (x - coords.x); nr.h = h + (y - coords.y); }
      else if (state.activeCropHandle === 'tr') { nr.y = coords.y; nr.w = coords.x - x; nr.h = h + (y - coords.y); }
      else if (state.activeCropHandle === 'bl') { nr.x = coords.x; nr.w = w + (x - coords.x); nr.h = coords.y - y; }
      else if (state.activeCropHandle === 'br') { nr.w = coords.x - x; nr.h = coords.y - y; }
      else if (state.activeCropHandle === 'tm') { nr.y = coords.y; nr.h = h + (y - coords.y); }
      else if (state.activeCropHandle === 'bm') { nr.h = coords.y - y; }
      else if (state.activeCropHandle === 'lm') { nr.x = coords.x; nr.w = w + (x - coords.x); }
      else if (state.activeCropHandle === 'rm') { nr.w = coords.x - x; }
      return nr;
    });

    refs.lastPointRef.current = coords;
    return;
  }

  if (currentTool === 'crop') {
    handlers.setCropRect((prev: any) => prev ? { ...prev, w: coords.x - prev.x, h: coords.y - prev.y } : null);
    return;
  }
  if (currentTool === 'object_selection') {
    handlers.setSelectionRect((prev: any) => prev ? { ...prev, w: coords.x - prev.x, h: coords.y - prev.y } : null);
    return;
  }
  if (['shape', 'ellipse_shape', 'line_shape', 'triangle_shape', 'polygon_shape', 'custom_shape'].includes(currentTool as string)) {
    handlers.setDraftShape((prev: any) => prev ? { ...prev, w: coords.x - prev.x, h: coords.y - prev.y } : null);
    return;
  }

  refs.lastPointRef.current = coords;
};

export const endAction = (
  context: CanvasContext,
  handlers: {
    setIsInteracting: (val: boolean) => void;
    updateLayer: (id: string, updates: any) => void;
    recordHistory: (label: string) => void;
    addLayer: (layer: any) => void;
    setDraftShape: (val: any) => void;
    setGradientStart: (val: any) => void;
    applyGradient: (start: Point, end: Point) => void;
  },
  refs: {
    lastPointRef: React.MutableRefObject<Point | null>;
    canvasRefs: CanvasRefs;
  },
  state: {
    isInteracting: boolean;
    draftShape: Rect | null;
    gradientStart: Point | null;
  }
) => {
  if (!state.isInteracting) return;

  const { coords, activeTool, activeLayerId, layers, brushColor, secondaryColor, strokeWidth } = context;

  const toolModule = getToolModule(activeTool);
  if (toolModule?.end) {
    toolModule.end(context as any);
  }

  if (['brush', 'pencil', 'eraser', 'blur', 'sharpen', 'dodge', 'burn', 'healing', 'healing_brush', 'patch', 'smudge', 'clone', 'pattern_stamp', 'mixer_brush', 'color_replacement', 'background_eraser', 'magic_eraser', 'history_brush', 'art_history_brush'].includes(activeTool)) {
    const id = activeLayerId || layers[0]?.id;
    const canvas = refs.canvasRefs.current[id];
    if (canvas) {
      handlers.updateLayer(id, { dataUrl: canvas.toDataURL() });
      const historyLabel = activeTool.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      handlers.recordHistory(historyLabel);
    }
  }

  if (['shape', 'ellipse_shape', 'line_shape', 'triangle_shape', 'polygon_shape', 'custom_shape'].includes(activeTool as string) && state.draftShape) {
    const w = Math.abs(state.draftShape.w);
    const h = Math.abs(state.draftShape.h);
    if (w > 1 || h > 1) {
      let shapeType: any = activeTool === 'ellipse_shape' ? 'ellipse' : (activeTool === 'line_shape' ? 'path' : (activeTool === 'shape' ? 'rect' : 'path'));
      let points: any[] = [];
      let name = 'Shape';

      if (activeTool === 'line_shape') {
        points = [{ x: state.draftShape.w < 0 ? w : 0, y: state.draftShape.h < 0 ? h : 0 }, { x: state.draftShape.w < 0 ? 0 : w, y: state.draftShape.h < 0 ? 0 : h }];
        name = 'Line';
      } else if (activeTool === 'triangle_shape') {
        points = [
          { x: w / 2, y: state.draftShape.h < 0 ? h : 0 },
          { x: state.draftShape.w < 0 ? w : 0, y: state.draftShape.h < 0 ? 0 : h },
          { x: state.draftShape.w < 0 ? 0 : w, y: state.draftShape.h < 0 ? 0 : h }
        ];
        name = 'Triangle';
      } else if (activeTool === 'polygon_shape') {
        const sides = useStore.getState().polygonSides;
        const cx = w / 2;
        const cy = h / 2;
        const rx = w / 2;
        const ry = h / 2;
        for (let i = 0; i < sides; i++) {
          const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
          points.push({ x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry });
        }
        name = 'Polygon';
      } else if (activeTool === 'custom_shape') {
        const points_count = useStore.getState().starPoints;
        const cx = w / 2;
        const cy = h / 2;
        const outerRadius = Math.min(w, h) / 2;
        const innerRadius = outerRadius * (useStore.getState().starInnerRadius / 100);
        for (let i = 0; i < points_count * 2; i++) {
          const angle = (i * Math.PI) / points_count - Math.PI / 2;
          const radius = i % 2 === 0 ? outerRadius : innerRadius;
          points.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
        }
        name = 'Star Shape';
      } else if (activeTool === 'shape') {
        name = 'Rectangle';
      } else if (activeTool === 'ellipse_shape') {
        name = 'Ellipse';
      }

      handlers.addLayer({
        name: name,
        type: 'shape',
        position: {
          x: state.draftShape.w >= 0 ? state.draftShape.x : state.draftShape.x + state.draftShape.w,
          y: state.draftShape.h >= 0 ? state.draftShape.y : state.draftShape.y + state.draftShape.h
        },
        shapeData: {
          type: shapeType,
          w, h,
          fill: activeTool === 'line_shape' ? '' : brushColor,
          stroke: activeTool === 'line_shape' ? brushColor : secondaryColor,
          strokeWidth: strokeWidth,
          points: points,
          closed: activeTool !== 'line_shape',
          cornerRadius: activeTool === 'shape' ? useStore.getState().cornerRadius : undefined
        }
      });
      handlers.recordHistory(`Add ${name}`);
    }
    handlers.setDraftShape(null);
    handlers.setIsInteracting(false);
    return;
  }

  if (activeTool === 'rotate_view') {
    handlers.recordHistory('Rotate View');
    handlers.setIsInteracting(false);
    return;
  }

  if (activeTool === 'gradient' && state.gradientStart && coords) {
    handlers.applyGradient(state.gradientStart, coords);
    handlers.setGradientStart(null);
    handlers.recordHistory('Gradient');
  }

  if (activeTool === 'move') {
    handlers.recordHistory('Move Layer');
  }

  if (activeTool !== 'polygonal_lasso') {
    handlers.setIsInteracting(false);
  }
  refs.lastPointRef.current = null;
};

export const handleDoubleClick = (context: CanvasContext) => {
  const toolModule = getToolModule(context.activeTool);
  if (toolModule?.doubleClick) {
    toolModule.doubleClick(context);
  }
};
