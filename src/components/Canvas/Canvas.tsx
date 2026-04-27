import React, { useEffect, useRef, useState, useCallback } from 'react';
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
    canvasOffset, setCanvasOffset, setBrushColor,
    lassoPaths, setLassoPaths, selectionRect, setSelectionRect,
    isInverseSelection, setIsInverseSelection,
    documentSize, setDocumentSize,
    vectorPaths, setVectorPaths, activePathIndex, setActivePathIndex, penMode,
    slices, setSlices, addSlice,
    colorSamplers, addColorSampler, clearColorSamplers, rulerData, setRulerData
  } = store;

  // 1. Unified State for maximum stability
  const [isInteracting, setIsInteracting] = useState(false);
  const [currentMousePos, setCurrentMousePos] = useState<{ x: number, y: number } | null>(null);
  const [textEditor, setTextEditor] = useState<{ x: number, y: number, value: string } | null>(null);
  const [draftShape, setDraftShape] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [cropRect, setCropRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [gradientStart, setGradientStart] = useState<{ x: number, y: number } | null>(null);
  const [cloneSource, setCloneSource] = useState<{ x: number, y: number } | null>(null);

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
    const nx = (clientX - rect.left) / rect.width;
    const ny = (clientY - rect.top) / rect.height;

    return {
      x: nx * documentSize.w,
      y: ny * documentSize.h
    };
  }, [documentSize]);


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
        lassoPaths.forEach((path, pIdx) => {
          if (path.length < 1) return;
          ctx.moveTo(path[0].x, path[0].y);
          path.forEach(p => ctx.lineTo(p.x, p.y));
          
          // Preview line for polygonal/magnetic lasso (String effect)
          if ((activeTool === 'polygonal_lasso' || activeTool === 'magnetic_lasso') && isInteracting && currentMousePos && pIdx === lassoPaths.length - 1) {
            if (activeTool === 'magnetic_lasso') {
              const snapped = findBestEdgePoint(currentMousePos.x, currentMousePos.y, 15);
              ctx.lineTo(snapped.x, snapped.y);
            } else {
              ctx.lineTo(currentMousePos.x, currentMousePos.y);
            }
          }
          
          ctx.closePath();
        });
        ctx.fillStyle = 'rgba(0, 120, 215, 0.15)';
        ctx.fill(isInverseSelection ? 'nonzero' : 'evenodd');

        offset++;
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -offset;
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        lassoPaths.forEach((path, pIdx) => {
          if (path.length < 1) return;
          ctx.moveTo(path[0].x, path[0].y);
          path.forEach(p => ctx.lineTo(p.x, p.y));
          
          if ((activeTool === 'polygonal_lasso' || activeTool === 'magnetic_lasso') && isInteracting && currentMousePos && pIdx === lassoPaths.length - 1) {
            if (activeTool === 'magnetic_lasso') {
              const snapped = findBestEdgePoint(currentMousePos.x, currentMousePos.y, 15);
              ctx.lineTo(snapped.x, snapped.y);
            } else {
              ctx.lineTo(currentMousePos.x, currentMousePos.y);
            }
          }
          
          ctx.closePath();
        });
        
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        ctx.lineDashOffset = -offset + 4;
        ctx.strokeStyle = '#000';
        ctx.stroke();
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
          const size = isActive ? 8 : 6;

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
        visible: true, opacity: 1
      });
      recordHistory('Add Text Layer');
    }
    setTextEditor(null);
  }, [textEditor, addLayer, recordHistory, brushSize, brushColor]);

  const cancelText = useCallback(() => {
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
    const coords = getCoordinates(clientX, clientY);
    if (!coords) return;

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
      colorSamplers, addColorSampler, clearColorSamplers, rulerData, setRulerData
    };

    const toolModule = getToolModule(activeTool);
    if (toolModule?.start) {
      toolModule.start(context);
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

    if (activeTool === 'text') {
      if (textEditor) commitText();
      else setTextEditor({ ...coords, value: '' });
      return;
    }

    if (activeTool === 'select') {
      // Logic for layer selection could be modularized later
    } else if (activeTool === 'crop') {
      if (cropRect) {
        setCropRect(null);
      } else {
        setCropRect({ x: coords.x, y: coords.y, w: 0, h: 0 });
      }
    } else if (activeTool === 'gradient') {
      setGradientStart({ x: coords.x, y: coords.y });
    } else if (activeTool === 'clone' && (e as any).altKey) {
      setCloneSource({ x: coords.x, y: coords.y });
      return;
    } else if (activeTool === 'shape' || activeTool === 'ellipse_shape' || activeTool === 'line_shape') {
      setDraftShape({ x: coords.x, y: coords.y, w: 0, h: 0 });
    } else if (activeTool === 'pen') {
      if (activePathIndex !== null) {
        const path = vectorPaths[activePathIndex];
        const firstPoint = path.points[0];
        const dist = Math.hypot(coords.x - firstPoint.x, coords.y - firstPoint.y);

        // Close path if clicking near first point
        if (dist < 10 / (zoom || 1) && path.points.length > 2) {
          setVectorPaths(prev => {
            const next = [...prev];
            next[activePathIndex] = { ...next[activePathIndex], closed: true };
            return next;
          });
          setActivePathIndex(null);
          return;
        }

        // Add point to current path if not closed
        if (!path.closed) {
          setVectorPaths(prev => {
            const next = [...prev];
            next[activePathIndex].points.push(coords);
            return next;
          });
          return;
        }
      }

      // Start new path
      const newIdx = vectorPaths.length;
      setVectorPaths(prev => [...prev, { points: [coords], closed: false }]);
      setActivePathIndex(newIdx);
      return;
    } else if (activeTool === 'path_select') {
      let closestIdx = -1;
      let minDist = 100;
      vectorPaths.forEach((path, idx) => {
        path.points.forEach(p => {
          const d = Math.hypot(p.x - coords.x, p.y - coords.y);
          if (d < minDist) { minDist = d; closestIdx = idx; }
        });
      });
      setActivePathIndex(closestIdx === -1 ? null : closestIdx);
    }
  }, [getCoordinates, activeTool, textEditor, commitText, layers, setActiveLayer, zoom, setZoom, handleEyedropper, activeLayerId, canvasOffset, lassoPaths, vectorPaths, setActivePathIndex, setLassoPaths, setSelectionRect, cropRect, setCropRect, setDraftShape, setVectorPaths, setGradientStart, handlePaintBucket, setCloneSource, brushSize, brushColor, primaryOpacity, recordHistory, setIsInteracting, addLayer, strokeWidth, hexToRgba, secondaryColor, secondaryOpacity]);

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
      colorSamplers, addColorSampler, clearColorSamplers, rulerData, setRulerData
    };

    const toolModule = getToolModule(activeTool);
    if (toolModule?.doubleClick) {
      toolModule.doubleClick(context);
    }
  }, [activeTool, recordHistory, currentMousePos, brushSize, brushColor, zoom, activeLayerId, layers, selectionRect, setLassoPaths, setSelectionRect, setCropRect, updateLayer, setIsInteracting, setBrushColor, addLayer, setDocumentSize]);

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
      startAction(e.touches[0].clientX, e.touches[0].clientY, e);
    }
  }, [zoom, canvasOffset, startAction]);

  const moveAction = useCallback((clientX: number, clientY: number) => {
    if (!isInteracting) return;
    const coords = getCoordinates(clientX, clientY);
    if (!coords) return;
    setCurrentMousePos(coords);

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
      colorSamplers, addColorSampler, clearColorSamplers, rulerData, setRulerData
    };

    const toolModule = getToolModule(activeTool);
    if (toolModule?.move) {
      toolModule.move(context);
      lastPointRef.current = coords;
      return;
    }

    if (activeTool === 'hand' && startMouseRef.current && startOffsetRef.current) {
      const dx = clientX - startMouseRef.current.x;
      const dy = clientY - startMouseRef.current.y;
      // We divide by zoom to keep the pan speed consistent with the mouse
      setCanvasOffset({
        x: startOffsetRef.current.x + (dx * 2) / zoom,
        y: startOffsetRef.current.y + (dy * 2) / zoom
      });
      return;
    }

    if (activeTool === 'clone' && cloneSource && startMouseRef.current) {
      const id = activeLayerId || layers[0]?.id;
      const canvas = canvasRefs.current[id];
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        const layer = layers.find(l => l.id === id);
        const lx = coords.x - (layer?.position.x || 0);
        const ly = coords.y - (layer?.position.y || 0);
        const dx = coords.x - startMouseRef.current.x;
        const dy = coords.y - startMouseRef.current.y;
        const sx = cloneSource.x - (layer?.position.x || 0) + dx;
        const sy = cloneSource.y - (layer?.position.y || 0) + dy;

        ctx.save();
        ctx.beginPath();
        ctx.arc(lx, ly, brushSize / 2, 0, Math.PI * 2);
        ctx.clip('evenodd');
        if (canvas) {
          ctx.drawImage(canvas, sx - brushSize / 2, sy - brushSize / 2, brushSize, brushSize, lx - brushSize / 2, ly - brushSize / 2, brushSize, brushSize);
        }
        ctx.restore();
      }
    }

    if (activeTool === 'crop' && activeCropHandle && cropRect) {
      const { x, y, w, h } = cropRect;
      let newRect = { ...cropRect };

      if (activeCropHandle === 'tl') { newRect.x = coords.x; newRect.y = coords.y; newRect.w = w + (x - coords.x); newRect.h = h + (y - coords.y); }
      else if (activeCropHandle === 'tr') { newRect.y = coords.y; newRect.w = coords.x - x; newRect.h = h + (y - coords.y); }
      else if (activeCropHandle === 'bl') { newRect.x = coords.x; newRect.w = w + (x - coords.x); newRect.h = coords.y - y; }
      else if (activeCropHandle === 'br') { newRect.w = coords.x - x; newRect.h = coords.y - y; }
      else if (activeCropHandle === 'tm') { newRect.y = coords.y; newRect.h = h + (y - coords.y); }
      else if (activeCropHandle === 'bm') { newRect.h = coords.y - y; }
      else if (activeCropHandle === 'lm') { newRect.x = coords.x; newRect.w = w + (x - coords.x); }
      else if (activeCropHandle === 'rm') { newRect.w = coords.x - x; }
      else if (activeCropHandle === 'move' && lastPointRef.current) {
        const dx = coords.x - lastPointRef.current.x;
        const dy = coords.y - lastPointRef.current.y;
        newRect.x += dx;
        newRect.y += dy;
      }

      setCropRect(newRect);
      lastPointRef.current = coords;
      return;
    }

    if (activeTool === 'crop') {
      setCropRect(prev => prev ? { ...prev, w: coords.x - prev.x, h: coords.y - prev.y } : null);
      return;
    }
    if (activeTool === 'object_selection') {
      setSelectionRect(prev => prev ? { ...prev, w: coords.x - prev.x, h: coords.y - prev.y } : null);
      return;
    }
    if (activeTool === 'shape' || activeTool === 'ellipse_shape' || activeTool === 'line_shape') {
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
  }, [getCoordinates, isInteracting, activeTool, activeLayerId, layers, brushSize, strokeWidth, hexToRgba, secondaryColor, secondaryOpacity, brushColor, primaryOpacity, updateLayer, canvasOffset, setCanvasOffset, cloneSource, selectionRect, lassoPaths, activeCropHandle, cropRect, applySelectionClip, findBestEdgePoint]);

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
      brushSize, brushColor, zoom,
      activeLayerId, layers,
      selectionMode: useStore.getState().selectionMode,
      selectionTolerance: useStore.getState().selectionTolerance,
      selectionContiguous: useStore.getState().selectionContiguous,
      selectionRect, lassoPaths, isInverseSelection,
      setLassoPaths, setSelectionRect, setCropRect, updateLayer, recordHistory, setIsInteracting,
      setBrushColor, addLayer, setDocumentSize,
      slices, setSlices, addSlice,
      colorSamplers, addColorSampler, clearColorSamplers, rulerData, setRulerData
    };

    const toolModule = getToolModule(activeTool);
    if (toolModule?.end) {
      toolModule.end(context);
    }

    if (['brush', 'pencil', 'eraser', 'blur', 'sharpen', 'dodge', 'burn', 'healing', 'healing_brush', 'patch', 'smudge', 'clone'].includes(activeTool)) {
      const id = activeLayerId || layers[0]?.id;
      const canvas = canvasRefs.current[id];
      if (canvas) {
        updateLayer(id, { dataUrl: canvas.toDataURL() });
        recordHistory(activeTool.charAt(0).toUpperCase() + activeTool.slice(1));
      }
    }

    if ((activeTool === 'shape' || activeTool === 'ellipse_shape' || activeTool === 'line_shape') && draftShape) {
      const w = Math.abs(draftShape.w);
      const h = Math.abs(draftShape.h);
      if (w > 1 || h > 1) {
        const shapeType = activeTool === 'ellipse_shape' ? 'ellipse' : (activeTool === 'line_shape' ? 'path' : 'rect');
        const points = activeTool === 'line_shape' 
          ? [{ x: draftShape.w < 0 ? w : 0, y: draftShape.h < 0 ? h : 0 }, { x: draftShape.w < 0 ? 0 : w, y: draftShape.h < 0 ? 0 : h }] 
          : [];
        
        addLayer({
          name: activeTool === 'ellipse_shape' ? 'Ellipse' : (activeTool === 'line_shape' ? 'Line' : 'Rectangle'),
          type: 'shape',
          position: {
            x: draftShape.w >= 0 ? draftShape.x : draftShape.x + draftShape.w,
            y: draftShape.h >= 0 ? draftShape.y : draftShape.y + draftShape.h
          },
          shapeData: {
            type: shapeType,
            w, h,
            points: activeTool === 'line_shape' ? points : undefined,
            fill: activeTool === 'line_shape' ? 'transparent' : hexToRgba(brushColor, primaryOpacity),
            stroke: hexToRgba(secondaryColor, secondaryOpacity),
            strokeWidth: strokeWidth
          }
        });
        recordHistory(`Add ${activeTool}`);
      }
      setDraftShape(null);
    }

    if (activeTool === 'gradient' && gradientStart && currentMousePos) {
      applyGradient(gradientStart, currentMousePos);
      setGradientStart(null);
      recordHistory('Gradient');
    }

    if (activeTool === 'move') {
      recordHistory('Move Layer');
    }

    setIsInteracting(false);
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
    const onMove = (e: MouseEvent | TouchEvent) => {
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

    if (isInteracting || initialTouchDistance !== null) {
      window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', onUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [isInteracting, initialTouchDistance, handleTouchMove]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (textEditor) {
        if (e.key === 'Escape') {
          commitText();
          return;
        }
        if (e.key === 'Backspace') {
          setTextEditor(prev => prev ? { ...prev, value: prev.value.slice(0, -1) } : null);
          return;
        }
        if (e.key === 'Enter') {
          if (e.ctrlKey || e.metaKey) {
            commitText();
            return;
          }
          setTextEditor(prev => prev ? { ...prev, value: prev.value + '\n' } : null);
          return;
        }
        if (e.key.length === 1) {
          setTextEditor(prev => prev ? { ...prev, value: prev.value + e.key } : null);
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
    const preventScroll = (e: KeyboardEvent) => {
      if (textEditor && (e.code === 'Space' || e.key === 'Backspace')) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keydown', preventScroll, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
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
      lines.forEach((line, i) => {
        const yPos = textEditor.y + (i + 1) * fs;
        if (strokeWidth > 0) {
          ctx.strokeStyle = hexToRgba(secondaryColor, secondaryOpacity);
          ctx.lineWidth = strokeWidth;
          ctx.strokeText(line, textEditor.x, yPos);
        }
        ctx.fillText(line, textEditor.x, yPos);
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
          lines.forEach((line, i) => {
            const yPos = textEditor.y + (i + 1) * fs;
            if (strokeWidth > 0) {
              ctx.strokeStyle = hexToRgba(secondaryColor, secondaryOpacity);
              ctx.lineWidth = strokeWidth;
              ctx.strokeText(line, textEditor.x, yPos);
            }
            ctx.fillText(line, textEditor.x, yPos);
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
          const yPos = (i + 1) * fs;
          if (layer.strokeColor && layer.strokeWidth && layer.strokeWidth > 0) {
            ctx.strokeStyle = layer.strokeColor;
            ctx.lineWidth = layer.strokeWidth;
            ctx.strokeText(line, 0, yPos);
          }
          ctx.fillText(line, 0, yPos);
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
          ctx.moveTo(points[0].x, points[0].y);
          points.forEach((p: any) => ctx.lineTo(p.x, p.y));
          ctx.closePath();

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
            thumbCanvas.width = 60;
            thumbCanvas.height = 42;
            const thumbCtx = thumbCanvas.getContext('2d');
            if (thumbCtx) {
              thumbCtx.drawImage(canvas, 0, 0, 60, 42);
              const thumbUrl = thumbCanvas.toDataURL('image/png');
              if (layer.thumbnail !== thumbUrl) {
                updateLayer(layer.id, { thumbnail: thumbUrl });
                lastContentRef.current[layer.id] = contentStr;
              }
            }
          }
        }
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [layers, updateLayer]);

  return (
    <div className="canvas-container" style={{ cursor: activeTool === 'hand' ? 'grab' : 'crosshair' }}>
      <div
        ref={stackRef}
        className="canvas-stack"
        style={{
          transform: `scale(${zoom}) translate(${canvasOffset.x / 2}px, ${canvasOffset.y / 2}px)`,
          width: `${documentSize.w / 2}px`,
          height: `${documentSize.h / 2}px`,
          overflow: 'hidden'
        }}
        onMouseDown={(e) => startAction(e.clientX, e.clientY, e)}
        onDoubleClick={handleDoubleClick}
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
              mixBlendMode: (layer.blendMode || 'source-over') as any,
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
            {activeLayerId === layer.id && (lassoPaths.length > 0 || selectionRect) && (
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
                  <g style={{ filter: 'url(#selectionUnion)' }}>
                    <path
                      d={getSelectionPathData()}
                      fill="#000" stroke="none"
                      fillRule="nonzero" 
                    />
                  </g>
                  <g style={{ filter: 'url(#selectionUnion)' }}>
                    <path
                      d={getSelectionPathData()}
                      fill="#fff" stroke="none"
                      fillRule="nonzero" 
                    />
                  </g>
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

                {/* Anchor Points (Handles) - Matching Photopea style */}
                {!isInverseSelection && lassoPaths.map((path, pIdx) => (
                  <g key={`path-anchors-${pIdx}`}>
                    {path.map((point, iIdx) => (
                      <rect
                        key={`anchor-${pIdx}-${iIdx}`}
                        x={point.x / 2 - 2}
                        y={point.y / 2 - 2}
                        width={4}
                        height={4}
                        fill="#fff"
                        stroke="#000"
                        strokeWidth={0.5}
                      />
                    ))}
                  </g>
                ))}
                
                {/* Perspective Crop Interaction Layer */}
                {activeTool === 'perspective_crop' && lassoPaths.length > 0 && lassoPaths[0].length === 4 && (
                  <g className="perspective-crop-ui">
                    {/* Fill area for moving */}
                    <path
                      d={`M ${lassoPaths[0][0].x/2},${lassoPaths[0][0].y/2} L ${lassoPaths[0][1].x/2},${lassoPaths[0][1].y/2} L ${lassoPaths[0][2].x/2},${lassoPaths[0][2].y/2} L ${lassoPaths[0][3].x/2},${lassoPaths[0][3].y/2} Z`}
                      fill="rgba(0, 170, 255, 0.1)"
                      style={{ pointerEvents: 'auto', cursor: 'move' }}
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

        {draftShape && (
          <div className="selection-marquee" style={{
            left: draftShape.w >= 0 ? draftShape.x / 2 : (draftShape.x + draftShape.w) / 2,
            top: draftShape.h >= 0 ? draftShape.y / 2 : (draftShape.y + draftShape.h) / 2,
            width: Math.abs(draftShape.w) / 2, height: Math.abs(draftShape.h) / 2,
            backgroundColor: activeTool === 'line_shape' ? 'transparent' : brushColor,
            border: activeTool === 'line_shape' ? 'none' : `${strokeWidth / 2}px solid ${secondaryColor}`,
            borderRadius: activeTool === 'ellipse_shape' ? '50%' : '0',
            opacity: primaryOpacity,
            boxSizing: 'border-box',
            pointerEvents: 'none'
          }}>
            {activeTool === 'line_shape' && (
              <svg style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                <line 
                  x1={draftShape.w >= 0 ? 0 : Math.abs(draftShape.w) / 2} 
                  y1={draftShape.h >= 0 ? 0 : Math.abs(draftShape.h) / 2} 
                  x2={draftShape.w >= 0 ? Math.abs(draftShape.w) / 2 : 0} 
                  y2={draftShape.h >= 0 ? Math.abs(draftShape.h) / 2 : 0} 
                  stroke={secondaryColor} 
                  strokeWidth={strokeWidth / 2} 
                />
              </svg>
            )}
          </div>
        )}

        {textEditor && (
          <>
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
                position: 'absolute',
                left: textEditor.x / 2,
                top: (textEditor.y / 2) - 35, // Positioned slightly above the bounding box
                zIndex: 10000,
                display: 'flex',
                gap: '8px',
                pointerEvents: 'auto',
                background: '#333',
                padding: '4px',
                borderRadius: '4px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
              }}
              onMouseDown={(e) => e.stopPropagation()} // Prevent canvas click passthrough
            >
              <button
                onClick={(e) => { e.stopPropagation(); commitText(); }}
                style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#4caf50', color: 'white', border: 'none', borderRadius: '2px', cursor: 'pointer', fontWeight: 'bold' }}
                title="Commit (Enter)"
              >
                ✓
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); cancelText(); }}
                style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f44336', color: 'white', border: 'none', borderRadius: '2px', cursor: 'pointer', fontWeight: 'bold' }}
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
              e.stopPropagation();
              const c = getCoordinates(e.clientX, e.clientY);
              if (c) lastPointRef.current = c;
              setActiveCropHandle('move');
              setIsInteracting(true);
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              const c = getCoordinates(e.touches[0].clientX, e.touches[0].clientY);
              if (c) lastPointRef.current = c;
              setActiveCropHandle('move');
              setIsInteracting(true);
            }}
            style={{
              left: cropRect.w >= 0 ? cropRect.x / 2 : (cropRect.x + cropRect.w) / 2,
              top: cropRect.h >= 0 ? cropRect.y / 2 : (cropRect.y + cropRect.h) / 2,
              width: Math.abs(cropRect.w) / 2, height: Math.abs(cropRect.h) / 2,
              position: 'absolute', border: '2px solid #fff', outline: '2000px solid rgba(0,0,0,0.5)', zIndex: 10000,
              cursor: 'move'
            }}>
            {/* Handles */}
            <div className="crop-handle tl" onMouseDown={(e) => { e.stopPropagation(); const c = getCoordinates(e.clientX, e.clientY); if (c) lastPointRef.current = c; setActiveCropHandle('tl'); setIsInteracting(true); }} onTouchStart={(e) => { e.stopPropagation(); const c = getCoordinates(e.touches[0].clientX, e.touches[0].clientY); if (c) lastPointRef.current = c; setActiveCropHandle('tl'); setIsInteracting(true); }} />
            <div className="crop-handle tr" onMouseDown={(e) => { e.stopPropagation(); const c = getCoordinates(e.clientX, e.clientY); if (c) lastPointRef.current = c; setActiveCropHandle('tr'); setIsInteracting(true); }} onTouchStart={(e) => { e.stopPropagation(); const c = getCoordinates(e.touches[0].clientX, e.touches[0].clientY); if (c) lastPointRef.current = c; setActiveCropHandle('tr'); setIsInteracting(true); }} />
            <div className="crop-handle bl" onMouseDown={(e) => { e.stopPropagation(); const c = getCoordinates(e.clientX, e.clientY); if (c) lastPointRef.current = c; setActiveCropHandle('bl'); setIsInteracting(true); }} onTouchStart={(e) => { e.stopPropagation(); const c = getCoordinates(e.touches[0].clientX, e.touches[0].clientY); if (c) lastPointRef.current = c; setActiveCropHandle('bl'); setIsInteracting(true); }} />
            <div className="crop-handle br" onMouseDown={(e) => { e.stopPropagation(); const c = getCoordinates(e.clientX, e.clientY); if (c) lastPointRef.current = c; setActiveCropHandle('br'); setIsInteracting(true); }} onTouchStart={(e) => { e.stopPropagation(); const c = getCoordinates(e.touches[0].clientX, e.touches[0].clientY); if (c) lastPointRef.current = c; setActiveCropHandle('br'); setIsInteracting(true); }} />
            <div className="crop-handle tm" onMouseDown={(e) => { e.stopPropagation(); const c = getCoordinates(e.clientX, e.clientY); if (c) lastPointRef.current = c; setActiveCropHandle('tm'); setIsInteracting(true); }} onTouchStart={(e) => { e.stopPropagation(); const c = getCoordinates(e.touches[0].clientX, e.touches[0].clientY); if (c) lastPointRef.current = c; setActiveCropHandle('tm'); setIsInteracting(true); }} />
            <div className="crop-handle bm" onMouseDown={(e) => { e.stopPropagation(); const c = getCoordinates(e.clientX, e.clientY); if (c) lastPointRef.current = c; setActiveCropHandle('bm'); setIsInteracting(true); }} onTouchStart={(e) => { e.stopPropagation(); const c = getCoordinates(e.touches[0].clientX, e.touches[0].clientY); if (c) lastPointRef.current = c; setActiveCropHandle('bm'); setIsInteracting(true); }} />
            <div className="crop-handle lm" onMouseDown={(e) => { e.stopPropagation(); const c = getCoordinates(e.clientX, e.clientY); if (c) lastPointRef.current = c; setActiveCropHandle('lm'); setIsInteracting(true); }} onTouchStart={(e) => { e.stopPropagation(); const c = getCoordinates(e.touches[0].clientX, e.touches[0].clientY); if (c) lastPointRef.current = c; setActiveCropHandle('lm'); setIsInteracting(true); }} />
            <div className="crop-handle rm" onMouseDown={(e) => { e.stopPropagation(); const c = getCoordinates(e.clientX, e.clientY); if (c) lastPointRef.current = c; setActiveCropHandle('rm'); setIsInteracting(true); }} onTouchStart={(e) => { e.stopPropagation(); const c = getCoordinates(e.touches[0].clientX, e.touches[0].clientY); if (c) lastPointRef.current = c; setActiveCropHandle('rm'); setIsInteracting(true); }} />

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

        {vectorPaths.length > 0 && (
          <svg className="vector-paths-svg" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1100 }}>
            {vectorPaths.map((path, idx) => (
              <polyline
                key={idx}
                points={path.points.map(p => `${p.x / 2},${p.y / 2}`).join(' ')}
                fill="none"
                stroke={activePathIndex === idx ? "#00aaff" : "#fff"}
                strokeWidth="2"
                strokeDasharray="4 4"
              />
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
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1700 }}>
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
