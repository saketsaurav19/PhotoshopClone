import type { ToolModule } from './types';

export const healingTools: ToolModule[] = [
  {
    id: 'healing',
    start: ({ coords, ctx, canvas, brushSize, activeLayerId, updateLayer, recordHistory }) => {
      if (!ctx || !canvas || !activeLayerId) return;
      const size = brushSize;
      const x = coords.x;
      const y = coords.y;

      // Draw from an offset area (simple spot healing)
      const offsetX = size * 1.5;
      const offsetY = size * 0.8;

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.clip();

      // Draw with soft edges using shadow or blur
      ctx.filter = 'blur(4px)';
      ctx.drawImage(canvas, x + offsetX, y + offsetY, size, size, x - size / 2, y - size / 2, size, size);
      ctx.restore();

      updateLayer(activeLayerId, { dataUrl: canvas.toDataURL() });
      recordHistory('Spot Healing');
    }
  },
  {
    id: 'healing_brush',
    start: ({ coords, isAlt, setIsInteracting }) => {
      if (isAlt) {
        (window as any)._healingSource = { ...coords };
      } else if ((window as any)._healingSource) {
        (window as any)._healingCurrentSource = { ...(window as any)._healingSource };
        setIsInteracting(true);
      }
    },
    move: ({ coords, ctx, canvas, lastPoint, brushSize, activeLayerId }) => {
      if (!(window as any)._healingCurrentSource || !ctx || !canvas || !activeLayerId || !lastPoint) return;

      const dx = coords.x - lastPoint.x;
      const dy = coords.y - lastPoint.y;

      (window as any)._healingCurrentSource.x += dx;
      (window as any)._healingCurrentSource.y += dy;

      const currentSource = (window as any)._healingCurrentSource;

      ctx.save();
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, brushSize / 2, 0, Math.PI * 2);
      ctx.clip();

      ctx.filter = 'contrast(1.1) brightness(1.05)'; // Slight enhancement to blend texture
      ctx.drawImage(canvas, currentSource.x - brushSize / 2, currentSource.y - brushSize / 2, brushSize, brushSize, coords.x - brushSize / 2, coords.y - brushSize / 2, brushSize, brushSize);
      ctx.restore();
    },
    end: ({ setIsInteracting }) => {
      setIsInteracting(false);
    }
  },
  {
    id: 'patch',
    start: ({ coords, lassoPaths, setIsInteracting }) => {
      if (lassoPaths.length > 0) {
        (window as any)._patchStartCoords = { ...coords };
        (window as any)._patchOffset = { x: 0, y: 0 };
        setIsInteracting(true);
      }
    },
    move: ({ coords }) => {
      const start = (window as any)._patchStartCoords;
      if (start) {
        (window as any)._patchOffset = { x: coords.x - start.x, y: coords.y - start.y };
      }
    },
    end: ({ ctx, canvas, lassoPaths, activeLayerId, layers, setIsInteracting }) => {
      try {
        const start = (window as any)._patchStartCoords;
        const offset = (window as any)._patchOffset;

        if (start && offset && lassoPaths.length > 0 && ctx && canvas && activeLayerId) {
          const layer = layers.find(l => l.id === activeLayerId);
          const lpx = layer?.position.x || 0;
          const lpy = layer?.position.y || 0;

          // Create a buffer canvas to avoid sampling from the canvas we are drawing on
          const buffer = document.createElement('canvas');
          buffer.width = canvas.width;
          buffer.height = canvas.height;
          const bCtx = buffer.getContext('2d');
          if (bCtx) {
            bCtx.drawImage(canvas, 0, 0);

            ctx.save();
            ctx.beginPath();
            lassoPaths.forEach(path => {
              if (path.length < 2) return;
              ctx.moveTo(path[0].x - lpx, path[0].y - lpy);
              path.forEach(p => ctx.lineTo(p.x - lpx, p.y - lpy));
              ctx.closePath();
            });

            // Feather the selection slightly for smoother blending
            ctx.shadowColor = 'rgba(0,0,0,1)';
            ctx.shadowBlur = 2;
            ctx.clip();

            // Draw the offset texture
            ctx.filter = 'contrast(1.05) brightness(1.02)'; // Subtle enhancement
            ctx.drawImage(buffer, -offset.x, -offset.y);
            ctx.restore();
          }
        }
      } catch (e) {
        console.error('Patch tool failed:', e);
      } finally {
        setIsInteracting(false);
        delete (window as any)._patchStartCoords;
        delete (window as any)._patchOffset;
      }
    }
  },
  {
    id: 'content_aware_move',
    start: ({ coords, lassoPaths, setIsInteracting }) => {
      if (lassoPaths.length > 0) {
        (window as any)._caStartCoords = { ...coords };
        (window as any)._caOffset = { x: 0, y: 0 };
        setIsInteracting(true);
      }
    },
    move: ({ coords }) => {
      const start = (window as any)._caStartCoords;
      if (start) {
        (window as any)._caOffset = { x: coords.x - start.x, y: coords.y - start.y };
      }
    },
    end: ({ ctx, canvas, lassoPaths, activeLayerId, layers, updateLayer, recordHistory, setIsInteracting }) => {
      const start = (window as any)._caStartCoords;
      const offset = (window as any)._caOffset;
      if (start && offset && lassoPaths.length > 0 && ctx && canvas && activeLayerId) {
        const layer = layers.find(l => l.id === activeLayerId);
        const lpx = layer?.position.x || 0;
        const lpy = layer?.position.y || 0;

        // 1. Capture selection
        const buffer = document.createElement('canvas');
        buffer.width = canvas.width;
        buffer.height = canvas.height;
        const bCtx = buffer.getContext('2d');
        if (bCtx) {
          bCtx.drawImage(canvas, 0, 0);

          // 2. Clear original spot (Fill hole)
          ctx.save();
          ctx.beginPath();
          lassoPaths.forEach(path => {
            if (path.length < 2) return;
            ctx.moveTo(path[0].x - lpx, path[0].y - lpy);
            path.forEach(p => ctx.lineTo(p.x - lpx, p.y - lpy));
            ctx.closePath();
          });
          ctx.clip();
          // Simplified "Content Aware" fill: clear and fill with surrounding color
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.filter = 'blur(20px)';
          ctx.drawImage(buffer, 0, 0);
          ctx.restore();

          // 3. Draw at new spot
          ctx.save();
          ctx.beginPath();
          lassoPaths.forEach(path => {
            if (path.length < 2) return;
            ctx.moveTo(path[0].x - lpx + offset.x, path[0].y - lpy + offset.y);
            path.forEach(p => ctx.lineTo(p.x - lpx + offset.x, p.y - lpy + offset.y));
            ctx.closePath();
          });
          ctx.clip();
          // Draw the captured original content at the new position
          ctx.drawImage(buffer, -offset.x, -offset.y);
          ctx.restore();
        }
      }
      setIsInteracting(false);
      updateLayer(activeLayerId!, { dataUrl: canvas?.toDataURL() });
      recordHistory('Content-Aware Move');
      delete (window as any)._caStartCoords;
      delete (window as any)._caOffset;
    }
  },
  {
    id: 'red_eye',
    start: ({ coords, ctx, canvas, brushSize, activeLayerId, layers, updateLayer, recordHistory, redEyePupilSize, redEyeDarkenAmount }) => {
      if (!ctx || !canvas || !activeLayerId) return;
      const layer = layers.find(l => l.id === activeLayerId);
      const lpx = layer?.position.x || 0;
      const lpy = layer?.position.y || 0;

      // Use redEyePupilSize to adjust the effective detection radius
      const radius = Math.max(1, (brushSize || 20) * ((redEyePupilSize || 50) / 50));
      const x = Math.round(coords.x - lpx);
      const y = Math.round(coords.y - lpy);

      const area = ctx.getImageData(
        Math.max(0, Math.floor(x - radius)),
        Math.max(0, Math.floor(y - radius)),
        Math.max(1, Math.min(canvas.width, Math.ceil(radius * 2))),
        Math.max(1, Math.min(canvas.height, Math.ceil(radius * 2)))
      );
      const data = area.data;
      const startX = Math.max(0, Math.floor(x - radius));
      const startY = Math.max(0, Math.floor(y - radius));

      const darkenFact = 1 - ((redEyeDarkenAmount || 50) / 100);

      for (let row = 0; row < area.height; row++) {
        for (let col = 0; col < area.width; col++) {
          const i = (row * area.width + col) * 4;
          const px = startX + col;
          const py = startY + row;

          const dist = Math.hypot(px - x, py - y);
          if (dist > radius) continue;

          const r = data[i], g = data[i + 1], b = data[i + 2];

          if (r > 60 && r > g * 1.25 && r > b * 1.25) {
            // Calculate a base target gray from existing green/blue
            const baseGray = (g + b) / 2;

            // Apply smoothing based on distance to brush edge
            const falloff = Math.pow(1 - (dist / radius), 0.4); // Softer curve

            // The factor determines how much we darken the baseGray
            // Amount 100 = Factor 0 (Total Black at center)
            // Amount 0 = Factor 1 (Pure Gray at center)
            const factor = darkenFact * falloff + (1 - falloff);

            // We use a blend of the base gray and total black
            // High Darken Amount = closer to 0
            const result = baseGray * factor;

            data[i] = result;
            data[i + 1] = result;
            data[i + 2] = result;
          }
        }
      }
      ctx.putImageData(area, startX, startY);
      updateLayer(activeLayerId, { dataUrl: canvas.toDataURL() });
      recordHistory('Red Eye Removal');
    }
  }
];
