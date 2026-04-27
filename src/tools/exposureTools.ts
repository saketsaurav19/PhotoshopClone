import type { ToolModule } from './types';

export const exposureTools: ToolModule[] = [
  {
    id: 'dodge',
    start: ({ setIsInteracting }) => setIsInteracting(true),
    move: ({ coords, ctx, canvas, brushSize }) => {
      if (!ctx || !canvas) return;
      const x = Math.round(coords.x);
      const y = Math.round(coords.y);
      const radius = brushSize / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.clip();
      
      // Dodge: Lighten the area
      ctx.globalCompositeOperation = 'color-dodge';
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - radius, y - radius, brushSize, brushSize);
      ctx.restore();
    }
  },
  {
    id: 'burn',
    start: ({ setIsInteracting }) => setIsInteracting(true),
    move: ({ coords, ctx, canvas, brushSize }) => {
      if (!ctx || !canvas) return;
      const x = Math.round(coords.x);
      const y = Math.round(coords.y);
      const radius = brushSize / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.clip();
      
      // Burn: Darken the area
      ctx.globalCompositeOperation = 'color-burn';
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#000';
      ctx.fillRect(x - radius, y - radius, brushSize, brushSize);
      ctx.restore();
    }
  },
  {
    id: 'sponge',
    start: ({ setIsInteracting }) => setIsInteracting(true),
    move: ({ coords, ctx, canvas, brushSize }) => {
      if (!ctx || !canvas) return;
      const x = Math.round(coords.x);
      const y = Math.round(coords.y);
      const radius = brushSize / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.clip();
      
      // Sponge: Saturate or Desaturate
      // We can use the 'saturation' composite mode
      ctx.globalCompositeOperation = 'saturation';
      // In saturation mode, the hue and luminosity are taken from the destination,
      // and the saturation is taken from the source.
      // So filling with a saturated color will saturate, filling with grey will desaturate.
      ctx.fillStyle = '#f00'; // High saturation color
      ctx.globalAlpha = 0.1;
      ctx.fillRect(x - radius, y - radius, brushSize, brushSize);
      ctx.restore();
    }
  }
];
