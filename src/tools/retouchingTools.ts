import type { ToolModule } from './types';

export const retouchingTools: ToolModule[] = [
  {
    id: 'blur',
    start: ({ setIsInteracting }) => setIsInteracting(true),
    move: ({ coords, ctx, canvas, brushSize, toolStrength, toolHardness }) => {
      if (!ctx || !canvas) return;
      const x = Math.round(coords.x);
      const y = Math.round(coords.y);
      const radius = Math.round(brushSize / 2);

      ctx.save();

      // Handle Hardness using a radial gradient clip or globalAlpha
      // For performance and look, we create a temporary "dab"
      const blurPx = Math.max(1, (toolStrength / 10));
      ctx.filter = `blur(${blurPx}px)`;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.clip();

      // If hardness < 100, we use globalAlpha to soften the edge
      if (toolHardness < 100) {
        ctx.globalAlpha = toolHardness / 100;
      }

      ctx.drawImage(canvas, x - radius, y - radius, brushSize, brushSize, x - radius, y - radius, brushSize, brushSize);
      ctx.restore();
    }
  },
  {
    id: 'sharpen',
    start: ({ setIsInteracting }) => setIsInteracting(true),
    move: ({ coords, ctx, canvas, brushSize, toolStrength }) => {
      if (!ctx || !canvas) return;
      const x = Math.round(coords.x);
      const y = Math.round(coords.y);
      const radius = Math.round(brushSize / 2);

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.clip();

      const intensity = toolStrength / 100;
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = intensity * 0.5;
      ctx.filter = `contrast(${1 + intensity}) brightness(${1 + (intensity * 0.2)})`;
      ctx.drawImage(canvas, x - radius, y - radius, brushSize, brushSize, x - radius, y - radius, brushSize, brushSize);
      ctx.restore();
    }
  },
  {
    id: 'smudge',
    start: ({ coords, ctx, canvas, brushSize, setIsInteracting }) => {
      if (!ctx || !canvas) return;
      setIsInteracting(true);
      // Capture the initial area under the brush to "push" it
      const radius = Math.round(brushSize / 2);
      const buffer = document.createElement('canvas');
      buffer.width = brushSize;
      buffer.height = brushSize;
      const bCtx = buffer.getContext('2d');
      if (bCtx) {
        bCtx.drawImage(canvas, coords.x - radius, coords.y - radius, brushSize, brushSize, 0, 0, brushSize, brushSize);
        (window as any)._smudgeBuffer = buffer;
      }
    },
    move: ({ coords, ctx, lastPoint, brushSize }) => {
      const buffer = (window as any)._smudgeBuffer;
      if (!buffer || !ctx || !lastPoint) return;

      const x = coords.x;
      const y = coords.y;
      const radius = brushSize / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.clip();

      // Draw the "pushed" pixels
      ctx.globalAlpha = 0.5;
      ctx.drawImage(buffer, x - radius, y - radius);
      ctx.restore();

      // Update the buffer for the next move to keep the smudge going
      const bCtx = buffer.getContext('2d');
      if (bCtx && (window as any).canvas) {
        // This is tricky without access to the full canvas every move
        // For now, we use the existing buffer to simulate the push
      }
    },
    end: () => {
      delete (window as any)._smudgeBuffer;
    }
  }
];
