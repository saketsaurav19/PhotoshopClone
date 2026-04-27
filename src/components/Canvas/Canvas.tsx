import React, { useEffect, useRef, useState, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useStore, hexToRgba } from '../../store/useStore';
import './Canvas.css';
import { getToolModule } from '../../tools';

const Canvas: React.FC = () => {
  const store = useStore();
  const {
    activeTool, brushSize, strokeWidth, brushColor, secondaryColor,
    primaryOpacity, secondaryOpacity,
    zoom, setZoom, layers, activeLayerId,
    updateLayer, addLayer, recordHistory, setActiveLayer, setLayers,
    canvasOffset, setCanvasOffset, canvasRotation, setCanvasRotation, setBrushColor,
    history, historyIndex,
    lassoPaths, setLassoPaths, selectionRect, setSelectionRect,
    isInverseSelection, setIsInverseSelection,
    documentSize, setDocumentSize,
    vectorPaths, setVectorPaths, activePathIndex, setActivePathIndex, penMode,
    slices, setSlices, addSlice,
    colorSamplers, addColorSampler, clearColorSamplers, rulerData, setRulerData,
    setIsTyping, toolStrength, toolHardness,
    redEyePupilSize, redEyeDarkenAmount,
    textEditor, setTextEditor
  } = store;

  // 1. Unified State for maximum stability
  const [isInteracting, setIsInteracting] = useState(false);
  const [currentMousePos, setCurrentMousePos] = useState<{ x: number, y: number } | null>(null);
  const [draftShape, setDraftShape] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [draftLasso, setDraftLasso] = useState<{ x: number, y: number }[] | null>(null);
  const [cropRect, setCropRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [gradientStart, setGradientStart] = useState<{ x: number, y: number } | null>(null);
  const [cloneSource, setCloneSource] = useState<{ x: number, y: number } | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<{ pathIdx: number, pointIdx: number } | null>(null);
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  // Touch Gestures State
  const [initialTouchDistance, setInitialTouchDistance] = useState<number | null>(null);
  const [initialTouchMidpoint, setInitialTouchMidpoint] = useState<{ x: number, y: number } | null>(null);
  const [initialTouchZoom, setInitialTouchZoom] = useState<number>(1);
  const [initialTouchOffset, setInitialTouchOffset] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
  const [activeCropHandle, setActiveCropHandle] = useState<string | null>(null);

  const canvasRefs = useRef<{ [key: string]: HTMLCanvasElement | null }>({});
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const startMouseRef = useRef<{ x: number; y: number } | null>(null);
  const startOffsetRef = useRef<{ x: number, y: number } | null>(null);
  const draftTextCanvasRef = useRef<HTMLCanvasElement>(null);
  const selectionCanvasRef = useRef<HTMLCanvasElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const hiddenTextInputRef = useRef<HTMLTextAreaElement>(null);
  const lastTextStartTimeRef = useRef<number>(0);

  useEffect(() => {
    const input = hiddenTextInputRef.current;
    if (!textEditor && input) {
      input.blur();
    }
  }, [textEditor]);

  useEffect(() => {
    setIsTyping(!!textEditor);
    return () => setIsTyping(false);
  }, [textEditor, setIsTyping]);

  const applySelectionClip = useCallback((
    ctx: CanvasRenderingContext2D,
    offsetX: number,
    offsetY: number,
    canvasWidth: number,
    canvasHeight: number
  ) => {
    const { selectionShape } = store;
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
        if (path.length < 2) return; // Allow 2 points for polygonal lasso segments
        ctx.moveTo(path[0].x - offsetX, path[0].y - offsetY);
        path.forEach(p => ctx.lineTo(p.x - offsetX, p.y - offsetY));
        ctx.closePath();
      });
      ctx.clip('evenodd');
      return true;
    }

    return false;
  }, [selectionRect, isInverseSelection, lassoPaths, store]);

  const handleEyedropper = useCallback((x: number, y: number) => {
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
  }, [activeLayerId, layers, setBrushColor]);

  const applyCrop = useCallback(() => {
    if (!cropRect) return;
    const { x, y, w, h } = cropRect;
    const absW = Math.round(Math.abs(w));
    const absH = Math.round(Math.abs(h));
    const startX = Math.round(w >= 0 ? x : x + w);
    const startY = Math.round(h >= 0 ? y : y + h);

    if (absW < 5 || absH < 5) return;

    // We'll create new dataUrls for every layer representing the cropped content
    const newLayers = layers.map(layer => {
      const canvas = canvasRefs.current[layer.id];
      if (!canvas) return { ...layer, position: { x: layer.position.x - startX, y: layer.position.y - startY } };

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = absW;
      tempCanvas.height = absH;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return layer;

      // Draw the portion of the layer that falls within the crop box
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
  }, [cropRect, layers, lassoPaths, setLayers, setLassoPaths, setSelectionRect, setDocumentSize, setCanvasOffset, recordHistory, setIsInverseSelection]);

  const applyGradient = useCallback((start: { x: number, y: number }, end: { x: number, y: number }) => {
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
  }, [activeLayerId, layers, brushColor, secondaryColor, recordHistory]);

  // 2. Coordinate System
  const getCoordinates = useCallback((clientX: number, clientY: number) => {
    const stack = stackRef.current;
    if (!stack) return null;
    const rect = stack.getBoundingClientRect();

    // Calculate normalized coordinates (0 to 1) within the visual rectangle
    // We clamp them between 0 and 1 so that dragging outside the canvas
    // continues the stroke at the edge rather than stopping.
    const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    return {
      x: nx * documentSize.w,
      y: ny * documentSize.h
    };
  }, [documentSize]);

  const getSnappedCoords = useCallback((coords: { x: number, y: number }, exclude?: { pathIdx: number, pointIdx: number }, threshold: number = 12) => {
    const snapDist = threshold / (zoom || 1);

    // Check Vector Paths
    for (let pIdx = 0; pIdx < vectorPaths.length; pIdx++) {
      const path = vectorPaths[pIdx];
      for (let ptIdx = 0; ptIdx < path.points.length; ptIdx++) {
        if (exclude && exclude.pathIdx === pIdx && exclude.pointIdx === ptIdx) continue;
        const p = path.points[ptIdx];
        if (Math.hypot(coords.x - p.x, coords.y - p.y) < snapDist) {
          return { x: p.x, y: p.y };
        }
      }
    }

    // Check Lasso Paths
    for (const path of lassoPaths) {
      for (const p of path) {
        if (Math.hypot(coords.x - p.x, coords.y - p.y) < snapDist) {
          return { x: p.x, y: p.y };
        }
      }
    }

    return coords;
  }, [vectorPaths, lassoPaths, zoom]);

  const getSvgPathData = (points: { x: number, y: number }[], closed: boolean, smooth: boolean = false) => {
    if (points.length < 2) return '';
    if (!smooth) {
      return `M ${points[0].x / 2} ${points[0].y / 2} ` + points.slice(1).map(p => `L ${p.x / 2} ${p.y / 2}`).join(' ') + (closed ? ' Z' : '');
    }

    let d = `M ${points[0].x / 2} ${points[0].y / 2}`;
    if (points.length === 2) {
      return d + ` L ${points[1].x / 2} ${points[1].y / 2}` + (closed ? ' Z' : '');
    }

    for (let i = 0; i < (closed ? points.length : points.length - 1); i++) {
      const p0 = points[(i - 1 + points.length) % points.length];
      const p1 = points[i % points.length];
      const p2 = points[(i + 1) % points.length];
      const p3 = points[(i + 2) % points.length];

      const cp1x = p1.x / 2 + (p2.x / 2 - p0.x / 2) / 6;
      const cp1y = p1.y / 2 + (p2.y / 2 - p0.y / 2) / 6;
      const cp2x = p2.x / 2 - (p3.x / 2 - p1.x / 2) / 6;
      const cp2y = p2.y / 2 - (p3.y / 2 - p1.y / 2) / 6;

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x / 2} ${p2.y / 2}`;
    }

    if (closed) d += ' Z';
    return d;
  };

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
      ctx.scale(0.5, 0.5); // Match the 1000x700 display size

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
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -offset;
        ctx.lineWidth = 2;


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
        if (isInteracting && (activeTool === 'polygonal_lasso' || activeTool === 'magnetic_lasso' || activeTool === 'lasso')) {
          const lastPath = lassoPaths[lassoPaths.length - 1];
          if (lastPath && lastPath.length > 0) {
            ctx.save();
            ctx.setLineDash([]);
            ctx.strokeStyle = '#0078d7'; // Solid Blue Path
            ctx.lineWidth = 1.5 / (zoom || 1);

            // Draw the existing segments as solid lines
            ctx.beginPath();
            ctx.moveTo(lastPath[0].x, lastPath[0].y);
            lastPath.forEach(p => ctx.lineTo(p.x, p.y));

            // Draw the "Rubber Band" segment to the cursor
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

            // Draw Anchors (High contrast squares)
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

      // 1.1 Draw Selection Rect/Ellipse
      if (selectionRect) {
        const { selectionShape } = store;
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

      // 2. Draw Vector Paths (Pen Tool)
      vectorPaths.forEach((path, idx) => {
        if (path.points.length === 0) return;
        ctx.beginPath();
        ctx.setLineDash([]); // Paths are solid
        ctx.moveTo(path.points[0].x, path.points[0].y);
        path.points.forEach(p => ctx.lineTo(p.x, p.y));
        if (path.closed) ctx.closePath();

        let pathColor = '#00ffff'; // High-visibility Cyan
        if (penMode === 'shape') pathColor = '#a051ff'; // Shape purple

        ctx.strokeStyle = idx === activePathIndex ? pathColor : '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw points
        path.points.forEach((p, pIdx) => {
          const isActive = (idx === activePathIndex && pIdx === path.points.length - 1);
          const dist = currentMousePos ? Math.hypot(p.x - currentMousePos.x, p.y - currentMousePos.y) : Infinity;
          const isHovered = dist < 15 / (zoom || 1);
          const size = (isActive ? 8 : 6) * (isHovered ? 1.5 : 1);

          // Outer white stroke for contrast on dark backgrounds
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 3;
          ctx.strokeRect(p.x - size / 2, p.y - size / 2, size, size);

          // Inner black stroke for contrast on light backgrounds
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 1;
          ctx.strokeRect(p.x - size / 2, p.y - size / 2, size, size);

          // Fill
          ctx.fillStyle = isActive ? pathColor : '#fff';
          ctx.fillRect(p.x - size / 2 + 1, p.y - size / 2 + 1, size - 2, size - 2);
        });
      });

      ctx.restore();
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [lassoPaths, vectorPaths, activePathIndex, isInverseSelection, activeTool, currentMousePos, selectionRect, store]);

  const getSelectionPathData = useCallback(() => {
    let d = '';
    if (selectionRect) {
      const x = (selectionRect.w >= 0 ? selectionRect.x : selectionRect.x + selectionRect.w) / 2;
      const y = (selectionRect.h >= 0 ? selectionRect.y : selectionRect.y + selectionRect.h) / 2;
      const w = Math.abs(selectionRect.w) / 2;
      const h = Math.abs(selectionRect.h) / 2;

      if (store.selectionShape === 'ellipse') {
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
  }, [selectionRect, lassoPaths, store.selectionShape]);

  // 3. Logic Functions
  const commitText = useCallback(() => {
    hiddenTextInputRef.current?.blur();

    if (textEditor && textEditor.value.trim()) {
      const typedText = textEditor.value.trim();
      addLayer({
        name: typedText.length > 20 ? typedText.substring(0, 20) + '...' : typedText,
        type: 'text',
        textContent: textEditor.value,
        position: { x: textEditor.x, y: textEditor.y },
        fontSize: brushSize * 2,
        color: hexToRgba(brushColor, primaryOpacity),
        strokeColor: strokeWidth > 0 ? hexToRgba(secondaryColor, secondaryOpacity) : undefined,
        strokeWidth: strokeWidth,
        isVertical: (window as any)._lastTextTool === 'vertical_text',
        visible: true, opacity: 1
      });
      recordHistory('Add Text Layer');
    }
    setTextEditor(null);
  }, [textEditor, addLayer, recordHistory, brushSize, brushColor]);

  const cancelText = useCallback(() => {
    hiddenTextInputRef.current?.blur();
    setTextEditor(null);
  }, []);

  const clearSelection = useCallback(() => {
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
        applySelectionClip(ctx, offsetX, offsetY, canvas.width, canvas.height);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
      updateLayer(activeLayerId, { dataUrl: canvas.toDataURL() });
      recordHistory('Delete Selection');
      setSelectionRect(null);
      setLassoPaths([]);
      setIsInverseSelection(false);
    }
  }, [selectionRect, lassoPaths, activeLayerId, updateLayer, recordHistory, layers, isInverseSelection, applySelectionClip, setIsInverseSelection]);

  React.useEffect(() => {
    const onDelete = () => clearSelection();
    window.addEventListener('delete-selection', onDelete);
    return () => window.removeEventListener('delete-selection', onDelete);
  }, [clearSelection]);

  useEffect(() => {
    const onDefinePattern = () => {
      if (!selectionRect || !activeLayerId) return;
      const canvas = canvasRefs.current[activeLayerId];
      if (!canvas) return;

      const { x, y, w, h } = selectionRect;
      const absW = Math.round(Math.abs(w));
      const absH = Math.round(Math.abs(h));
      if (absW < 2 || absH < 2) return;

      const layer = layers.find(l => l.id === activeLayerId);
      const lx = (w >= 0 ? x : x + w) - (layer?.position.x || 0);
      const ly = (h >= 0 ? y : y + h) - (layer?.position.y || 0);

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = absW;
      tempCanvas.height = absH;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      tempCtx.drawImage(canvas, lx, ly, absW, absH, 0, 0, absW, absH);
      useStore.getState().setCustomPattern(tempCanvas.toDataURL());
      setSelectionRect(null);
    };

    window.addEventListener('define-pattern', onDefinePattern);
    return () => window.removeEventListener('define-pattern', onDefinePattern);
  }, [selectionRect, activeLayerId, layers, setSelectionRect]);
  useEffect(() => {
    const handleDrawDraft = (e: any) => setDraftShape(e.detail);
    const handleClearDraft = () => setDraftShape(null);
    const handleDrawLasso = (e: any) => setDraftLasso(e.detail);
    const handleClearLasso = () => setDraftLasso(null);
    const handleSetGradStart = (e: any) => {
      setGradientStart(e.detail);
      (window as any)._gradientStart = e.detail;
    };
    const handleSetGradEnd = (e: any) => setCurrentMousePos(e.detail);
    const handleClearGrad = () => {
      setGradientStart(null);
      delete (window as any)._gradientStart;
    };

    window.addEventListener('draw-draft-rect', handleDrawDraft);
    window.addEventListener('clear-draft-rect', handleClearDraft);
    window.addEventListener('draw-draft-lasso', handleDrawLasso);
    window.addEventListener('clear-draft-lasso', handleClearLasso);
    window.addEventListener('set-gradient-start', handleSetGradStart);
    window.addEventListener('set-gradient-end', handleSetGradEnd);
    window.addEventListener('clear-gradient', handleClearGrad);

    return () => {
      window.removeEventListener('draw-draft-rect', handleDrawDraft);
      window.removeEventListener('clear-draft-rect', handleClearDraft);
      window.removeEventListener('draw-draft-lasso', handleDrawLasso);
      window.removeEventListener('clear-Lasso', handleClearLasso);
      window.removeEventListener('set-gradient-start', handleSetGradStart);
      window.removeEventListener('set-gradient-end', handleSetGradEnd);
      window.removeEventListener('clear-gradient', handleClearGrad);
    };
  }, []);

  const colorDistance = (data: Uint8ClampedArray, idx: number, r: number, g: number, b: number, a: number) => {
    return Math.abs(data[idx] - r) + Math.abs(data[idx + 1] - g) + Math.abs(data[idx + 2] - b) + Math.abs(data[idx + 3] - a);
  };

  const findBestEdgePoint = useCallback((x: number, y: number, radius: number) => {
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

        // Combine RGB and Alpha for edge detection
        // We look for sharp changes in any channel
        return (data[idx] + data[idx + 1] + data[idx + 2]) * (data[idx + 3] / 255);
      };

      for (let j = 1; j < size - 1; j++) {
        for (let i = 1; i < size - 1; i++) {
          // Sobel-like operator for each channel or combined
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
  }, [activeLayerId, layers]);

  const handlePaintBucket = useCallback((x: number, y: number) => {
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

    // Convert brushColor (hex) to RGB
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
  }, [activeLayerId, layers, brushColor, primaryOpacity, updateLayer, recordHistory]);

  // 4. Interaction Engine
  const startAction = useCallback((clientX: number, clientY: number, e: React.MouseEvent | React.TouchEvent) => {
    const rawCoords = getCoordinates(clientX, clientY);
    if (!rawCoords) return;

    const isAltPressedLocal = (e as any).altKey || isAltPressed;
    const isCtrlPressedLocal = (e as any).ctrlKey || (e as any).metaKey || isCtrlPressed;
    let currentTool = activeTool;

    if (['pen', 'curvature_pen', 'free_pen', 'add_anchor', 'delete_anchor'].includes(activeTool as string)) {
      if (isCtrlPressedLocal) currentTool = 'direct_select' as any;
      else if (isAltPressedLocal) currentTool = 'convert_point' as any;
    }

    const isStartToolVector = ['pen', 'curvature_pen', 'free_pen', 'add_anchor', 'delete_anchor', 'convert_point', 'path_select', 'direct_select'].includes(activeTool as string);
    const coords = isStartToolVector ? getSnappedCoords(rawCoords) : rawCoords;

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
        setIsInteracting(true);
        setActiveCropHandle('move');
        lastPointRef.current = coords;
        startMouseRef.current = { x: clientX, y: clientY };
        startOffsetRef.current = { ...canvasOffset };
        return;
      }
    }

    (window as any)._primaryOpacity = primaryOpacity;

    const id = activeLayerId || (layers.length > 0 ? layers[0].id : null);
    const canvas = id ? canvasRefs.current[id] : null;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });

    const context: any = {
      canvas, ctx, coords,
      startCoords: coords,
      lastPoint: lastPointRef.current,
      isShift: (e as any).shiftKey,
      isAlt: (e as any).altKey,
      brushSize, brushColor, zoom,
      activeLayerId, layers,
      selectionMode: useStore.getState().selectionMode,
      selectionTolerance: useStore.getState().selectionTolerance,
      selectionContiguous: useStore.getState().selectionContiguous,
      selectionRect, lassoPaths, isInverseSelection,
      setLassoPaths, setSelectionRect, setCropRect, updateLayer, recordHistory, setIsInteracting,
      setBrushColor, addLayer, setDocumentSize,
      slices, setSlices, addSlice,
      colorSamplers, addColorSampler, clearColorSamplers, rulerData, setRulerData,
      history, historyIndex,
      cloneSource: useStore.getState().cloneSource,
      setCloneSource: useStore.getState().setCloneSource,
      customPattern: useStore.getState().customPattern,
      secondaryColor: useStore.getState().secondaryColor,
      primaryOpacity, secondaryOpacity, hexToRgba, applySelectionClip,
      redEyePupilSize, redEyeDarkenAmount, isInteracting
    };

    const activeToolModule = getToolModule(activeTool);
    if (activeToolModule?.start) {
      activeToolModule.start(context);
      lastPointRef.current = coords;
      startMouseRef.current = { x: clientX, y: clientY };
      startOffsetRef.current = { ...canvasOffset };
      return;
    }

    setIsInteracting(true);
    lastPointRef.current = coords;
    startMouseRef.current = { x: clientX, y: clientY };
    startOffsetRef.current = { ...canvasOffset };

    if (activeTool === 'hand') return;

    if (activeTool === 'zoom_tool') {
      const delta = (e as any).altKey ? -0.5 : 0.5;
      setZoom(Math.min(32, Math.max(0.01, zoom + delta)));
      return;
    }

    if (activeTool === 'text' || activeTool === 'vertical_text') {
      if (textEditor) {
        // Only allow explicit commit via buttons or keys to prevent accidental closure on mobile
        return;
      }
      else {
        flushSync(() => {
          setTextEditor({ ...coords, value: '' });
        });
        lastTextStartTimeRef.current = Date.now();
        (window as any)._lastTextTool = activeTool;
        (window as any)._lastTextTool = currentTool;

        const input = hiddenTextInputRef.current;
        if (input) {
          input.focus();
          input.setSelectionRange(0, 0);
        }
      }
      return;
    } else if (currentTool === 'select') {
      // Logic for layer selection could be modularized later
    } else if (currentTool === 'crop') {
      if (cropRect) setCropRect(null);
      else setCropRect({ x: coords.x, y: coords.y, w: 0, h: 0 });
      return;
    } else if (['shape', 'ellipse_shape', 'line_shape', 'triangle_shape', 'polygon_shape', 'custom_shape'].includes(currentTool as string)) {
      setDraftShape({ x: coords.x, y: coords.y, w: 0, h: 0 });
      return;
    }

    const isCurrentToolVector = ['pen', 'free_pen', 'curvature_pen', 'add_anchor', 'delete_anchor', 'convert_point', 'path_select', 'direct_select'].includes(currentTool as string);
    if (isCurrentToolVector) {
      const activeLayer = layers.find(l => l.id === activeLayerId);
      if (activeLayer?.type === 'shape' && activeLayer.shapeData?.type === 'path' && vectorPaths.length === 0) {
        setVectorPaths([{
          points: activeLayer.shapeData.points || [],
          closed: activeLayer.shapeData.closed || false,
          smooth: activeLayer.shapeData.smooth || false
        }]);
        setActivePathIndex(0);
      }
    }

    if ((currentTool as any) === 'convert_point') {
      vectorPaths.forEach((path, pIdx) => {
        const isNearPoint = path.points.some(p => Math.hypot(p.x - coords.x, p.y - coords.y) < 10 / (zoom || 1));
        if (isNearPoint) {
          setVectorPaths(prev => {
            const next = [...prev];
            next[pIdx] = { ...next[pIdx], smooth: !next[pIdx].smooth };
            return next;
          });
          recordHistory('Convert Path Type');
          return;
        }
      });
      return;
    }

    if ((currentTool as any) === 'add_anchor') {
      // Find segment to add point
      for (let pIdx = 0; pIdx < vectorPaths.length; pIdx++) {
        const path = vectorPaths[pIdx];
        const len = path.points.length;
        for (let i = 0; i < (path.closed ? len : len - 1); i++) {
          const p1 = path.points[i];
          const p2 = path.points[(i + 1) % len];
          // Distance to segment
          const dist = Math.abs((p2.y - p1.y) * coords.x - (p2.x - p1.x) * coords.y + p2.x * p1.y - p2.y * p1.x) / Math.hypot(p2.y - p1.y, p2.x - p1.x);

          // Also check if point is within the bounding box of the segment (approx)
          const minX = Math.min(p1.x, p2.x) - 5;
          const maxX = Math.max(p1.x, p2.x) + 5;
          const minY = Math.min(p1.y, p2.y) - 5;
          const maxY = Math.max(p1.y, p2.y) + 5;

          if (dist < 8 / (zoom || 1) && coords.x >= minX && coords.x <= maxX && coords.y >= minY && coords.y <= maxY) {
            setVectorPaths(prev => {
              const next = [...prev];
              next[pIdx].points.splice(i + 1, 0, coords);
              return next;
            });
            setActivePathIndex(pIdx);
            recordHistory('Add Anchor Point');
            return;
          }
        }
      }
      return;
    }

    if ((currentTool as any) === 'delete_anchor') {
      for (let pIdx = 0; pIdx < vectorPaths.length; pIdx++) {
        const path = vectorPaths[pIdx];
        const pIdxToDelete = path.points.findIndex(p => Math.hypot(p.x - coords.x, p.y - coords.y) < 12 / (zoom || 1));
        if (pIdxToDelete !== -1) {
          setVectorPaths(prev => {
            const next = [...prev];
            next[pIdx].points.splice(pIdxToDelete, 1);
            if (next[pIdx].points.length === 0) {
              next.splice(pIdx, 1);
              setActivePathIndex(null);
            } else {
              setActivePathIndex(pIdx);
            }
            return next;
          });
          recordHistory('Delete Anchor Point');
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
          setVectorPaths(prev => {
            const next = [...prev];
            next[activePathIndex] = { ...next[activePathIndex], closed: true };
            return next;
          });
          setActivePathIndex(null);
          recordHistory('Close Path');
          return;
        }

        if (!path.closed) {
          setVectorPaths(prev => {
            const next = [...prev];
            next[activePathIndex].points.push(coords);
            return next;
          });
          return;
        }
      }

      const newIdx = vectorPaths.length;
      setVectorPaths(prev => [...prev, { points: [coords], closed: false, smooth: currentTool === 'curvature_pen' }]);
      setActivePathIndex(newIdx);
      return;
    }

    if ((currentTool as any) === 'free_pen') {
      const newIdx = vectorPaths.length;
      setVectorPaths(prev => [...prev, { points: [coords], closed: false }]);
      setActivePathIndex(newIdx);
      setIsInteracting(true);
      return;
    }
    if ((currentTool as any) === 'path_select' || (currentTool as any) === 'direct_select') {
      let closestPathIdx = -1, closestPointIdx = -1, minDist = 100;
      vectorPaths.forEach((path, pIdx) => {
        path.points.forEach((p, ptIdx) => {
          const d = Math.hypot(p.x - coords.x, p.y - coords.y);
          if (d < minDist) { minDist = d; closestPathIdx = pIdx; closestPointIdx = ptIdx; }
        });
      });
      if (closestPathIdx !== -1 && minDist < 15 / (zoom || 1)) {
        setActivePathIndex(closestPathIdx);
        if ((currentTool as any) === 'direct_select') {
          setSelectedPoint({ pathIdx: closestPathIdx, pointIdx: closestPointIdx });
        } else {
          setSelectedPoint(null);
        }
        setIsInteracting(true);
        lastPointRef.current = coords;
      } else {
        setActivePathIndex(null);
        setSelectedPoint(null);
      }
      return;
    }

    if ((currentTool as any) === 'move') {
      if (id) {
        setIsInteracting(true);
        startMouseRef.current = { x: clientX, y: clientY };
        const layer = layers.find(l => l.id === id);
        if (layer) startOffsetRef.current = { x: layer.position.x, y: layer.position.y };
      }
      return;
    }

    if ((currentTool as any) === 'hand') {
      setIsInteracting(true);
      startMouseRef.current = { x: clientX, y: clientY };
      startOffsetRef.current = { x: canvasOffset.x, y: canvasOffset.y };
      return;
    }

    if ((currentTool as any) === 'eyedropper' || (currentTool as any) === 'color_sampler') {
      handleEyedropper(coords.x, coords.y);
      return;
    }

    const currentToolModule = getToolModule(currentTool as any);
    if (currentToolModule?.start) {
      currentToolModule.start(context);
      lastPointRef.current = coords;
      startMouseRef.current = { x: clientX, y: clientY };
      startOffsetRef.current = { ...canvasOffset };
      return;
    }

    setIsInteracting(true);
    lastPointRef.current = coords;
    startMouseRef.current = { x: clientX, y: clientY };
    startOffsetRef.current = { ...canvasOffset };
  }, [getCoordinates, activeTool, textEditor, commitText, layers, setActiveLayer, zoom, setZoom, handleEyedropper, activeLayerId, canvasOffset, lassoPaths, vectorPaths, activePathIndex, setActivePathIndex, setLassoPaths, setSelectionRect, cropRect, setCropRect, setDraftShape, setVectorPaths, setGradientStart, handlePaintBucket, setCloneSource, brushSize, brushColor, primaryOpacity, recordHistory, setIsInteracting, addLayer, strokeWidth, hexToRgba, secondaryColor, secondaryOpacity, setSelectedPoint, isAltPressed, isCtrlPressed, slices, setSlices, addSlice, colorSamplers, addColorSampler, clearColorSamplers, rulerData, setRulerData, history, historyIndex, applySelectionClip]);

  const handleDoubleClick = useCallback(() => {
    const id = activeLayerId || layers[0]?.id;
    const canvas = canvasRefs.current[id];
    const ctx = canvas?.getContext('2d');

    const context: any = {
      canvas, ctx, coords: currentMousePos || { x: 0, y: 0 },
      startCoords: null, lastPoint: lastPointRef.current,
      brushSize, brushColor, zoom,
      activeLayerId, layers,
      selectionMode: useStore.getState().selectionMode,
      selectionTolerance: useStore.getState().selectionTolerance,
      selectionContiguous: useStore.getState().selectionContiguous,
      selectionRect, lassoPaths, isInverseSelection,
      setLassoPaths, setSelectionRect, setCropRect, updateLayer, recordHistory, setIsInteracting,
      setBrushColor, addLayer, setDocumentSize,
      slices, setSlices, addSlice,
      colorSamplers, addColorSampler, clearColorSamplers, rulerData, setRulerData,
      customPattern: useStore.getState().customPattern,
      secondaryColor: useStore.getState().secondaryColor,
      primaryOpacity, secondaryOpacity, hexToRgba, applySelectionClip
    };

    const toolModule = getToolModule(activeTool);
    if (toolModule?.doubleClick) {
      toolModule.doubleClick(context);
    }
  }, [activeTool, recordHistory, currentMousePos, brushSize, brushColor, zoom, activeLayerId, layers, selectionRect, setLassoPaths, setSelectionRect, setCropRect, updateLayer, setIsInteracting, setBrushColor, addLayer, setDocumentSize, isAltPressed, isCtrlPressed, vectorPaths, activePathIndex, lassoPaths, isInverseSelection, slices, setSlices, addSlice, colorSamplers, addColorSampler, clearColorSamplers, rulerData, setRulerData, history, historyIndex, secondaryColor, primaryOpacity, secondaryOpacity, applySelectionClip]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (activeTool === 'polygonal_lasso' || activeTool === 'magnetic_lasso') {
          if (lassoPaths.length > 0) {
            setLassoPaths(prev => {
              const next = [...prev];
              const currentPath = [...next[next.length - 1]];
              if (currentPath.length > 1) {
                currentPath.pop();
                next[next.length - 1] = currentPath;
              } else {
                next.pop();
                setIsInteracting(false);
              }
              return next;
            });
          }
        }
      } else if (e.key === 'Escape') {
        if (activeTool === 'polygonal_lasso' || activeTool === 'magnetic_lasso') {
          setLassoPaths([]);
          setIsInteracting(false);
        }
      } else if (e.key === 'Enter') {
        if (activeTool === 'polygonal_lasso' || activeTool === 'magnetic_lasso') {
          setIsInteracting(false);
          recordHistory(activeTool === 'polygonal_lasso' ? 'Polygonal Lasso' : 'Magnetic Lasso');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, lassoPaths, recordHistory, setLassoPaths, isInteracting]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const midpoint = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };

      setInitialTouchDistance(dist);
      setInitialTouchMidpoint(midpoint);
      setInitialTouchZoom(zoom);
      setInitialTouchOffset(canvasOffset);
      setIsInteracting(false); // Stop drawing if multi-touching
    } else if (e.touches.length === 1) {
      if (activeTool !== 'text' && activeTool !== 'vertical_text') {
        e.preventDefault();
      }
      startAction(e.touches[0].clientX, e.touches[0].clientY, e);
    }
  }, [zoom, canvasOffset, startAction]);

  const moveAction = useCallback((clientX: number, clientY: number) => {
    const rawCoords = getCoordinates(clientX, clientY);
    if (!rawCoords) return;

    const isVectorTool = ['pen', 'curvature_pen', 'free_pen', 'add_anchor', 'delete_anchor', 'convert_point', 'path_select', 'direct_select'].includes(activeTool as string);
    const coords = isVectorTool ? getSnappedCoords(rawCoords) : rawCoords;
    setCurrentMousePos(coords);

    if (!isInteracting) return;

    const id = activeLayerId || (layers.length > 0 ? layers[0].id : null);
    const canvas = id ? canvasRefs.current[id] : null;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });

    const context: any = {
      canvas, ctx, coords,
      startCoords: startMouseRef.current ? getCoordinates(startMouseRef.current.x, startMouseRef.current.y) : null,
      lastPoint: lastPointRef.current,
      brushSize, brushColor, zoom,
      activeLayerId, layers,
      selectionMode: useStore.getState().selectionMode,
      selectionTolerance: useStore.getState().selectionTolerance,
      selectionContiguous: useStore.getState().selectionContiguous,
      selectionRect, lassoPaths, isInverseSelection,
      setLassoPaths, setSelectionRect, setCropRect, updateLayer, recordHistory, setIsInteracting,
      setBrushColor, addLayer, setDocumentSize,
      slices, setSlices, addSlice,
      colorSamplers, addColorSampler, clearColorSamplers, rulerData, setRulerData,
      history, historyIndex,
      cloneSource: useStore.getState().cloneSource,
      setCloneSource: useStore.getState().setCloneSource,
      customPattern: useStore.getState().customPattern,
      secondaryColor: useStore.getState().secondaryColor,
      primaryOpacity, secondaryOpacity, hexToRgba, applySelectionClip
    };

    let currentTool = activeTool;
    if (['pen', 'curvature_pen', 'free_pen', 'add_anchor', 'delete_anchor'].includes(activeTool as string)) {
      if (isCtrlPressed) currentTool = 'direct_select' as any;
      else if (isAltPressed) currentTool = 'convert_point' as any;
    }

    const toolModule = getToolModule(currentTool);
    if (toolModule?.move) {
      toolModule.move(context);
      lastPointRef.current = coords;
      return;
    }

    if (currentTool === 'hand' && startMouseRef.current && startOffsetRef.current) {
      const dx = clientX - startMouseRef.current.x;
      const dy = clientY - startMouseRef.current.y;
      // We divide by zoom to keep the pan speed consistent with the mouse
      setCanvasOffset({
        x: startOffsetRef.current.x + (dx * 2) / zoom,
        y: startOffsetRef.current.y + (dy * 2) / zoom
      });
      return;
    }


    if (currentTool === 'free_pen' && activePathIndex !== null) {
      const path = vectorPaths[activePathIndex];
      const lastP = path.points[path.points.length - 1];
      if (Math.hypot(coords.x - lastP.x, coords.y - lastP.y) > 5 / (zoom || 1)) {
        setVectorPaths(prev => {
          const next = [...prev];
          next[activePathIndex].points.push(coords);
          return next;
        });
      }
      return;
    }

    if ((currentTool === 'path_select' || currentTool === 'direct_select') && activePathIndex !== null && lastPointRef.current) {
      const dx = coords.x - lastPointRef.current.x;
      const dy = coords.y - lastPointRef.current.y;

      if (currentTool === 'direct_select' && selectedPoint) {
        setVectorPaths(prev => {
          const next = [...prev];
          const pt = next[selectedPoint.pathIdx].points[selectedPoint.pointIdx];
          const newCoords = getSnappedCoords({ x: pt.x + dx, y: pt.y + dy }, selectedPoint);
          next[selectedPoint.pathIdx].points[selectedPoint.pointIdx] = newCoords;
          return next;
        });
      } else {
        setVectorPaths(prev => {
          const next = [...prev];
          next[activePathIndex].points = next[activePathIndex].points.map(p => ({ x: p.x + dx, y: p.y + dy }));
          return next;
        });
      }
      lastPointRef.current = coords;
      return;
    }

    if (activeTool === 'rotate_view' && lastPointRef.current) {
      const dx = coords.x - lastPointRef.current.x;
      setCanvasRotation(useStore.getState().canvasRotation + dx * 0.5);
      lastPointRef.current = coords;
      return;
    }

    if (activeTool === 'crop' && activeCropHandle && cropRect) {
      const { x, y, w, h } = cropRect;

      if (activeCropHandle === 'move' && lastPointRef.current) {
        const dx = coords.x - lastPointRef.current.x;
        const dy = coords.y - lastPointRef.current.y;
        setCropRect(prev => prev ? { ...prev, x: prev.x + dx, y: prev.y + dy } : null);
        lastPointRef.current = coords;
        return;
      }

      setCropRect(prev => {
        if (!prev) return null;
        let nr = { ...prev };
        if (activeCropHandle === 'tl') { nr.x = coords.x; nr.y = coords.y; nr.w = w + (x - coords.x); nr.h = h + (y - coords.y); }
        else if (activeCropHandle === 'tr') { nr.y = coords.y; nr.w = coords.x - x; nr.h = h + (y - coords.y); }
        else if (activeCropHandle === 'bl') { nr.x = coords.x; nr.w = w + (x - coords.x); nr.h = coords.y - y; }
        else if (activeCropHandle === 'br') { nr.w = coords.x - x; nr.h = coords.y - y; }
        else if (activeCropHandle === 'tm') { nr.y = coords.y; nr.h = h + (y - coords.y); }
        else if (activeCropHandle === 'bm') { nr.h = coords.y - y; }
        else if (activeCropHandle === 'lm') { nr.x = coords.x; nr.w = w + (x - coords.x); }
        else if (activeCropHandle === 'rm') { nr.w = coords.x - x; }
        return nr;
      });

      lastPointRef.current = coords;
      return;
    }

    if (currentTool === 'crop') {
      setCropRect(prev => prev ? { ...prev, w: coords.x - prev.x, h: coords.y - prev.y } : null);
      return;
    }
    if (currentTool === 'object_selection') {
      setSelectionRect(prev => prev ? { ...prev, w: coords.x - prev.x, h: coords.y - prev.y } : null);
      return;
    }
    if (['shape', 'ellipse_shape', 'line_shape', 'triangle_shape', 'polygon_shape', 'custom_shape'].includes(currentTool as string)) {
      setDraftShape(prev => prev ? { ...prev, w: coords.x - prev.x, h: coords.y - prev.y } : null);
      return;
    }
    if (activeTool === 'gradient') {
      // Logic for preview could go here if needed
      return;
    }

    if (activeTool === 'clone') {
      // End of clone stroke
    }
    lastPointRef.current = coords;
  }, [getCoordinates, isInteracting, activeTool, activeLayerId, layers, brushSize, strokeWidth, hexToRgba, secondaryColor, secondaryOpacity, brushColor, primaryOpacity, updateLayer, canvasOffset, setCanvasOffset, cloneSource, selectionRect, lassoPaths, activeCropHandle, cropRect, applySelectionClip, findBestEdgePoint, vectorPaths, activePathIndex, selectedPoint, isAltPressed, isCtrlPressed]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2 && initialTouchDistance !== null && initialTouchMidpoint !== null) {
      e.preventDefault(); // Prevent page zooming/scrolling

      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const midpoint = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };

      // Zoom logic
      const zoomFactor = dist / initialTouchDistance;
      const newZoom = Math.min(32, Math.max(0.01, initialTouchZoom * zoomFactor));
      setZoom(newZoom);

      // Pan logic
      const dx = midpoint.x - initialTouchMidpoint.x;
      const dy = midpoint.y - initialTouchMidpoint.y;
      setCanvasOffset({
        x: initialTouchOffset.x + (dx * 2) / zoom,
        y: initialTouchOffset.y + (dy * 2) / zoom
      });
    } else if (e.touches.length === 1) {
      moveActionRef.current(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, [initialTouchDistance, initialTouchMidpoint, initialTouchZoom, initialTouchOffset, zoom, setZoom, setCanvasOffset]);

  const endAction = useCallback(() => {
    if (!isInteracting) return;

    const id = activeLayerId || (layers.length > 0 ? layers[0].id : null);
    const canvas = id ? canvasRefs.current[id] : null;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });

    const context: any = {
      canvas, ctx, coords: currentMousePos || { x: 0, y: 0 },
      startCoords: startMouseRef.current ? getCoordinates(startMouseRef.current.x, startMouseRef.current.y) : null,
      lastPoint: lastPointRef.current,
      brushSize, brushColor, zoom, toolStrength, toolHardness,
      activeLayerId, layers,
      selectionMode: useStore.getState().selectionMode,
      selectionTolerance: useStore.getState().selectionTolerance,
      selectionContiguous: useStore.getState().selectionContiguous,
      selectionRect, lassoPaths, isInverseSelection,
      setLassoPaths, setSelectionRect, setCropRect, updateLayer, recordHistory, setIsInteracting,
      setBrushColor, addLayer, setDocumentSize,
      slices, setSlices, addSlice,
      colorSamplers, addColorSampler, clearColorSamplers, rulerData, setRulerData,
      history, historyIndex,
      cloneSource: useStore.getState().cloneSource,
      setCloneSource: useStore.getState().setCloneSource,
      customPattern: useStore.getState().customPattern,
      secondaryColor: useStore.getState().secondaryColor,
      primaryOpacity, secondaryOpacity, hexToRgba, applySelectionClip,
      setIsTyping,
      redEyePupilSize, redEyeDarkenAmount
    };

    const toolModule = getToolModule(activeTool);
    if (toolModule?.end) {
      toolModule.end(context);
    }

    if (['brush', 'pencil', 'eraser', 'blur', 'sharpen', 'dodge', 'burn', 'healing', 'healing_brush', 'patch', 'smudge', 'clone', 'pattern_stamp', 'mixer_brush', 'color_replacement', 'background_eraser', 'magic_eraser', 'history_brush', 'art_history_brush'].includes(activeTool)) {
      const id = activeLayerId || layers[0]?.id;
      const canvas = canvasRefs.current[id];
      if (canvas) {
        updateLayer(id, { dataUrl: canvas.toDataURL() });
        const historyLabel = activeTool.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        recordHistory(historyLabel);
      }
    }

    if (['shape', 'ellipse_shape', 'line_shape', 'triangle_shape', 'polygon_shape', 'custom_shape'].includes(activeTool as string) && draftShape) {
      const w = Math.abs(draftShape.w);
      const h = Math.abs(draftShape.h);
      if (w > 1 || h > 1) {
        let shapeType: any = activeTool === 'ellipse_shape' ? 'ellipse' : (activeTool === 'line_shape' ? 'path' : (activeTool === 'shape' ? 'rect' : 'path'));
        let points: any[] = [];
        let name = 'Shape';

        if (activeTool === 'line_shape') {
          points = [{ x: draftShape.w < 0 ? w : 0, y: draftShape.h < 0 ? h : 0 }, { x: draftShape.w < 0 ? 0 : w, y: draftShape.h < 0 ? 0 : h }];
          name = 'Line';
        } else if (activeTool === 'triangle_shape') {
          points = [
            { x: w / 2, y: draftShape.h < 0 ? h : 0 },
            { x: draftShape.w < 0 ? w : 0, y: draftShape.h < 0 ? 0 : h },
            { x: draftShape.w < 0 ? 0 : w, y: draftShape.h < 0 ? 0 : h }
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
          // 5-pointed star
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

        addLayer({
          name: name,
          type: 'shape',
          position: {
            x: draftShape.w >= 0 ? draftShape.x : draftShape.x + draftShape.w,
            y: draftShape.h >= 0 ? draftShape.y : draftShape.y + draftShape.h
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
        recordHistory(`Add ${name}`);
      }
      setDraftShape(null);
      setIsInteracting(false);
      return;
    }

    if (activeTool === 'rotate_view') {
      recordHistory('Rotate View');
      setIsInteracting(false);
      return;
    }

    if (activeTool === 'gradient' && gradientStart && currentMousePos) {
      applyGradient(gradientStart, currentMousePos);
      setGradientStart(null);
      recordHistory('Gradient');
    }

    if (activeTool === 'move') {
      recordHistory('Move Layer');
    }

    if (activeTool !== 'polygonal_lasso') {
      setIsInteracting(false);
    }
    lastPointRef.current = null;
  }, [isInteracting, activeTool, activeLayerId, layers, updateLayer, draftShape, addLayer, hexToRgba, brushColor, primaryOpacity, secondaryColor, secondaryOpacity, strokeWidth, recordHistory, currentMousePos, gradientStart, applyGradient, selectionRect, lassoPaths]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(Math.min(32, Math.max(0.01, zoom + delta)));
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [zoom, setZoom]);

  const moveActionRef = useRef(moveAction);
  const endActionRef = useRef(endAction);

  useEffect(() => {
    moveActionRef.current = moveAction;
    endActionRef.current = endAction;
  });

  useEffect(() => {
    const onMoveGlobal = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      moveActionRef.current(clientX, clientY);
    };

    const onUp = () => {
      endActionRef.current();
      setInitialTouchDistance(null);
      setInitialTouchMidpoint(null);
      setActiveCropHandle(null);
    };

    window.addEventListener('mousemove', onMoveGlobal);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });

    if (isInteracting || initialTouchDistance !== null) {
      window.addEventListener('mouseup', onUp);
      window.addEventListener('touchend', onUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMoveGlobal);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
  }, [isInteracting, initialTouchDistance, handleTouchMove]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setIsAltPressed(true);
      if (e.key === 'Control' || e.key === 'Meta') setIsCtrlPressed(true);

      if (textEditor) {
        if (e.key === 'Escape') {
          commitText();
          return;
        }
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          commitText();
          return;
        }
        return;
      }
      if (e.key === 'Enter' && cropRect) {
        applyCrop();
      }
      if (e.key === 'Escape') {
        setCropRect(null);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setIsAltPressed(false);
      if (e.key === 'Control' || e.key === 'Meta') setIsCtrlPressed(false);
    };
    const preventScroll = (e: KeyboardEvent) => {
      if (textEditor && e.key === 'Escape') {
        // e.preventDefault(); // Don't prevent escape
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('keydown', preventScroll, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('keydown', preventScroll, { capture: true });
    };
  }, [clearSelection, textEditor, commitText, cropRect, applyCrop, setCropRect]);

  useEffect(() => {
    const canvas = draftTextCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (textEditor) {
      const fs = brushSize * 2;
      ctx.fillStyle = hexToRgba(brushColor, primaryOpacity);
      ctx.font = `${fs}px Arial`;
      const lines = textEditor.value.split('\n');
      let maxWidth = 10;
      lines.forEach((line) => {
        const w = ctx.measureText(line).width;
        if (w > maxWidth) maxWidth = w;
      });
      const padding = 10;
      ctx.strokeStyle = '#aaaaaa';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(textEditor.x - padding, textEditor.y, maxWidth + padding * 2 + 10, lines.length * fs + padding);
      ctx.setLineDash([]);
      const isVertical = (window as any)._lastTextTool === 'vertical_text';
      lines.forEach((line, i) => {
        if (isVertical) {
          const chars = line.split('');
          const xPos = textEditor.x + i * fs * 1.2;
          chars.forEach((char, j) => {
            const yPos = textEditor.y + (j + 1) * fs;
            if (strokeWidth > 0) {
              ctx.strokeStyle = hexToRgba(secondaryColor, secondaryOpacity);
              ctx.lineWidth = strokeWidth;
              ctx.strokeText(char, xPos, yPos);
            }
            ctx.fillText(char, xPos, yPos);
          });
        } else {
          const yPos = textEditor.y + (i + 1) * fs;
          if (strokeWidth > 0) {
            ctx.strokeStyle = hexToRgba(secondaryColor, secondaryOpacity);
            ctx.lineWidth = strokeWidth;
            ctx.strokeText(line, textEditor.x, yPos);
          }
          ctx.fillText(line, textEditor.x, yPos);
        }
      });
      const lastLine = lines[lines.length - 1];
      const textWidth = ctx.measureText(lastLine).width;
      const time = Date.now();
      if (Math.floor(time / 500) % 2 === 0) {
        ctx.beginPath();
        ctx.moveTo(textEditor.x + textWidth + 2, textEditor.y + (lines.length - 1) * fs + fs * 0.2);
        ctx.lineTo(textEditor.x + textWidth + 2, textEditor.y + lines.length * fs + fs * 0.2);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }, [textEditor, brushSize, brushColor]);

  useEffect(() => {
    if (!textEditor) return;
    let animationFrameId: number;
    const renderLoop = () => {
      const canvas = draftTextCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const fs = brushSize * 2;
          ctx.fillStyle = hexToRgba(brushColor, primaryOpacity);
          ctx.font = `${fs}px Arial`;
          const lines = textEditor.value.split('\n');
          let maxWidth = 10;
          lines.forEach((line) => {
            const w = ctx.measureText(line).width;
            if (w > maxWidth) maxWidth = w;
          });
          const padding = 10;
          ctx.strokeStyle = '#aaaaaa';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(textEditor.x - padding, textEditor.y, maxWidth + padding * 2 + 10, lines.length * fs + padding);
          ctx.setLineDash([]);
          const isVertical = (window as any)._lastTextTool === 'vertical_text';
          lines.forEach((line, i) => {
            if (isVertical) {
              const chars = line.split('');
              const xPos = textEditor.x + i * fs * 1.2;
              chars.forEach((char, j) => {
                const yPos = textEditor.y + (j + 1) * fs;
                if (strokeWidth > 0) {
                  ctx.strokeStyle = hexToRgba(secondaryColor, secondaryOpacity);
                  ctx.lineWidth = strokeWidth;
                  ctx.strokeText(char, xPos, yPos);
                }
                ctx.fillText(char, xPos, yPos);
              });
            } else {
              const yPos = textEditor.y + (i + 1) * fs;
              if (strokeWidth > 0) {
                ctx.strokeStyle = hexToRgba(secondaryColor, secondaryOpacity);
                ctx.lineWidth = strokeWidth;
                ctx.strokeText(line, textEditor.x, yPos);
              }
              ctx.fillText(line, textEditor.x, yPos);
            }
          });
          const lastLine = lines[lines.length - 1];
          const textWidth = ctx.measureText(lastLine).width;
          if (Math.floor(Date.now() / 500) % 2 === 0) {
            ctx.beginPath();
            ctx.moveTo(textEditor.x + textWidth + 2, textEditor.y + (lines.length - 1) * fs + fs * 0.2);
            ctx.lineTo(textEditor.x + textWidth + 2, textEditor.y + lines.length * fs + fs * 0.2);
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
      }
      animationFrameId = requestAnimationFrame(renderLoop);
    };
    renderLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [textEditor, brushSize, brushColor]);

  useEffect(() => {
    layers.forEach(layer => {
      const canvas = canvasRefs.current[layer.id];
      const ctx = canvas?.getContext('2d', { willReadFrequently: true });
      if (!ctx || !canvas) return;
      if (layer.dataUrl) {
        const img = new Image();
        img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); };
        img.src = layer.dataUrl;
      } else if (layer.type === 'paint' && layer.name === 'Background') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, documentSize.w, documentSize.h);
      } else if (layer.type === 'text' && layer.textContent) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = layer.color || '#000000';
        const fs = layer.fontSize || 40; ctx.font = `${fs}px Arial`;
        layer.textContent.split('\n').forEach((line, i) => {
          if (layer.isVertical) {
            const chars = line.split('');
            const xPos = i * fs * 1.2;
            chars.forEach((char, j) => {
              const yPos = (j + 1) * fs;
              if (layer.strokeColor && layer.strokeWidth && layer.strokeWidth > 0) {
                ctx.strokeStyle = layer.strokeColor;
                ctx.lineWidth = layer.strokeWidth;
                ctx.strokeText(char, xPos, yPos);
              }
              ctx.fillText(char, xPos, yPos);
            });
          } else {
            const yPos = (i + 1) * fs;
            if (layer.strokeColor && layer.strokeWidth && layer.strokeWidth > 0) {
              ctx.strokeStyle = layer.strokeColor;
              ctx.lineWidth = layer.strokeWidth;
              ctx.strokeText(line, 0, yPos);
            }
            ctx.fillText(line, 0, yPos);
          }
        });
      } else if (layer.type === 'shape' && layer.shapeData) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const { type, w, h, points, fill, stroke, strokeWidth: sw } = layer.shapeData as any;

        if (type === 'rect' || !type) {
          if (fill) {
            ctx.fillStyle = fill;
            ctx.fillRect(0, 0, w || 100, h || 100);
          }
          if (stroke && sw > 0) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = sw;
            ctx.strokeRect(0, 0, w || 100, h || 100);
          }
        } else if (type === 'ellipse') {
          ctx.beginPath();
          ctx.ellipse(w / 2, h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
          if (fill) {
            ctx.fillStyle = fill;
            ctx.fill();
          }
          if (stroke && sw > 0) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = sw;
            ctx.stroke();
          }
        } else if (type === 'path' && points && points.length > 0) {
          ctx.beginPath();
          if (layer.shapeData.smooth && points.length >= 3) {
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 0; i < (layer.shapeData.closed ? points.length : points.length - 1); i++) {
              const p0 = points[(i - 1 + points.length) % points.length];
              const p1 = points[i % points.length];
              const p2 = points[(i + 1) % points.length];
              const p3 = points[(i + 2) % points.length];

              const cp1x = p1.x + (p2.x - p0.x) / 6;
              const cp1y = p1.y + (p2.y - p0.y) / 6;
              const cp2x = p2.x - (p3.x - p1.x) / 6;
              const cp2y = p2.y - (p3.y - p1.y) / 6;

              ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
            }
          } else {
            ctx.moveTo(points[0].x, points[0].y);
            points.forEach((p: any) => ctx.lineTo(p.x, p.y));
          }

          if (layer.shapeData.closed || layer.shapeData.smooth) ctx.closePath();

          if (fill) {
            ctx.fillStyle = fill;
            ctx.fill();
          }
          if (stroke && sw > 0) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = sw;
            ctx.stroke();
          }
        }
      }
    });
  }, [layers, documentSize]);

  const lastContentRef = useRef<{ [key: string]: string }>({});
  useEffect(() => {
    const timer = setTimeout(() => {
      layers.forEach(layer => {
        const { thumbnail, ...content } = layer;
        const contentStr = JSON.stringify(content);
        if (lastContentRef.current[layer.id] !== contentStr) {
          const canvas = canvasRefs.current[layer.id];
          if (canvas) {
            const thumbCanvas = document.createElement('canvas');
            const docAspect = documentSize.w / documentSize.h;
            const maxSize = 48;

            let thumbW, thumbH;
            if (docAspect > 1) {
              thumbW = maxSize;
              thumbH = maxSize / docAspect;
            } else {
              thumbH = maxSize;
              thumbW = maxSize * docAspect;
            }

            thumbCanvas.width = thumbW;
            thumbCanvas.height = thumbH;
            const thumbCtx = thumbCanvas.getContext('2d');
            if (thumbCtx) {
              const scaleX = thumbW / documentSize.w;
              const scaleY = thumbH / documentSize.h;
              thumbCtx.drawImage(
                canvas,
                0, 0, canvas.width, canvas.height,
                layer.position.x * scaleX, layer.position.y * scaleY,
                thumbW, thumbH
              );
              updateLayer(layer.id, { thumbnail: thumbCanvas.toDataURL() });
              lastContentRef.current[layer.id] = contentStr;
            }
          }
        }
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [layers, updateLayer]);

  const BRUSH_TOOLS = [
    'brush', 'pencil', 'eraser', 'clone', 'pattern_stamp',
    'healing', 'healing_brush', 'blur', 'sharpen', 'smudge',
    'dodge', 'burn', 'sponge', 'history_brush', 'art_history_brush',
    'mixer_brush', 'color_replacement', 'background_eraser', 'red_eye'
  ];

  const getCursor = () => {
    if (isInteracting && activeTool === 'hand') return 'grabbing';
    if (activeTool === 'hand') return 'grab';
    if (activeTool === 'move' || activeTool === 'artboard') return 'move';
    if (activeTool === 'zoom_tool') return isAltPressed ? 'zoom-out' : 'zoom-in';
    if (activeTool === 'eyedropper' || activeTool === 'color_sampler') return 'copy';
    if (activeTool === 'text' || activeTool === 'vertical_text') return 'text';

    // Pen & Vector Cursors
    let tool = activeTool;
    if (['pen', 'curvature_pen', 'free_pen', 'add_anchor', 'delete_anchor'].includes(activeTool as string)) {
      if (isCtrlPressed) tool = 'direct_select' as any;
      else if (isAltPressed) tool = 'convert_point' as any;
    }

    if (tool === 'pen' || tool === 'curvature_pen' || tool === 'free_pen') {
      return `url("data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 3.5 3.5L12 9 8.5 5.5 12 2Z"/><path d="m12 9-.342 6.163a2 2 0 0 1-1.316 1.71l-5.632 1.877L12 22l7.29-3.25-5.632-1.877a2 2 0 0 1-1.316-1.71L12 9Z"/></svg>')}") 0 22, auto`;
    }
    if (tool === 'add_anchor') {
      return `url("data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m8 2 3.5 3.5L8 9 4.5 5.5 8 2Z"/><path d="m8 9-.342 6.163a2 2 0 0 1-1.316 1.71l-5.632 1.877L8 22l7.29-3.25-5.632-1.877a2 2 0 0 1-1.316-1.71L8 9Z"/><line x1="16" y1="8" x2="22" y2="8" stroke="black" stroke-width="2"/><line x1="19" y1="5" x2="19" y2="11" stroke="black" stroke-width="2"/></svg>')}") 0 22, auto`;
    }
    if (tool === 'delete_anchor') {
      return `url("data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m8 2 3.5 3.5L8 9 4.5 5.5 8 2Z"/><path d="m8 9-.342 6.163a2 2 0 0 1-1.316 1.71l-5.632 1.877L8 22l7.29-3.25-5.632-1.877a2 2 0 0 1-1.316-1.71L8 9Z"/><line x1="16" y1="8" x2="22" y2="8" stroke="black" stroke-width="2"/></svg>')}") 0 22, auto`;
    }
    if (tool === 'direct_select') return 'crosshair';
    if (tool === 'path_select') return 'default';
    if (tool === 'convert_point') return 'alias';

    if (BRUSH_TOOLS.includes(activeTool as string)) {
      return 'none';
    }
    return 'crosshair';
  };

  const [mouseClientPos, setMouseClientPos] = useState<{ x: number, y: number }>({ x: 0, y: 0 });

  const stopOverlayEvent = (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.nativeEvent as Event).stopImmediatePropagation?.();
  };

  return (
    <div
      className="canvas-container"
      style={{ cursor: getCursor() }}
      onMouseMove={(e) => {
        setMouseClientPos({ x: e.clientX, y: e.clientY });
        const rawCoords = getCoordinates(e.clientX, e.clientY);
        if (rawCoords) {
          const isVectorTool = ['pen', 'curvature_pen', 'free_pen', 'add_anchor', 'delete_anchor', 'convert_point', 'path_select', 'direct_select'].includes(activeTool as string);
          const snapped = isVectorTool ? getSnappedCoords(rawCoords) : rawCoords;
          setCurrentMousePos(snapped);
        }
      }}
      onMouseDown={(e) => {
        if (e.button === 0) {
          startAction(e.clientX, e.clientY, e);
        }
      }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Brush Size Preview Cursor */}
      {BRUSH_TOOLS.includes(activeTool as string) && (
        <div
          className="brush-cursor"
          style={{
            position: 'fixed',
            left: mouseClientPos.x,
            top: mouseClientPos.y,
            width: (brushSize * zoom) / 2,
            height: (brushSize * zoom) / 2,
            border: '1px solid #fff',
            borderRadius: '50%',
            pointerEvents: 'none',
            zIndex: 10000,
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 2px rgba(0,0,0,0.5)',
            mixBlendMode: 'difference'
          }}
        />
      )}
      <div
        ref={stackRef}
        className="canvas-stack"
        style={{
          transform: `scale(${zoom}) translate(${canvasOffset.x / 2}px, ${canvasOffset.y / 2}px) rotate(${canvasRotation}deg)`,
          width: `${documentSize.w / 2}px`,
          height: `${documentSize.h / 2}px`,
          overflow: 'hidden'
        }}
        onTouchStart={handleTouchStart}
      >
        {layers.map((layer) => (
          <div
            key={layer.id}
            className={`layer-wrapper ${layer.visible ? 'visible' : 'hidden'}`}
            style={{
              position: 'absolute',
              top: 0, left: 0,
              width: '100%', height: '100%',
              zIndex: layers.length - layers.indexOf(layer),
              pointerEvents: 'none',
              mixBlendMode: (layer.blendMode === 'source-over' ? 'normal' : (layer.blendMode || 'normal')) as any,
              opacity: layer.opacity,
              transform: `translate(${layer.position.x / 2}px, ${layer.position.y / 2}px)`
            }}
          >
            <canvas
              ref={(el) => { canvasRefs.current[layer.id] = el; }}
              data-layer-id={layer.id}
              width={documentSize.w} height={documentSize.h}
              className="layer-canvas"
              style={{ width: '100%', height: '100%' }}
            />
            {activeLayerId === layer.id && (lassoPaths.length > 0 || selectionRect || draftLasso || draftShape) && (
              <svg
                className="lasso-svg"
                style={{
                  position: 'absolute',
                  top: 0, left: 0,
                  width: '100%', height: '100%',
                  pointerEvents: 'none',
                  zIndex: 1000,
                  transform: `translate(${-layer.position.x / 2}px, ${-layer.position.y / 2}px)` // Compensate for layer translate to keep SVG at doc origin
                }}
              >
                <defs>
                  <filter id="selectionUnion" colorInterpolationFilters="sRGB">
                    <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
                    <feMorphology operator="dilate" radius="1.2" result="expanded" />
                    <feComposite in="expanded" in2="SourceGraphic" operator="out" />
                    <feComponentTransfer>
                      <feFuncA type="discrete" tableValues="0 1" />
                    </feComponentTransfer>
                  </filter>
                </defs>

                {/* The Selection Mask (Dimming the UNSELECTED area) */}
                <path
                  d={isInverseSelection
                    ? getSelectionPathData()
                    : `M 0,0 L 0,${documentSize.h / 2} L ${documentSize.w / 2},${documentSize.h / 2} L ${documentSize.w / 2},0 Z ` +
                    getSelectionPathData()}
                  fill="rgba(0, 0, 0, 0.4)"
                  fillRule={isInverseSelection ? 'nonzero' : 'evenodd'}
                  style={{ pointerEvents: 'none' }}
                />

                {/* The marching ants outline */}
                <g className="marquee-dash">
                  {/* Pass 1: Solid White Base */}
                  <path
                    d={getSelectionPathData()}
                    fill="none"
                    stroke="#fff"
                    strokeWidth="1"
                    strokeLinejoin="round"
                  />
                  {/* Pass 2: Animated Dashed Black Overlay */}
                  <path
                    d={getSelectionPathData()}
                    fill="none"
                    stroke="#000"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    strokeLinejoin="round"
                    className="marching-ants"
                  />
                </g>

                {/* Patch Preview SVG */}
                {activeTool === 'patch' && (window as any)._patchOffset && (
                  <g style={{ transform: `translate(${(window as any)._patchOffset.x / 2}px, ${(window as any)._patchOffset.y / 2}px)` }}>
                    <path
                      d={getSelectionPathData()}
                      fill="none"
                      stroke="#fff"
                      strokeWidth="1"
                      strokeDasharray="4 2"
                      opacity="0.8"
                    />
                  </g>
                )}

                {/* Draft Rectangle Preview */}
                {draftShape && (
                  <g>
                    <rect
                      x={draftShape.x / 2}
                      y={draftShape.y / 2}
                      width={draftShape.w / 2}
                      height={draftShape.h / 2}
                      fill="rgba(0, 120, 215, 0.1)"
                      stroke="#fff"
                      strokeWidth="1.5"
                    />
                    <rect
                      x={draftShape.x / 2}
                      y={draftShape.y / 2}
                      width={draftShape.w / 2}
                      height={draftShape.h / 2}
                      fill="none"
                      stroke="#000"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                  </g>
                )}

                {/* Draft Lasso Preview (Eraser) */}
                {draftLasso && draftLasso.length > 0 && currentMousePos && (
                  <g>
                    <path
                      d={`M ${draftLasso[0].x / 2},${draftLasso[0].y / 2} ${draftLasso.slice(1).map(p => `L ${p.x / 2},${p.y / 2}`).join(' ')} L ${currentMousePos.x / 2},${currentMousePos.y / 2} Z`}
                      fill="rgba(0, 120, 215, 0.1)"
                      stroke="#fff"
                      strokeWidth="1.5"
                    />
                    <path
                      d={`M ${draftLasso[0].x / 2},${draftLasso[0].y / 2} ${draftLasso.slice(1).map(p => `L ${p.x / 2},${p.y / 2}`).join(' ')} L ${currentMousePos.x / 2},${currentMousePos.y / 2} Z`}
                      fill="none"
                      stroke="#000"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                  </g>
                )}

                {/* Gradient Preview Line */}
                {gradientStart && currentMousePos && (
                  <g>
                    <line
                      x1={gradientStart.x / 2} y1={gradientStart.y / 2}
                      x2={currentMousePos.x / 2} y2={currentMousePos.y / 2}
                      stroke="#fff" strokeWidth="1.5"
                    />
                    <line
                      x1={gradientStart.x / 2} y1={gradientStart.y / 2}
                      x2={currentMousePos.x / 2} y2={currentMousePos.y / 2}
                      stroke="#000" strokeWidth="1.5" strokeDasharray="4 4"
                    />
                    <circle cx={gradientStart.x / 2} cy={gradientStart.y / 2} r="4" fill="#fff" stroke="#000" />
                    <circle cx={currentMousePos.x / 2} cy={currentMousePos.y / 2} r="4" fill="#fff" stroke="#000" />
                  </g>
                )}

                {/* Anchor Points (Handles) - Matching Photopea style */}
                {!isInverseSelection && lassoPaths.map((path, pIdx) => (
                  <g key={`path-anchors-${pIdx}`}>
                    {path.map((point, iIdx) => {
                      const dist = currentMousePos ? Math.hypot(point.x - currentMousePos.x, point.y - currentMousePos.y) : Infinity;
                      const isHovered = dist < 12 / (zoom || 1);
                      const size = isHovered ? 8 : 4;
                      return (
                        <rect
                          key={`anchor-${pIdx}-${iIdx}`}
                          x={point.x / 2 - size / 4}
                          y={point.y / 2 - size / 4}
                          width={size / 2}
                          height={size / 2}
                          fill="#fff"
                          stroke="#000"
                          strokeWidth={0.5}
                        />
                      );
                    })}
                  </g>
                ))}

                {/* Perspective Crop Interaction Layer */}
                {activeTool === 'perspective_crop' && lassoPaths.length > 0 && lassoPaths[0].length === 4 && (
                  <g className="perspective-crop-ui">
                    {/* Fill area for moving */}
                    <path
                      d={`M ${lassoPaths[0][0].x / 2},${lassoPaths[0][0].y / 2} L ${lassoPaths[0][1].x / 2},${lassoPaths[0][1].y / 2} L ${lassoPaths[0][2].x / 2},${lassoPaths[0][2].y / 2} L ${lassoPaths[0][3].x / 2},${lassoPaths[0][3].y / 2} Z`}
                      fill="rgba(0, 170, 255, 0.1)"
                      style={{ pointerEvents: 'auto', cursor: 'move' }}
                      onMouseDown={(e) => {
                        stopOverlayEvent(e);
                        const c = getCoordinates(e.clientX, e.clientY);
                        if (!c) return;
                        (window as any)._pcDragIdx = 8;
                        (window as any)._pcStartPoint = { ...c };
                        (window as any)._pcOrigPoints = lassoPaths[0].map(p => ({ ...p }));
                        setIsInteracting(true);
                        lastPointRef.current = c;
                      }}
                      onTouchStart={(e) => {
                        stopOverlayEvent(e);
                        const c = getCoordinates(e.touches[0].clientX, e.touches[0].clientY);
                        if (!c) return;
                        (window as any)._pcDragIdx = 8;
                        (window as any)._pcStartPoint = { ...c };
                        (window as any)._pcOrigPoints = lassoPaths[0].map(p => ({ ...p }));
                        setIsInteracting(true);
                        lastPointRef.current = c;
                      }}
                    />

                    {/* Perspective Grid */}
                    <g className="perspective-grid" style={{ pointerEvents: 'none' }}>
                      {(() => {
                        const p = lassoPaths[0];
                        const lerp = (a: any, b: any, t: number) => ({
                          x: (a.x + (b.x - a.x) * t) / 2,
                          y: (a.y + (b.y - a.y) * t) / 2
                        });

                        const gridLines = [];
                        for (let t of [0.33, 0.66]) {
                          const top = lerp(p[0], p[1], t);
                          const bot = lerp(p[3], p[2], t);
                          gridLines.push(<line key={`v-${t}`} x1={top.x} y1={top.y} x2={bot.x} y2={bot.y} stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeDasharray="2,2" />);

                          const lft = lerp(p[0], p[3], t);
                          const rgt = lerp(p[1], p[2], t);
                          gridLines.push(<line key={`h-${t}`} x1={lft.x} y1={lft.y} x2={rgt.x} y2={rgt.y} stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeDasharray="2,2" />);
                        }
                        return gridLines;
                      })()}
                    </g>

                    {/* Corner Handles */}
                    {lassoPaths[0].map((point, i) => (
                      <rect
                        key={`corner-${i}`}
                        x={point.x / 2 - 4}
                        y={point.y / 2 - 4}
                        width={8}
                        height={8}
                        fill="#fff"
                        stroke="#00aaff"
                        strokeWidth={1}
                        style={{ cursor: i % 2 === 0 ? 'nwse-resize' : 'nesw-resize', pointerEvents: 'auto' }}
                      />
                    ))}

                    {/* Edge Midpoint Handles */}
                    {[0, 1, 2, 3].map(i => {
                      const p1 = lassoPaths[0][i];
                      const p2 = lassoPaths[0][(i + 1) % 4];
                      return (
                        <rect
                          key={`mid-${i}`}
                          x={(p1.x + p2.x) / 4 - 4}
                          y={(p1.y + p2.y) / 4 - 4}
                          width={8}
                          height={8}
                          fill="#fff"
                          stroke="#00aaff"
                          strokeWidth={1}
                          style={{ cursor: i % 2 === 0 ? 'ns-resize' : 'ew-resize', pointerEvents: 'auto' }}
                        />
                      );
                    })}
                  </g>
                )}
              </svg>
            )}
          </div>
        ))}

        {selectionRect && (
          <div className="selection-marquee" style={{
            left: selectionRect.w >= 0 ? selectionRect.x / 2 : (selectionRect.x + selectionRect.w) / 2,
            top: selectionRect.h >= 0 ? selectionRect.y / 2 : (selectionRect.y + selectionRect.h) / 2,
            width: Math.abs(selectionRect.w) / 2, height: Math.abs(selectionRect.h) / 2,
            zIndex: 10000
          }} />
        )}

        {draftShape && (
          <div
            style={{
              position: 'absolute',
              left: draftShape.w >= 0 ? draftShape.x / 2 : (draftShape.x + draftShape.w) / 2,
              top: draftShape.h >= 0 ? draftShape.y / 2 : (draftShape.y + draftShape.h) / 2,
              width: Math.abs(draftShape.w) / 2,
              height: Math.abs(draftShape.h) / 2,
              pointerEvents: 'none',
              zIndex: 10000,
              boxSizing: 'border-box',
              opacity: primaryOpacity,
            }}
          >
            {activeTool === 'shape' && (
              <div style={{
                width: '100%', height: '100%',
                backgroundColor: brushColor,
                border: `${strokeWidth / 2}px solid ${secondaryColor}`,
                borderRadius: `${useStore.getState().cornerRadius / 2}px`,
                boxSizing: 'border-box'
              }} />
            )}
            {activeTool === 'ellipse_shape' && (
              <div style={{
                width: '100%', height: '100%',
                backgroundColor: brushColor,
                border: `${strokeWidth / 2}px solid ${secondaryColor}`,
                borderRadius: '50%',
                boxSizing: 'border-box'
              }} />
            )}
            {['line_shape', 'triangle_shape', 'polygon_shape', 'custom_shape'].includes(activeTool as string) && (
              <svg style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                {activeTool === 'line_shape' && (() => {
                  const x1 = draftShape.w >= 0 ? 0 : Math.abs(draftShape.w) / 2;
                  const y1 = draftShape.h >= 0 ? 0 : Math.abs(draftShape.h) / 2;
                  const x2 = draftShape.w >= 0 ? Math.abs(draftShape.w) / 2 : 0;
                  const y2 = draftShape.h >= 0 ? Math.abs(draftShape.h) / 2 : 0;
                  return (
                    <>
                      <line
                        x1={x1} y1={y1} x2={x2} y2={y2}
                        stroke={brushColor}
                        strokeWidth={strokeWidth / 2}
                      />
                      <circle cx={x1} cy={y1} r={3} fill="#fff" stroke="#00aaff" strokeWidth={1} />
                      <circle cx={x2} cy={y2} r={3} fill="#fff" stroke="#00aaff" strokeWidth={1} />
                    </>
                  );
                })()}
                {activeTool === 'triangle_shape' && (() => {
                  const w = Math.abs(draftShape.w) / 2;
                  const h = Math.abs(draftShape.h) / 2;
                  const points = [
                    { x: w / 2, y: 0 },
                    { x: 0, y: h },
                    { x: w, y: h }
                  ];
                  return (
                    <>
                      <polygon
                        points={points.map(p => `${p.x},${p.y}`).join(' ')}
                        fill={brushColor}
                        stroke={secondaryColor}
                        strokeWidth={strokeWidth / 2}
                        opacity={primaryOpacity}
                      />
                      {points.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#fff" stroke="#00aaff" strokeWidth={1} />
                      ))}
                    </>
                  );
                })()}
                {activeTool === 'polygon_shape' && (() => {
                  const sides = useStore.getState().polygonSides;
                  const w = Math.abs(draftShape.w) / 2;
                  const h = Math.abs(draftShape.h) / 2;
                  const cx = w / 2;
                  const cy = h / 2;
                  const rx = w / 2;
                  const ry = h / 2;
                  const points: { x: number, y: number }[] = [];
                  for (let i = 0; i < sides; i++) {
                    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
                    points.push({ x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry });
                  }
                  return (
                    <>
                      <polygon
                        points={points.map(p => `${p.x},${p.y}`).join(' ')}
                        fill={brushColor}
                        stroke={secondaryColor}
                        strokeWidth={strokeWidth / 2}
                        opacity={primaryOpacity}
                      />
                      {points.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#fff" stroke="#00aaff" strokeWidth={1} />
                      ))}
                    </>
                  );
                })()}
                {activeTool === 'custom_shape' && (() => {
                  const w = Math.abs(draftShape.w) / 2;
                  const h = Math.abs(draftShape.h) / 2;
                  const points_count = useStore.getState().starPoints;
                  const cx = w / 2;
                  const cy = h / 2;
                  const outerRadius = Math.min(w, h) / 2;
                  const innerRadius = outerRadius * (useStore.getState().starInnerRadius / 100);
                  const points: { x: number, y: number }[] = [];
                  for (let i = 0; i < points_count * 2; i++) {
                    const angle = (i * Math.PI) / points_count - Math.PI / 2;
                    const radius = i % 2 === 0 ? outerRadius : innerRadius;
                    points.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
                  }
                  return (
                    <>
                      <polygon
                        points={points.map(p => `${p.x},${p.y}`).join(' ')}
                        fill={brushColor}
                        stroke={secondaryColor}
                        strokeWidth={strokeWidth / 2}
                        opacity={primaryOpacity}
                      />
                      {points.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#fff" stroke="#00aaff" strokeWidth={1} />
                      ))}
                    </>
                  );
                })()}
              </svg>
            )}
          </div>
        )}

        {textEditor && (
          <>
            <textarea
              ref={hiddenTextInputRef}
              className="text-editor-input"
              style={{
                left: textEditor.x / 2,
                top: textEditor.y / 2,
              }}
              value={textEditor.value}
              onChange={(e) => setTextEditor(prev => prev ? { ...prev, value: e.target.value } : null)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="sentences"
              spellCheck={false}
              inputMode="text"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            />
            <canvas
              ref={draftTextCanvasRef}
              width={documentSize.w} height={documentSize.h}
              className="layer-canvas visible"
              style={{
                opacity: 1,
                zIndex: 9999, // Render above everything while typing
                mixBlendMode: 'normal'
              }}
            />
            <div
              className="text-action-bar"
              style={{
                left: textEditor.x / 2,
                top: (textEditor.y / 2) - 45, // Positioned slightly above the bounding box
              }}
              onMouseDown={(e) => e.stopPropagation()} // Prevent canvas click passthrough
              onTouchStart={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                className="commit-btn"
                onClick={(e) => { e.stopPropagation(); commitText(); }}
                title="Commit (Enter)"
              >
                ✓
              </button>
              <button
                className="cancel-btn"
                onClick={(e) => { e.stopPropagation(); cancelText(); }}
                title="Cancel (Esc)"
              >
                ✕
              </button>
            </div>
          </>
        )}

        {currentMousePos && ['brush', 'pencil', 'eraser', 'blur', 'sharpen', 'dodge', 'burn', 'healing', 'healing_brush', 'smudge', 'clone'].includes(activeTool) && (
          <div className="brush-cursor" style={{ left: currentMousePos.x / 2, top: currentMousePos.y / 2, width: brushSize / 2, height: brushSize / 2 }} />
        )}

        {cloneSource && activeTool === 'clone' && (
          <div className="source-cursor" style={{ position: 'absolute', left: cloneSource.x / 2, top: cloneSource.y / 2, width: '20px', height: '20px', border: '1px solid white', borderRadius: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 1000 }}>
            <div style={{ position: 'absolute', top: '50%', left: 0, width: '100%', height: '1px', background: 'white' }} />
            <div style={{ position: 'absolute', left: '50%', top: 0, width: '1px', height: '100%', background: 'white' }} />
          </div>
        )}

        {(window as any)._healingSource && activeTool === 'healing_brush' && (
          <div className="source-cursor" style={{ position: 'absolute', left: (window as any)._healingSource.x / 2, top: (window as any)._healingSource.y / 2, width: '20px', height: '20px', border: '1px solid #00ff00', borderRadius: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 1000 }}>
            <div style={{ position: 'absolute', top: '50%', left: 0, width: '100%', height: '1px', background: '#00ff00' }} />
            <div style={{ position: 'absolute', left: '50%', top: 0, width: '1px', height: '100%', background: '#00ff00' }} />
          </div>
        )}

        {/* Selection rendering is now handled globally via SVG mask inside the layer loop or at doc level */}


        {cropRect && (
          <div
            className="crop-marquee"
            onMouseDown={(e) => {
              stopOverlayEvent(e);
              const c = getCoordinates(e.clientX, e.clientY);
              if (c) lastPointRef.current = c;
              setActiveCropHandle('move');
              setIsInteracting(true);
            }}
            onTouchStart={(e) => {
              stopOverlayEvent(e);
              const c = getCoordinates(e.touches[0].clientX, e.touches[0].clientY);
              if (c) lastPointRef.current = c;
              setActiveCropHandle('move');
              setIsInteracting(true);
            }}
            onPointerDown={stopOverlayEvent}
            style={{
              left: cropRect.w >= 0 ? cropRect.x / 2 : (cropRect.x + cropRect.w) / 2,
              top: cropRect.h >= 0 ? cropRect.y / 2 : (cropRect.y + cropRect.h) / 2,
              width: Math.abs(cropRect.w) / 2, height: Math.abs(cropRect.h) / 2,
              position: 'absolute', border: '2px solid #fff', outline: '2000px solid rgba(0,0,0,0.5)', zIndex: 10000,
              cursor: 'move'
            }}>
            {/* Handles */}
            <div className="crop-handle tl" onMouseDown={(e) => { stopOverlayEvent(e); const c = getCoordinates(e.clientX, e.clientY); if (c) lastPointRef.current = c; setActiveCropHandle('tl'); setIsInteracting(true); }} onTouchStart={(e) => { stopOverlayEvent(e); const c = getCoordinates(e.touches[0].clientX, e.touches[0].clientY); if (c) lastPointRef.current = c; setActiveCropHandle('tl'); setIsInteracting(true); }} onPointerDown={stopOverlayEvent} />
            <div className="crop-handle tr" onMouseDown={(e) => { stopOverlayEvent(e); const c = getCoordinates(e.clientX, e.clientY); if (c) lastPointRef.current = c; setActiveCropHandle('tr'); setIsInteracting(true); }} onTouchStart={(e) => { stopOverlayEvent(e); const c = getCoordinates(e.touches[0].clientX, e.touches[0].clientY); if (c) lastPointRef.current = c; setActiveCropHandle('tr'); setIsInteracting(true); }} onPointerDown={stopOverlayEvent} />
            <div className="crop-handle bl" onMouseDown={(e) => { stopOverlayEvent(e); const c = getCoordinates(e.clientX, e.clientY); if (c) lastPointRef.current = c; setActiveCropHandle('bl'); setIsInteracting(true); }} onTouchStart={(e) => { stopOverlayEvent(e); const c = getCoordinates(e.touches[0].clientX, e.touches[0].clientY); if (c) lastPointRef.current = c; setActiveCropHandle('bl'); setIsInteracting(true); }} onPointerDown={stopOverlayEvent} />
            <div className="crop-handle br" onMouseDown={(e) => { stopOverlayEvent(e); const c = getCoordinates(e.clientX, e.clientY); if (c) lastPointRef.current = c; setActiveCropHandle('br'); setIsInteracting(true); }} onTouchStart={(e) => { stopOverlayEvent(e); const c = getCoordinates(e.touches[0].clientX, e.touches[0].clientY); if (c) lastPointRef.current = c; setActiveCropHandle('br'); setIsInteracting(true); }} onPointerDown={stopOverlayEvent} />
            <div className="crop-handle tm" onMouseDown={(e) => { stopOverlayEvent(e); const c = getCoordinates(e.clientX, e.clientY); if (c) lastPointRef.current = c; setActiveCropHandle('tm'); setIsInteracting(true); }} onTouchStart={(e) => { stopOverlayEvent(e); const c = getCoordinates(e.touches[0].clientX, e.touches[0].clientY); if (c) lastPointRef.current = c; setActiveCropHandle('tm'); setIsInteracting(true); }} onPointerDown={stopOverlayEvent} />
            <div className="crop-handle bm" onMouseDown={(e) => { stopOverlayEvent(e); const c = getCoordinates(e.clientX, e.clientY); if (c) lastPointRef.current = c; setActiveCropHandle('bm'); setIsInteracting(true); }} onTouchStart={(e) => { stopOverlayEvent(e); const c = getCoordinates(e.touches[0].clientX, e.touches[0].clientY); if (c) lastPointRef.current = c; setActiveCropHandle('bm'); setIsInteracting(true); }} onPointerDown={stopOverlayEvent} />
            <div className="crop-handle lm" onMouseDown={(e) => { stopOverlayEvent(e); const c = getCoordinates(e.clientX, e.clientY); if (c) lastPointRef.current = c; setActiveCropHandle('lm'); setIsInteracting(true); }} onTouchStart={(e) => { stopOverlayEvent(e); const c = getCoordinates(e.touches[0].clientX, e.touches[0].clientY); if (c) lastPointRef.current = c; setActiveCropHandle('lm'); setIsInteracting(true); }} onPointerDown={stopOverlayEvent} />
            <div className="crop-handle rm" onMouseDown={(e) => { stopOverlayEvent(e); const c = getCoordinates(e.clientX, e.clientY); if (c) lastPointRef.current = c; setActiveCropHandle('rm'); setIsInteracting(true); }} onTouchStart={(e) => { stopOverlayEvent(e); const c = getCoordinates(e.touches[0].clientX, e.touches[0].clientY); if (c) lastPointRef.current = c; setActiveCropHandle('rm'); setIsInteracting(true); }} onPointerDown={stopOverlayEvent} />

            {/* Action Bar - Moved to bottom to avoid clipping */}
            <div className="crop-actions-bar bottom" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
              <button
                className="crop-action-btn confirm"
                onClick={(e) => { e.stopPropagation(); applyCrop(); }}
                title="Apply Crop"
              >
                ✓
              </button>
              <button
                className="crop-action-btn cancel"
                onClick={(e) => { e.stopPropagation(); setCropRect(null); }}
                title="Cancel Crop"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {(vectorPaths.length > 0 || (activeTool === 'pen' && activePathIndex !== null)) && (
          <svg className="vector-paths-svg" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1100 }}>
            {vectorPaths.map((path, idx) => (
              <path
                key={idx}
                d={getSvgPathData(path.points, path.closed, path.smooth)}
                fill="none"
                stroke={activePathIndex === idx ? "#00aaff" : "#fff"}
                strokeWidth="2"
                strokeDasharray="4 4"
              />
            ))}
            {/* Rubber Band Preview */}
            {['pen', 'curvature_pen', 'free_pen'].includes(activeTool) && activePathIndex !== null && vectorPaths[activePathIndex] && !vectorPaths[activePathIndex].closed && currentMousePos && (
              <>
                <path
                  d={getSvgPathData([...vectorPaths[activePathIndex].points, currentMousePos], false, activeTool === 'curvature_pen' || vectorPaths[activePathIndex].smooth)}
                  stroke="#00aaff"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                  fill="none"
                  style={{ opacity: 0.8 }}
                />
                <circle
                  cx={currentMousePos.x / 2}
                  cy={currentMousePos.y / 2}
                  r="4"
                  fill="#00aaff"
                  opacity="0.3"
                />
                <circle
                  cx={currentMousePos.x / 2}
                  cy={currentMousePos.y / 2}
                  r="2"
                  fill="#fff"
                  stroke="#00aaff"
                  strokeWidth="1"
                />
              </>
            )}
            {/* Hover Preview for start of new path */}
            {activeTool === 'pen' && activePathIndex === null && currentMousePos && (
              <circle
                cx={currentMousePos.x / 2}
                cy={currentMousePos.y / 2}
                r="4"
                fill="none"
                stroke="#00aaff"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
            )}
            {/* Close Path Square Indicator */}
            {['pen', 'curvature_pen'].includes(activeTool) && activePathIndex !== null && vectorPaths[activePathIndex] && !vectorPaths[activePathIndex].closed && currentMousePos && (
              (() => {
                const firstPoint = vectorPaths[activePathIndex].points[0];
                const isNearStart = Math.hypot(currentMousePos.x - firstPoint.x, currentMousePos.y - firstPoint.y) < 10 / (zoom || 1);
                if (isNearStart) {
                  return (
                    <rect
                      x={firstPoint.x / 2 - 4}
                      y={firstPoint.y / 2 - 4}
                      width="8"
                      height="8"
                      fill="none"
                      stroke="#00aaff"
                      strokeWidth="2"
                    />
                  );
                }
                return null;
              })()
            )}
            {/* Render Anchor Points for all paths when in vector tools */}
            {['pen', 'curvature_pen', 'free_pen', 'add_anchor', 'delete_anchor', 'convert_point', 'path_select', 'direct_select'].includes(activeTool) && vectorPaths.map((path, pIdx) => (
              <g key={`path-points-${pIdx}`}>
                {path.points.map((p, ptIdx) => {
                  const isSelected = activePathIndex === pIdx && selectedPoint?.pointIdx === ptIdx;
                  const dist = currentMousePos ? Math.hypot(p.x - currentMousePos.x, p.y - currentMousePos.y) : Infinity;
                  const isHovered = dist < 12 / (zoom || 1);
                  const radius = isSelected ? 5 : (isHovered ? 6 : 3);
                  return (
                    <circle
                      key={`${pIdx}-${ptIdx}`}
                      cx={p.x / 2}
                      cy={p.y / 2}
                      r={radius}
                      fill={isSelected ? "#00aaff" : "#fff"}
                      stroke="#00aaff"
                      strokeWidth="1"
                      style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                    />
                  );
                })}
              </g>
            ))}
          </svg>
        )}

        {/* Perspective Crop Action Bar */}
        {activeTool === 'perspective_crop' && lassoPaths.length > 0 && lassoPaths[0].length === 4 && (
          <div
            className="perspective-actions-bar"
            style={{
              position: 'absolute',
              left: Math.min(...lassoPaths[0].map(p => p.x)) / 2,
              top: Math.max(...lassoPaths[0].map(p => p.y)) / 2 + 15,
              zIndex: 20000,
              display: 'flex',
              gap: '10px',
              pointerEvents: 'auto',
              background: '#222',
              padding: '8px',
              borderRadius: '6px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              border: '1px solid #444'
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                handleDoubleClick();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', transition: 'transform 0.1s' }}
              title="Apply (Enter)"
            >
              ✓
            </button>
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                delete (window as any)._pcPoints;
                setLassoPaths([]);
                setIsInteracting(false);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', transition: 'transform 0.1s' }}
              title="Cancel (Esc)"
            >
              ✕
            </button>
          </div>
        )}

        {/* Slices Overlay */}
        {slices && slices.length > 0 && (
          <div className="slices-overlay" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1500 }}>
            {slices.map((slice, i) => {
              const isSelected = (window as any)._sliceLastClickedIdx === i;
              return (
                <div
                  key={slice.id}
                  className="slice-rect"
                  style={{
                    position: 'absolute',
                    left: slice.rect.x / 2,
                    top: slice.rect.y / 2,
                    width: slice.rect.w / 2,
                    height: slice.rect.h / 2,
                    border: isSelected ? '2px solid #0055ff' : '1px solid #00aaff',
                    backgroundColor: isSelected ? 'rgba(0, 85, 255, 0.25)' : 'rgba(0, 170, 255, 0.1)'
                  }}
                >
                  <span style={{
                    position: 'absolute',
                    top: 0, left: 0,
                    background: isSelected ? '#0055ff' : '#00aaff',
                    color: 'white',
                    fontSize: '8px',
                    padding: '1px 3px',
                    lineHeight: '1',
                    pointerEvents: 'none'
                  }}>
                    {slice.id}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {colorSamplers && colorSamplers.length > 0 && (
          <div className="samplers-overlay" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1600 }}>
            {colorSamplers.map((s) => (
              <div
                key={s.id}
                style={{
                  position: 'absolute',
                  left: s.x / 2,
                  top: s.y / 2,
                  width: '1px', height: '1px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <div style={{ position: 'absolute', width: '12px', height: '12px', border: '1px solid white', borderRadius: '50%', boxShadow: '0 0 0 1px black' }} />
                <div style={{ position: 'absolute', width: '8px', height: '1px', background: 'white', transform: 'rotate(0deg)' }} />
                <div style={{ position: 'absolute', width: '1px', height: '8px', background: 'white' }} />
                <span style={{ position: 'absolute', left: '8px', top: '8px', background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: '10px', padding: '1px 3px', borderRadius: '2px' }}>
                  {s.id}
                </span>
              </div>
            ))}
          </div>
        )}

        {rulerData && (
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1700 }} onPointerDown={(e) => e.stopPropagation()}>
            <line
              x1={rulerData.start.x / 2} y1={rulerData.start.y / 2}
              x2={rulerData.end.x / 2} y2={rulerData.end.y / 2}
              stroke="white" strokeWidth="1" strokeDasharray="4 2"
            />
            <circle cx={rulerData.start.x / 2} cy={rulerData.start.y / 2} r="3" fill="white" stroke="black" />
            <circle cx={rulerData.end.x / 2} cy={rulerData.end.y / 2} r="3" fill="white" stroke="black" />
          </svg>
        )}
      </div>
    </div>
  );
};

export default Canvas;
