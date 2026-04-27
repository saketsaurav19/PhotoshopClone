import type { ToolModule } from './types';
import { useStore } from '../store/useStore';

export const paintingTools: ToolModule[] = [
  {
    id: 'brush',
    start: ({ coords, ctx, brushSize, brushColor, setIsInteracting }) => {
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      setIsInteracting(true);
    },
    move: ({ coords, ctx, lastPoint, brushSize, brushColor }) => {
      if (!lastPoint) return;
      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(coords.x, coords.y);
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.stroke();
    }
  },
  {
    id: 'pencil',
    start: ({ coords, ctx, brushSize, brushColor, setIsInteracting }) => {
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'butt'; // Pencil has sharp edges
      ctx.lineJoin = 'miter';
      setIsInteracting(true);
    },
    move: ({ coords, ctx, lastPoint, brushSize, brushColor }) => {
      if (!lastPoint) return;
      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(coords.x, coords.y);
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.stroke();
    }
  },
  {
    id: 'mixer_brush',
    start: ({ coords, ctx, brushSize, brushColor, setIsInteracting }) => {
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      setIsInteracting(true);
    },
    move: ({ coords, ctx, lastPoint, brushSize, brushColor }) => {
      if (!lastPoint || !ctx) return;

      // Basic Mixer Brush: Sample the color from the current position and blend it
      try {
        const sampleX = Math.round(coords.x);
        const sampleY = Math.round(coords.y);
        const pixel = ctx.getImageData(sampleX, sampleY, 1, 1).data;

        if (pixel[3] > 0) {
          // Blend sampled color with brush color
          const r = Math.round((pixel[0] + parseInt(brushColor.slice(1, 3), 16)) / 2);
          const g = Math.round((pixel[1] + parseInt(brushColor.slice(3, 5), 16)) / 2);
          const b = Math.round((pixel[2] + parseInt(brushColor.slice(5, 7), 16)) / 2);
          const mixedColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

          ctx.beginPath();
          ctx.moveTo(lastPoint.x, lastPoint.y);
          ctx.lineTo(coords.x, coords.y);
          ctx.strokeStyle = mixedColor;
          ctx.lineWidth = brushSize;
          ctx.stroke();
        } else {
          // Fallback to brush color if transparent
          ctx.beginPath();
          ctx.moveTo(lastPoint.x, lastPoint.y);
          ctx.lineTo(coords.x, coords.y);
          ctx.strokeStyle = brushColor;
          ctx.lineWidth = brushSize;
          ctx.stroke();
        }
      } catch (e) {
        // Fallback
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.strokeStyle = brushColor;
        ctx.lineWidth = brushSize;
        ctx.stroke();
      }
    }
  },
  {
    id: 'color_replacement',
    start: ({ coords, ctx, brushSize, brushColor, setIsInteracting }) => {
      ctx.save();
      ctx.globalCompositeOperation = 'color';
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      setIsInteracting(true);
    },
    move: ({ coords, ctx, lastPoint, brushSize, brushColor }) => {
      if (!lastPoint || !ctx) return;
      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(coords.x, coords.y);
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.stroke();
    },
    end: ({ ctx }) => {
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    }
  },
  {
    id: 'eraser',
    start: ({ coords, ctx, brushSize, setIsInteracting }) => {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      setIsInteracting(true);
    },
    move: ({ coords, ctx, lastPoint, brushSize }) => {
      if (!lastPoint) return;
      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(coords.x, coords.y);
      ctx.lineWidth = brushSize;
      ctx.stroke();
    },
    end: ({ ctx }) => {
      ctx.globalCompositeOperation = 'source-over';
    }
  },
  {
    id: 'background_eraser',
    start: ({ coords, ctx, canvas, setIsInteracting }) => {
      if (!ctx || !canvas) return;
      setIsInteracting(true);
      // Sample the target color to erase
      const data = ctx.getImageData(Math.round(coords.x), Math.round(coords.y), 1, 1).data;
      (window as any)._bgEraserTarget = { r: data[0], g: data[1], b: data[2], a: data[3] };
    },
    move: ({ coords, ctx, canvas, brushSize, selectionTolerance }) => {
      const target = (window as any)._bgEraserTarget;
      if (!ctx || !canvas || !target) return;
      
      const radius = brushSize / 2;
      const x = Math.round(coords.x);
      const y = Math.round(coords.y);
      const tolerance = selectionTolerance || 30;

      // We need to selectively erase pixels in the brush area that match the target color
      const area = ctx.getImageData(x - radius, y - radius, brushSize, brushSize);
      const data = area.data;
      
      for (let i = 0; i < data.length; i += 4) {
        const dist = Math.abs(data[i] - target.r) + Math.abs(data[i+1] - target.g) + Math.abs(data[i+2] - target.b);
        if (dist < tolerance) {
          data[i + 3] = 0; // Erase
        }
      }
      ctx.putImageData(area, x - radius, y - radius);
    },
    end: () => {
      delete (window as any)._bgEraserTarget;
    }
  },
  {
    id: 'magic_eraser',
    start: ({ coords, setIsInteracting }) => {
      (window as any)._magicEraserStart = { ...coords };
      setIsInteracting(true);
    },
    move: ({ coords }) => {
      const start = (window as any)._magicEraserStart;
      if (start) {
        // Draw a preview rectangle using a global helper or custom logic
        // For simplicity, we can dispatch a custom event to show it on Canvas
        window.dispatchEvent(new CustomEvent('draw-draft-rect', { 
          detail: { 
            x: Math.min(start.x, coords.x), 
            y: Math.min(start.y, coords.y), 
            w: Math.abs(coords.x - start.x), 
            h: Math.abs(coords.y - start.y) 
          } 
        }));
      }
    },
    end: ({ coords, canvas, ctx, activeLayerId, selectionTolerance, updateLayer, recordHistory, setIsInteracting }) => {
      const start = (window as any)._magicEraserStart;
      if (!ctx || !canvas || !activeLayerId || !start) {
        setIsInteracting(false);
        return;
      }

      const dist = Math.hypot(coords.x - start.x, coords.y - start.y);
      
      if (dist < 5) {
        // Mode 1: Standard Magic Eraser (Flood Fill)
        const x = Math.round(start.x);
        const y = Math.round(start.y);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const targetIdx = (y * canvas.width + x) * 4;
        const tR = data[targetIdx], tG = data[targetIdx+1], tB = data[targetIdx+2], tA = data[targetIdx+3];
        
        const tolerance = selectionTolerance || 30;
        const stack: [number, number][] = [[x, y]];
        const visited = new Uint8Array(canvas.width * canvas.height);
        
        while (stack.length > 0) {
          const [cx, cy] = stack.pop()!;
          const idx = (cy * canvas.width + cx) * 4;
          if (visited[cy * canvas.width + cx]) continue;
          
          const r = data[idx], g = data[idx+1], b = data[idx+2], a = data[idx+3];
          const colorDist = Math.abs(r-tR) + Math.abs(g-tG) + Math.abs(b-tB) + Math.abs(a-tA);
          
          if (colorDist <= tolerance) {
            data[idx+3] = 0; // Erase
            visited[cy * canvas.width + cx] = 1;
            if (cx > 0) stack.push([cx - 1, cy]);
            if (cx < canvas.width - 1) stack.push([cx + 1, cy]);
            if (cy > 0) stack.push([cx, cy - 1]);
            if (cy < canvas.height - 1) stack.push([cx, cy + 1]);
          }
        }
        ctx.putImageData(imgData, 0, 0);
        recordHistory('Magic Eraser');
      } else {
        // Mode 2: Targeted Area Magic Erase
        const rx = Math.round(Math.min(start.x, coords.x));
        const ry = Math.round(Math.min(start.y, coords.y));
        const rw = Math.round(Math.abs(coords.x - start.x));
        const rh = Math.round(Math.abs(coords.y - start.y));

        if (rw > 0 && rh > 0) {
          // 1. Sample target color at the START point
          const sampleData = ctx.getImageData(Math.round(start.x), Math.round(start.y), 1, 1).data;
          const tR = sampleData[0], tG = sampleData[1], tB = sampleData[2], tA = sampleData[3];
          const tolerance = (selectionTolerance || 30) * 1.5; // Slightly higher concentration in area mode

          // 2. Get the whole rectangle area
          const imgData = ctx.getImageData(rx, ry, rw, rh);
          const data = imgData.data;

          // 3. Erase only matching pixels
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
            const colorDist = Math.abs(r-tR) + Math.abs(g-tG) + Math.abs(b-tB) + Math.abs(a-tA);
            
            if (colorDist <= tolerance) {
              data[i+3] = 0; // Erase matching pixel
            }
          }
          ctx.putImageData(imgData, rx, ry);
          recordHistory('Magic Eraser (Targeted Area)');
        }
      }

      updateLayer(activeLayerId, { dataUrl: canvas.toDataURL() });
      setIsInteracting(false);
      window.dispatchEvent(new CustomEvent('clear-draft-rect'));
      delete (window as any)._magicEraserStart;
    }
  },
  {
    id: 'history_brush',
    start: ({ canvas, ctx, setIsInteracting, history, activeLayerId }) => {
      if (!canvas || !ctx || !history || history.length === 0) return;

      // Find the first history state where this layer had actual image data
      let sourceLayer = null;
      for (let i = 0; i < history.length; i++) {
        const l = history[i].state.layers.find((l: any) => l.id === activeLayerId);
        if (l && l.dataUrl) {
          sourceLayer = l;
          break;
        }
      }

      // Fallback: if no history state has dataUrl yet, use the state before the current one
      if (!sourceLayer && history.length > 1) {
        const prevIdx = Math.max(0, history.length - 2);
        sourceLayer = history[prevIdx].state.layers.find((l: any) => l.id === activeLayerId);
      }

      const setupSnapshot = (source: HTMLCanvasElement | HTMLImageElement | null) => {
        const snapshot = document.createElement('canvas');
        snapshot.width = canvas.width;
        snapshot.height = canvas.height;
        const sCtx = snapshot.getContext('2d');
        if (sCtx && source) {
          sCtx.drawImage(source, 0, 0);
        }
        (window as any)._historySnapshot = snapshot;
        (window as any)._historyOpacity = useStore.getState().primaryOpacity;
        setIsInteracting(true);
      };

      if (sourceLayer && sourceLayer.dataUrl) {
        const img = new Image();
        img.onload = () => setupSnapshot(img);
        img.src = sourceLayer.dataUrl;
      } else {
        setupSnapshot(null);
      }
    },
    move: ({ coords, lastPoint, ctx, brushSize }) => {
      const snapshot = (window as any)._historySnapshot;
      if (!snapshot || !ctx || !lastPoint) return;
      
      const dist = Math.hypot(coords.x - lastPoint.x, coords.y - lastPoint.y);
      const steps = Math.max(1, Math.ceil(dist / (brushSize / 4)));

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = lastPoint.x + (coords.x - lastPoint.x) * t;
        const y = lastPoint.y + (coords.y - lastPoint.y) * t;

        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.clearRect(x - brushSize / 2, y - brushSize / 2, brushSize, brushSize);

        const prevAlpha = ctx.globalAlpha;
        ctx.globalAlpha = (window as any)._historyOpacity || 1.0;
        ctx.drawImage(snapshot, 0, 0);
        ctx.globalAlpha = prevAlpha;
        ctx.restore();
      }
    },
    end: () => {
      delete (window as any)._historySnapshot;
    }
  },
  {
    id: 'art_history_brush',
    start: ({ canvas, ctx, setIsInteracting, history, activeLayerId }) => {
      if (!canvas || !ctx || !history || history.length === 0) return;

      let sourceLayer = null;
      for (let i = 0; i < history.length; i++) {
        const l = history[i].state.layers.find((l: any) => l.id === activeLayerId);
        if (l && l.dataUrl) {
          sourceLayer = l;
          break;
        }
      }

      if (!sourceLayer && history.length > 1) {
        const prevIdx = Math.max(0, history.length - 2);
        sourceLayer = history[prevIdx].state.layers.find((l: any) => l.id === activeLayerId);
      }

      const setupSnapshot = (source: HTMLCanvasElement | HTMLImageElement | null) => {
        const snapshot = document.createElement('canvas');
        snapshot.width = canvas.width;
        snapshot.height = canvas.height;
        const sCtx = snapshot.getContext('2d');
        if (sCtx && source) {
          sCtx.drawImage(source, 0, 0);
        }
        (window as any)._artHistorySnapshot = snapshot;
        (window as any)._artHistoryOpacity = useStore.getState().primaryOpacity;
        setIsInteracting(true);
      };

      if (sourceLayer && sourceLayer.dataUrl) {
        const img = new Image();
        img.onload = () => setupSnapshot(img);
        img.src = sourceLayer.dataUrl;
      } else {
        setupSnapshot(null);
      }
    },
    move: ({ coords, lastPoint, ctx, brushSize }) => {
      const snapshot = (window as any)._artHistorySnapshot;
      if (!snapshot || !ctx || !lastPoint) return;

      const sCtx = snapshot.getContext('2d');
      if (!sCtx) return;

      const dist = Math.hypot(coords.x - lastPoint.x, coords.y - lastPoint.y);
      const steps = Math.max(1, Math.ceil(dist / (brushSize / 2))); // Fewer steps for performance since it dabs 6 times

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const interpX = lastPoint.x + (coords.x - lastPoint.x) * t;
        const interpY = lastPoint.y + (coords.y - lastPoint.y) * t;

        for (let i = 0; i < 6; i++) {
          const offsetX = (Math.random() - 0.5) * brushSize * 2.5;
          const offsetY = (Math.random() - 0.5) * brushSize * 2.5;
          const x = interpX + offsetX;
          const y = interpY + offsetY;

          const pixel = sCtx.getImageData(
            Math.max(0, Math.min(snapshot.width - 1, Math.round(x))),
            Math.max(0, Math.min(snapshot.height - 1, Math.round(y))),
            1, 1
          ).data;

          if (pixel[3] > 0) {
            const opacity = (pixel[3] / 255) * ((window as any)._artHistoryOpacity || 1.0);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(Math.random() * Math.PI);

            // 1. Base Painterly Dab
            ctx.fillStyle = `rgba(${pixel[0]}, ${pixel[1]}, ${pixel[2]}, ${opacity * 0.7})`;
            const rx = (brushSize / 2) * (0.2 + Math.random() * 0.4);
            const ry = (brushSize / 2) * (0.1 + Math.random() * 0.2);
            ctx.beginPath();
            ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
            ctx.fill();

            // 2. Crystal "Sprinkle"
            if (Math.random() > 0.4) {
              ctx.fillStyle = `rgba(${pixel[0]}, ${pixel[1]}, ${pixel[2]}, ${opacity})`;
              const sw = Math.max(1, brushSize * 0.05);
              const sl = brushSize * (0.2 + Math.random() * 0.3);
              ctx.fillRect(-sl / 2, -sw / 2, sl, sw);
            }

            // 3. Tiny Sparkle
            if (Math.random() > 0.7) {
              ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.9})`;
              ctx.beginPath();
              ctx.arc(Math.random() * rx, Math.random() * ry, 1, 0, Math.PI * 2);
              ctx.fill();
            }

            ctx.restore();
          }
        }
      }
    },
    end: () => {
      delete (window as any)._artHistorySnapshot;
    }
  },
  {
    id: 'clone',
    start: ({ isAlt, coords, setCloneSource, setIsInteracting, canvas }) => {
      if (isAlt) {
        setCloneSource(coords);
      } else if (canvas) {
        setIsInteracting(true);
        // Take a snapshot for stable cloning (prevents feedback loops)
        const snapshot = document.createElement('canvas');
        snapshot.width = canvas.width;
        snapshot.height = canvas.height;
        const sCtx = snapshot.getContext('2d');
        if (sCtx) {
          sCtx.drawImage(canvas, 0, 0);
          (window as any)._cloneSnapshot = snapshot;
        }
      }
    },
    move: ({ coords, lastPoint, ctx, brushSize, cloneSource }) => {
      const snapshot = (window as any)._cloneSnapshot;
      if (!ctx || !snapshot || !cloneSource || !lastPoint) return;
      
      const offset = (window as any)._cloneOffset || { 
        x: cloneSource.x - lastPoint.x, 
        y: cloneSource.y - lastPoint.y 
      };
      (window as any)._cloneOffset = offset;

      const dist = Math.hypot(coords.x - lastPoint.x, coords.y - lastPoint.y);
      const steps = Math.max(1, Math.ceil(dist / (brushSize / 8))); // 8 steps for extra smoothness

      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const x = lastPoint.x + (coords.x - lastPoint.x) * t;
        const y = lastPoint.y + (coords.y - lastPoint.y) * t;
        
        const sx = x + offset.x;
        const sy = y + offset.y;

        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(snapshot, sx - brushSize / 2, sy - brushSize / 2, brushSize, brushSize, x - brushSize / 2, y - brushSize / 2, brushSize, brushSize);
        ctx.restore();
      }
    },
    end: () => {
      delete (window as any)._cloneOffset;
      delete (window as any)._cloneSnapshot;
    }
  },
  {
    id: 'pattern_stamp',
    start: ({ setIsInteracting, ctx, customPattern, brushColor, secondaryColor }) => {
      if (customPattern) {
        const img = new Image();
        img.src = customPattern;
        img.onload = () => {
          (window as any)._currentPattern = ctx.createPattern(img, 'repeat');
        };
      } else {
        const pCanvas = document.createElement('canvas');
        pCanvas.width = 20;
        pCanvas.height = 20;
        const pCtx = pCanvas.getContext('2d');
        if (pCtx) {
          pCtx.fillStyle = brushColor;
          pCtx.fillRect(0, 0, 10, 10);
          pCtx.fillRect(10, 10, 10, 10);
          pCtx.fillStyle = secondaryColor;
          pCtx.fillRect(10, 0, 10, 10);
          pCtx.fillRect(0, 10, 10, 10);
          (window as any)._currentPattern = ctx.createPattern(pCanvas, 'repeat');
        }
      }
      setIsInteracting(true);
    },
    move: ({ coords, lastPoint, ctx, brushSize }) => {
      if (!ctx || !lastPoint) return;
      
      const pattern = (window as any)._currentPattern;
      if (!pattern) return;

      ctx.save();
      const opacity = (window as any)._primaryOpacity || 1.0;
      ctx.globalAlpha = opacity;
      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(coords.x, coords.y);
      ctx.lineCap = 'round';
      ctx.lineWidth = brushSize;
      ctx.strokeStyle = pattern;
      ctx.stroke();
      ctx.restore();
    }
  },
  {
    id: 'rectangle_eraser',
    start: ({ coords, setIsInteracting }) => {
      (window as any)._rectEraserStart = { ...coords };
      setIsInteracting(true);
    },
    move: ({ coords }) => {
      const start = (window as any)._rectEraserStart;
      if (start) {
        window.dispatchEvent(new CustomEvent('draw-draft-rect', { 
          detail: { 
            x: Math.min(start.x, coords.x), 
            y: Math.min(start.y, coords.y), 
            w: Math.abs(coords.x - start.x), 
            h: Math.abs(coords.y - start.y) 
          } 
        }));
      }
    },
    end: ({ coords, canvas, ctx, activeLayerId, updateLayer, recordHistory, setIsInteracting }) => {
      const start = (window as any)._rectEraserStart;
      if (start && ctx && canvas && activeLayerId) {
        const x = Math.min(start.x, coords.x);
        const y = Math.min(start.y, coords.y);
        const w = Math.abs(coords.x - start.x);
        const h = Math.abs(coords.y - start.y);
        if (w > 0 && h > 0) {
          ctx.clearRect(x, y, w, h);
          updateLayer(activeLayerId, { dataUrl: canvas.toDataURL() });
          recordHistory('Rectangle Erase');
        }
      }
      setIsInteracting(false);
      window.dispatchEvent(new CustomEvent('clear-draft-rect'));
      delete (window as any)._rectEraserStart;
    }
  },
  {
    id: 'lasso_eraser',
    start: ({ coords, setIsInteracting }) => {
      (window as any)._lassoEraserPath = [{ ...coords }];
      setIsInteracting(true);
    },
    move: ({ coords }) => {
      const path = (window as any)._lassoEraserPath;
      if (path) {
        path.push({ ...coords });
        window.dispatchEvent(new CustomEvent('draw-draft-lasso', { detail: path }));
      }
    },
    end: ({ canvas, ctx, activeLayerId, updateLayer, recordHistory, setIsInteracting }) => {
      const path = (window as any)._lassoEraserPath;
      if (path && path.length > 2 && ctx && canvas && activeLayerId) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        path.forEach((p: any) => ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.clip();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        
        updateLayer(activeLayerId, { dataUrl: canvas.toDataURL() });
        recordHistory('Lasso Erase');
      }
      setIsInteracting(false);
      window.dispatchEvent(new CustomEvent('clear-draft-lasso'));
      delete (window as any)._lassoEraserPath;
    }
  }
];
