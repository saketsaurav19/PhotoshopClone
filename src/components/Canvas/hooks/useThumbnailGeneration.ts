import { useEffect, useRef } from 'react';
import type { Layer } from '../../../store/useStore';
import type { CanvasRefs } from '../types';

export const useThumbnailGeneration = (
  layers: Layer[],
  documentSize: { w: number, h: number },
  canvasRefs: CanvasRefs,
  updateLayer: (id: string, updates: Partial<Layer>) => void
) => {
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
  }, [layers, updateLayer, documentSize]);
};
