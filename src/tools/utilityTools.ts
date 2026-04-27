import type { ToolModule } from './types';

export const utilityTools: ToolModule[] = [
  {
    id: 'eyedropper',
    start: ({ coords, ctx, layers, activeLayerId, setBrushColor }) => {
      if (!ctx) return;
      const layer = layers.find(l => l.id === activeLayerId);
      const lx = Math.round(coords.x - (layer?.position.x || 0));
      const ly = Math.round(coords.y - (layer?.position.y || 0));
      try {
        const data = ctx.getImageData(lx, ly, 1, 1).data;
        const hex = `#${((1 << 24) + (data[0] << 16) + (data[1] << 8) + data[2]).toString(16).slice(1)}`;
        setBrushColor(hex);
      } catch (e) {
        console.warn('Eyedropper out of bounds');
      }
    }
  },
  {
    id: 'paint_bucket',
    start: ({ coords, canvas, ctx, layers, activeLayerId, brushColor, selectionTolerance, updateLayer, recordHistory }) => {
      if (!ctx || !canvas) return;
      const layer = layers.find(l => l.id === activeLayerId);
      const lx = Math.round(coords.x - (layer?.position.x || 0));
      const ly = Math.round(coords.y - (layer?.position.y || 0));
      if (lx < 0 || ly < 0 || lx >= canvas.width || ly >= canvas.height) return;

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const targetIdx = (ly * canvas.width + lx) * 4;
      const targetR = data[targetIdx], targetG = data[targetIdx+1], targetB = data[targetIdx+2], targetA = data[targetIdx+3];
      
      const fillMatch = brushColor.match(/[A-Za-z0-9]{2}/g);
      if (!fillMatch) return;
      const [fR, fG, fB] = fillMatch.map(h => parseInt(h, 16));
      if (targetR === fR && targetG === fG && targetB === fB) return;

      const tolerance = selectionTolerance || 30;
      const stack: [number, number][] = [[lx, ly]];
      const visited = new Uint8Array(canvas.width * canvas.height);
      
      while (stack.length > 0) {
        const [cx, cy] = stack.pop()!;
        const idx = (cy * canvas.width + cx) * 4;
        if (visited[cy * canvas.width + cx]) continue;
        
        const r = data[idx], g = data[idx+1], b = data[idx+2], a = data[idx+3];
        if (Math.abs(r-targetR)<=tolerance && Math.abs(g-targetG)<=tolerance && Math.abs(b-targetB)<=tolerance && Math.abs(a-targetA)<=tolerance) {
          data[idx] = fR; data[idx+1] = fG; data[idx+2] = fB; data[idx+3] = 255;
          visited[cy * canvas.width + cx] = 1;
          if (cx > 0) stack.push([cx - 1, cy]);
          if (cx < canvas.width - 1) stack.push([cx + 1, cy]);
          if (cy > 0) stack.push([cx, cy - 1]);
          if (cy < canvas.height - 1) stack.push([cx, cy + 1]);
        }
      }
      ctx.putImageData(imgData, 0, 0);
      updateLayer(activeLayerId!, { dataUrl: canvas.toDataURL() });
      recordHistory('Paint Bucket');
    }
  },
  {
    id: 'color_sampler',
    start: ({ coords, ctx, layers, activeLayerId, addColorSampler, recordHistory }) => {
      if (!ctx) return;
      const layer = layers.find(l => l.id === activeLayerId);
      const lx = Math.round(coords.x - (layer?.position.x || 0));
      const ly = Math.round(coords.y - (layer?.position.y || 0));
      try {
        const data = ctx.getImageData(lx, ly, 1, 1).data;
        const hex = `#${((1 << 24) + (data[0] << 16) + (data[1] << 8) + data[2]).toString(16).slice(1)}`;
        addColorSampler(coords, hex);
        recordHistory('Add Color Sampler');
      } catch (e) {
        console.warn('Sampler out of bounds');
      }
    }
  },
  {
    id: 'ruler',
    start: ({ coords, setRulerData, setIsInteracting }) => {
      setRulerData({ start: coords, end: coords });
      setIsInteracting(true);
    },
    move: ({ coords, rulerData, setRulerData }) => {
      if (rulerData) {
        setRulerData({ ...rulerData, end: coords });
      }
    },
    end: ({ setIsInteracting }) => {
      setIsInteracting(false);
    }
  }
];
