import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useStore, hexToRgba } from '../../store/useStore';
import './Canvas.css';

const Canvas: React.FC = () => {
  const store = useStore();
  const {
    activeTool, brushSize, strokeWidth, brushColor, secondaryColor,
    primaryOpacity, secondaryOpacity,
    zoom, setZoom, layers, activeLayerId,
    updateLayer, addLayer, recordHistory, setActiveLayer, setLayers,
    canvasOffset, setCanvasOffset, setBrushColor,
    lassoPaths, setLassoPaths, selectionRect, setSelectionRect,
    documentSize, setDocumentSize,
    vectorPaths, setVectorPaths, activePathIndex, setActivePathIndex, penMode
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
  const lastPointRef = useRef<{ x: number, y: number } | null>(null);
  const startMouseRef = useRef<{ x: number, y: number } | null>(null);
  const startOffsetRef = useRef<{ x: number, y: number } | null>(null);
  const draftTextCanvasRef = useRef<HTMLCanvasElement>(null);
  const selectionCanvasRef = useRef<HTMLCanvasElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);

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
    setLayers(newLayers);
    setLassoPaths(newLassoPaths);
    setDocumentSize({ w: absW, h: absH });
    setCanvasOffset({ x: 0, y: 0 });
    setCropRect(null);
    recordHistory('Crop');
  }, [cropRect, layers, lassoPaths, setLayers, setLassoPaths, setSelectionRect, setDocumentSize, setCanvasOffset, recordHistory]);

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
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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
      if (lassoPaths.length === 0 && vectorPaths.length === 0) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      ctx.save();
      ctx.scale(0.5, 0.5); // Match the 1000x700 display size

      // 1. Draw Lasso Selections
      if (lassoPaths.length > 0) {
        ctx.beginPath();
        lassoPaths.forEach(path => {
          if (path.length < 3) return;
          ctx.moveTo(path[0].x, path[0].y);
          path.forEach(p => ctx.lineTo(p.x, p.y));
          ctx.closePath();
        });
        ctx.fillStyle = 'rgba(0, 120, 215, 0.15)';
        ctx.fill();

        offset++;
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -offset;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
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
  }, [lassoPaths, vectorPaths, activePathIndex]);

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

      if (selectionRect) {
        ctx.clearRect(selectionRect.x - offsetX, selectionRect.y - offsetY, selectionRect.w, selectionRect.h);
      } else if (lassoPaths.length > 0) {
        ctx.save();
        ctx.beginPath();
        lassoPaths.forEach(path => {
          if (path.length < 3) return;
          ctx.moveTo(path[0].x - offsetX, path[0].y - offsetY);
          path.forEach(p => ctx.lineTo(p.x - offsetX, p.y - offsetY));
          ctx.closePath();
        });
        ctx.clip();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
      updateLayer(activeLayerId, { dataUrl: canvas.toDataURL() });
      recordHistory('Delete Selection');
      setSelectionRect(null);
      setLassoPaths([]);
    }
  }, [selectionRect, lassoPaths, activeLayerId, updateLayer, recordHistory, layers]);

  React.useEffect(() => {
    const onDelete = () => clearSelection();
    window.addEventListener('delete-selection', onDelete);
    return () => window.removeEventListener('delete-selection', onDelete);
  }, [clearSelection]);

  const handleQuickSelect = useCallback((x: number, y: number, shouldAdd: boolean = false) => {
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

    // Tolerance for color matching
    const tolerance = 30;
    const visited = new Uint8Array(canvas.width * canvas.height);
    const queue: [number, number][] = [[lx, ly]];
    visited[ly * canvas.width + lx] = 1;

    // Direction offsets for flood fill
    const dx = [1, -1, 0, 0];
    const dy = [0, 0, 1, -1];

    // Use a stack for O(1) push/pop (Flood Fill)
    let processedCount = 0;
    while (queue.length > 0) {
      const point = queue.pop();
      if (!point) continue;
      const [cx, cy] = point;
      processedCount++;

      for (let i = 0; i < 4; i++) {
        const nx = cx + dx[i];
        const ny = cy + dy[i];

        if (nx >= 0 && nx < canvas.width && ny >= 0 && ny < canvas.height) {
          const nIdx = ny * canvas.width + nx;
          if (!visited[nIdx]) {
            const pIdx = nIdx * 4;
            // Faster color difference check
            if (Math.abs(data[pIdx] - targetR) < tolerance &&
              Math.abs(data[pIdx + 1] - targetG) < tolerance &&
              Math.abs(data[pIdx + 2] - targetB) < tolerance &&
              Math.abs(data[pIdx + 3] - targetA) < tolerance) {
              visited[nIdx] = 1;
              queue.push([nx, ny]);
            }
          }
        }
      }
      if (processedCount > canvas.width * canvas.height) break;
    }

    if (processedCount > 10) {
      // Moore Neighborhood Tracing to find the contour
      const contour: { x: number, y: number }[] = [];
      let startNode: [number, number] | null = null;

      // Optimised: Scan for start node outward from the click point to find it faster
      // (The click point lx, ly is guaranteed to be part of the visited set)
      // We look for the leftmost pixel of this component
      let sx = lx, sy = ly;
      while (sx > 0 && visited[sy * canvas.width + (sx - 1)]) sx--;
      startNode = [sx, sy];

      if (startNode) {
        let [currX, currY] = startNode;
        let [prevX, prevY] = [currX - 1, currY];
        const startX = currX, startY = currY;

        let limit = 10000;
        do {
          contour.push({ x: currX + (layer?.position.x || 0), y: currY + (layer?.position.y || 0) });

          // Neighbors in clockwise order
          const dirs = [
            [currX - 1, currY - 1], [currX, currY - 1], [currX + 1, currY - 1],
            [currX + 1, currY], [currX + 1, currY + 1], [currX, currY + 1],
            [currX - 1, currY + 1], [currX - 1, currY]
          ];

          // Find the direction of the previous node to start searching clockwise
          let startDir = 0;
          for (let i = 0; i < 8; i++) {
            if (dirs[i][0] === prevX && dirs[i][1] === prevY) {
              startDir = (i + 1) % 8;
              break;
            }
          }

          let found = false;
          for (let i = 0; i < 8; i++) {
            const nextIdx = (startDir + i) % 8;
            const [nx, ny] = dirs[nextIdx];
            if (nx >= 0 && nx < canvas.width && ny >= 0 && ny < canvas.height && visited[ny * canvas.width + nx]) {
              prevX = currX; prevY = currY;
              currX = nx; currY = ny;
              found = true;
              break;
            }
          }
          if (!found) break;
          limit--;
        } while ((currX !== startX || currY !== startY) && limit > 0);

        // Simplify path for performance and smoothness
        // Keep points that significantly change direction
        const simplified: { x: number, y: number }[] = [];
        for (let i = 0; i < contour.length; i++) {
          if (i === 0 || i === contour.length - 1) {
            simplified.push(contour[i]);
            continue;
          }
          const prev = contour[i - 1];
          const curr = contour[i];
          const next = contour[i + 1];
          // If moving in the same line, skip
          const isSameDir = (curr.x - prev.x === next.x - curr.x) && (curr.y - prev.y === next.y - curr.y);
          if (!isSameDir || i % 4 === 0) { // Keep some points for curves
            simplified.push(curr);
          }
        }

        if (shouldAdd) {
          setLassoPaths(prev => [...prev, simplified]);
        } else {
          setLassoPaths([simplified]);
        }
        setSelectionRect(null);
        recordHistory('Quick Selection');
      }
    }
  }, [activeLayerId, layers, recordHistory, setLassoPaths, setSelectionRect]);

  // 4. Interaction Engine
  const startAction = useCallback((clientX: number, clientY: number, e: React.MouseEvent | React.TouchEvent) => {
    const coords = getCoordinates(clientX, clientY);
    if (!coords) return;

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

    if (activeTool === 'eyedropper') {
      handleEyedropper(coords.x, coords.y);
      return;
    }

    if (activeTool === 'text') {
      if (textEditor) commitText();
      else setTextEditor({ ...coords, value: '' });
      return;
    }

    if (activeTool === 'select') {
      for (const layer of layers) {
        if (layer.locked) continue;
        if (layer.type === 'text') {
          const ctx = canvasRefs.current[layer.id]?.getContext('2d');
          if (ctx) {
            const fs = layer.fontSize || 40;
            ctx.font = `${fs}px Arial`;
            const lines = (layer.textContent || '').split('\n');
            let maxWidth = 10;
            lines.forEach(line => {
              const w = ctx.measureText(line).width;
              if (w > maxWidth) maxWidth = w;
            });
            const localX = coords.x - layer.position.x;
            const localY = coords.y - layer.position.y;
            if (localX >= -10 && localX <= maxWidth + 10 && localY >= -10 && localY <= lines.length * fs + 10) {
              setActiveLayer(layer.id);
              break;
            }
          }
        } else if (layer.type === 'shape' && layer.shapeData) {
          const localX = coords.x - layer.position.x;
          const localY = coords.y - layer.position.y;
          if (localX >= 0 && localX <= layer.shapeData.w && localY >= 0 && localY <= layer.shapeData.h) {
            setActiveLayer(layer.id);
            break;
          }
        } else {
          const ctx = canvasRefs.current[layer.id]?.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            const localX = coords.x - layer.position.x;
            const localY = coords.y - layer.position.y;
            if (localX >= 0 && localY >= 0 && localX < 2000 && localY < 1400) {
              if (ctx.getImageData(localX, localY, 1, 1).data[3] > 0) {
                setActiveLayer(layer.id);
                break;
              }
            }
          }
        }
      }
    } else if (activeTool === 'marquee') {
      setSelectionRect({ x: coords.x, y: coords.y, w: 0, h: 0 });
    } else if (activeTool === 'crop') {
      setCropRect({ x: coords.x, y: coords.y, w: 0, h: 0 });
    } else if (activeTool === 'gradient') {
      setGradientStart({ x: coords.x, y: coords.y });
    } else if (activeTool === 'clone' && (e as any).altKey) {
      setCloneSource({ x: coords.x, y: coords.y });
      return;
    } else if (activeTool === 'shape') {
      setDraftShape({ x: coords.x, y: coords.y, w: 0, h: 0 });
    } else if (activeTool === 'lasso') {
      if (e.shiftKey) {
        setLassoPaths(prev => [...prev, [coords]]);
      } else {
        setLassoPaths([[coords]]);
      }
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
      // Simple path selection by finding the closest path
      let closestIdx = -1;
      let minDist = 100;
      vectorPaths.forEach((path, idx) => {
        path.points.forEach(p => {
          const d = Math.hypot(p.x - coords.x, p.y - coords.y);
          if (d < minDist) { minDist = d; closestIdx = idx; }
        });
      });
      setActivePathIndex(closestIdx === -1 ? null : closestIdx);
    } else if (activeTool === 'quick_select') {
      handleQuickSelect(coords.x, coords.y, (e as any).shiftKey);
    }
  }, [getCoordinates, activeTool, textEditor, commitText, layers, setActiveLayer, zoom, setZoom, handleEyedropper, activeLayerId, canvasOffset, handleQuickSelect]);

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
    if (!isInteracting || !lastPointRef.current) return;
    const coords = getCoordinates(clientX, clientY);
    if (!coords) return;
    setCurrentMousePos(coords);

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

    if (activeTool === 'lasso') {
      setLassoPaths(prev => {
        const newPaths = [...prev];
        if (newPaths.length > 0) {
          newPaths[newPaths.length - 1] = [...newPaths[newPaths.length - 1], coords];
        }
        return newPaths;
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
        ctx.clip();
        ctx.drawImage(canvas, sx - brushSize / 2, sy - brushSize / 2, brushSize, brushSize, lx - brushSize / 2, ly - brushSize / 2, brushSize, brushSize);
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

      setCropRect(newRect);
      return;
    }

    if (activeTool === 'brush' || activeTool === 'eraser' || activeTool === 'blur' || activeTool === 'dodge' || activeTool === 'healing') {
      const id = activeLayerId || layers[0]?.id;
      const ctx = canvasRefs.current[id]?.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        ctx.save();

        const layer = layers.find(l => l.id === id);
        const offX = layer?.position.x || 0;
        const offY = layer?.position.y || 0;

        const lx = coords.x - offX;
        const ly = coords.y - offY;

        // Spot Healing specific logic
        if (activeTool === 'healing') {
          // Sample a slightly larger area to get background average
          const sampleSize = brushSize * 1.5;
          const sample = ctx.getImageData(lx - sampleSize / 2, ly - sampleSize / 2, sampleSize, sampleSize);
          const data = sample.data;
          let r = 0, g = 0, b = 0, a = 0, count = 0;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 0) {
              r += data[i]; g += data[i + 1]; b += data[i + 2]; a += data[i + 3];
              count++;
            }
          }
          if (count > 0) {
            ctx.fillStyle = `rgba(${r / count}, ${g / count}, ${b / count}, ${(a / count) / 255})`;
            ctx.beginPath();
            ctx.arc(lx, ly, brushSize / 2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
          lastPointRef.current = coords;
          return;
        }

        // Selection Clipping
        if (selectionRect) {
          ctx.beginPath();
          ctx.rect(selectionRect.x - offX, selectionRect.y - offY, selectionRect.w, selectionRect.h);
          ctx.clip();
        } else if (lassoPaths.length > 0) {
          ctx.beginPath();
          lassoPaths.forEach(path => {
            if (path.length < 3) return;
            ctx.moveTo(path[0].x - offX, path[0].y - offY);
            path.forEach(p => ctx.lineTo(p.x - offX, p.y - offY));
            ctx.closePath();
          });
          ctx.clip('evenodd');
        }

        if (activeTool === 'blur') {
          ctx.beginPath();
          ctx.moveTo(lastPointRef.current.x - offX, lastPointRef.current.y - offY);
          ctx.lineTo(coords.x - offX, coords.y - offY);
          ctx.lineWidth = brushSize;
          ctx.filter = 'blur(4px)';
          ctx.globalCompositeOperation = 'source-over';
          ctx.stroke();
        } else if (activeTool === 'dodge') {
          ctx.globalCompositeOperation = 'color-dodge';
          ctx.beginPath();
          ctx.moveTo(lastPointRef.current.x - offX, lastPointRef.current.y - offY);
          ctx.lineTo(coords.x - offX, coords.y - offY);
          ctx.lineWidth = brushSize;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.stroke();
        } else {
          ctx.globalCompositeOperation = activeTool === 'eraser' ? 'destination-out' : 'source-over';
          ctx.strokeStyle = activeTool === 'eraser' ? 'rgba(0,0,0,1)' : hexToRgba(brushColor, primaryOpacity);
          ctx.lineWidth = brushSize;
          ctx.beginPath();
          ctx.moveTo(lastPointRef.current.x - offX, lastPointRef.current.y - offY);
          ctx.lineTo(coords.x - offX, coords.y - offY);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    else if (activeTool === 'crop') {
      setCropRect(prev => prev ? { ...prev, w: coords.x - prev.x, h: coords.y - prev.y } : null);
      return;
    }
    if (activeTool === 'marquee') {
      setSelectionRect(prev => prev ? { ...prev, w: coords.x - prev.x, h: coords.y - prev.y } : null);
      return;
    }
    if (activeTool === 'shape') {
      setDraftShape(prev => prev ? { ...prev, w: coords.x - prev.x, h: coords.y - prev.y } : null);
      return;
    }
    if (activeTool === 'gradient') {
      // Logic for preview could go here if needed
      return;
    }

    if (activeTool === 'move' && activeLayerId) {
      const activeLayer = layers.find(l => l.id === activeLayerId);
      if (activeLayer && !activeLayer.locked) {
        const dx = coords.x - lastPointRef.current.x;
        const dy = coords.y - lastPointRef.current.y;
        updateLayer(activeLayerId, { position: { x: activeLayer.position.x + dx, y: activeLayer.position.y + dy } });
      }
    } else if (activeTool === 'clone') {
      // End of clone stroke
    }
    lastPointRef.current = coords;
  }, [getCoordinates, isInteracting, activeTool, activeLayerId, layers, brushSize, strokeWidth, hexToRgba, secondaryColor, secondaryOpacity, brushColor, primaryOpacity, updateLayer, canvasOffset, setCanvasOffset, cloneSource, selectionRect, lassoPaths, activeCropHandle, cropRect]);

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
    if (activeTool === 'brush' || activeTool === 'eraser' || activeTool === 'blur' || activeTool === 'dodge' || activeTool === 'healing') {
      const id = activeLayerId || layers[0]?.id;
      const canvas = canvasRefs.current[id];
      if (canvas) {
        updateLayer(id, { dataUrl: canvas.toDataURL() });
        recordHistory(activeTool.charAt(0).toUpperCase() + activeTool.slice(1));
      }
    }
    else if (activeTool === 'lasso') {
      // Finalize lasso logic
    }

    if (activeTool === 'shape' && draftShape) {
      const w = Math.abs(draftShape.w);
      const h = Math.abs(draftShape.h);
      if (w > 2 && h > 2) {
        addLayer({
          name: 'Rectangle',
          type: 'shape',
          position: {
            x: draftShape.w >= 0 ? draftShape.x : draftShape.x + draftShape.w,
            y: draftShape.h >= 0 ? draftShape.y : draftShape.y + draftShape.h
          },
          shapeData: {
            type: 'rect',
            w, h,
            fill: hexToRgba(brushColor, primaryOpacity),
            stroke: hexToRgba(secondaryColor, secondaryOpacity),
            strokeWidth: strokeWidth
          }
        });
        recordHistory('Add Rectangle');
      }
      setDraftShape(null);
    }

    if (activeTool === 'gradient' && gradientStart && currentMousePos) {
      applyGradient(gradientStart, currentMousePos);
      setGradientStart(null);
    }

    setIsInteracting(false);
    lastPointRef.current = null;
  }, [isInteracting, activeTool, activeLayerId, layers, updateLayer, draftShape, addLayer, hexToRgba, brushColor, primaryOpacity, secondaryColor, secondaryOpacity, strokeWidth, recordHistory, currentMousePos, gradientStart, applyGradient]);

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
            {activeLayerId === layer.id && lassoPaths.length > 0 && (
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
                  {/* Clip to layer content if we wanted, but for now just document relative */}
                </defs>

                {/* The Selection Mask (Dimming the UNSELECTED area) */}
                <path
                  d={`M 0,0 L 0,${documentSize.h / 2} L ${documentSize.w / 2},${documentSize.h / 2} L ${documentSize.w / 2},0 Z ` +
                    lassoPaths.map(path => `M ${path.map(p => `${p.x / 2},${p.y / 2}`).join(' L ')} Z`).join(' ')}
                  fill="rgba(0, 0, 0, 0.4)"
                  fillRule="nonzero" // Use nonzero with CCW boundary and CW paths for proper union
                  style={{ pointerEvents: 'none' }}
                />

                {/* The marching ants outline */}
                <g className="marquee-dash">
                  <g style={{ filter: 'url(#selectionUnion)' }}>
                    <path
                      d={lassoPaths.map(path => `M ${path.map(p => `${p.x / 2},${p.y / 2}`).join(' L ')} Z`).join(' ')}
                      fill="#000" stroke="none"
                      fillRule="nonzero" // Use nonzero to union overlapping paths
                    />
                  </g>
                  <g style={{ filter: 'url(#selectionUnion)' }}>
                    <path
                      d={lassoPaths.map(path => `M ${path.map(p => `${p.x / 2},${p.y / 2}`).join(' L ')} Z`).join(' ')}
                      fill="#fff" stroke="none"
                      fillRule="nonzero" // Use nonzero to union overlapping paths
                    />
                  </g>
                </g>
              </svg>
            )}
          </div>
        ))}

        {draftShape && (
          <div className="selection-marquee" style={{
            left: draftShape.w >= 0 ? draftShape.x / 2 : (draftShape.x + draftShape.w) / 2,
            top: draftShape.h >= 0 ? draftShape.y / 2 : (draftShape.y + draftShape.h) / 2,
            width: Math.abs(draftShape.w) / 2, height: Math.abs(draftShape.h) / 2,
            backgroundColor: brushColor,
            border: `${strokeWidth / 2}px solid ${secondaryColor}`,
            opacity: primaryOpacity,
            boxSizing: 'border-box'
          }} />
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

        {currentMousePos && (activeTool === 'brush' || activeTool === 'eraser') && (
          <div className="brush-cursor" style={{ left: currentMousePos.x / 2, top: currentMousePos.y / 2, width: brushSize / 2, height: brushSize / 2 }} />
        )}

        {selectionRect && (
          <div className="selection-marquee" style={{
            left: selectionRect.w >= 0 ? selectionRect.x / 2 : (selectionRect.x + selectionRect.w) / 2,
            top: selectionRect.h >= 0 ? selectionRect.y / 2 : (selectionRect.y + selectionRect.h) / 2,
            width: Math.abs(selectionRect.w) / 2, height: Math.abs(selectionRect.h) / 2
          }} />
        )}

        {cropRect && (
          <div className="crop-marquee" style={{
            left: cropRect.w >= 0 ? cropRect.x / 2 : (cropRect.x + cropRect.w) / 2,
            top: cropRect.h >= 0 ? cropRect.y / 2 : (cropRect.y + cropRect.h) / 2,
            width: Math.abs(cropRect.w) / 2, height: Math.abs(cropRect.h) / 2,
            position: 'absolute', border: '2px solid #fff', outline: '2000px solid rgba(0,0,0,0.5)', zIndex: 10000
          }}>
            {/* Handles */}
            <div className="crop-handle tl" onMouseDown={(e) => { e.stopPropagation(); setActiveCropHandle('tl'); setIsInteracting(true); }} onTouchStart={(e) => { e.stopPropagation(); setActiveCropHandle('tl'); setIsInteracting(true); }} />
            <div className="crop-handle tr" onMouseDown={(e) => { e.stopPropagation(); setActiveCropHandle('tr'); setIsInteracting(true); }} onTouchStart={(e) => { e.stopPropagation(); setActiveCropHandle('tr'); setIsInteracting(true); }} />
            <div className="crop-handle bl" onMouseDown={(e) => { e.stopPropagation(); setActiveCropHandle('bl'); setIsInteracting(true); }} onTouchStart={(e) => { e.stopPropagation(); setActiveCropHandle('bl'); setIsInteracting(true); }} />
            <div className="crop-handle br" onMouseDown={(e) => { e.stopPropagation(); setActiveCropHandle('br'); setIsInteracting(true); }} onTouchStart={(e) => { e.stopPropagation(); setActiveCropHandle('br'); setIsInteracting(true); }} />
            <div className="crop-handle tm" onMouseDown={(e) => { e.stopPropagation(); setActiveCropHandle('tm'); setIsInteracting(true); }} onTouchStart={(e) => { e.stopPropagation(); setActiveCropHandle('tm'); setIsInteracting(true); }} />
            <div className="crop-handle bm" onMouseDown={(e) => { e.stopPropagation(); setActiveCropHandle('bm'); setIsInteracting(true); }} onTouchStart={(e) => { e.stopPropagation(); setActiveCropHandle('bm'); setIsInteracting(true); }} />
            <div className="crop-handle lm" onMouseDown={(e) => { e.stopPropagation(); setActiveCropHandle('lm'); setIsInteracting(true); }} onTouchStart={(e) => { e.stopPropagation(); setActiveCropHandle('lm'); setIsInteracting(true); }} />
            <div className="crop-handle rm" onMouseDown={(e) => { e.stopPropagation(); setActiveCropHandle('rm'); setIsInteracting(true); }} onTouchStart={(e) => { e.stopPropagation(); setActiveCropHandle('rm'); setIsInteracting(true); }} />

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
      </div>
    </div>
  );
};

export default Canvas;
