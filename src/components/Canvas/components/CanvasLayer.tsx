import React from 'react';
import type { Layer } from '../../../store/useStore';

/**
 * Props for the CanvasLayer component.
 */
interface CanvasLayerProps {
  layer: Layer; // The layer data object from the store
  documentSize: { w: number, h: number }; // Dimensions of the Photoshop document
  canvasRef: (el: HTMLCanvasElement | null) => void; // Callback to register this canvas in the parent's ref object
  layersCount: number; // Total number of layers (used for z-index calculation)
  layerIndex: number; // Current layer's index in the stack
}

/**
 * Renders an individual layer as a canvas element wrapped in a div for positioning and blending.
 */
export const CanvasLayer: React.FC<CanvasLayerProps> = ({
  layer,
  documentSize,
  canvasRef,
  layersCount,
  layerIndex
}) => {
  return (
    <div
      className={`layer-wrapper ${layer.visible ? 'visible' : 'hidden'}`}
      style={{
        position: 'absolute',
        top: 0, left: 0,
        width: '100%', height: '100%',
        zIndex: layersCount - layerIndex,
        pointerEvents: 'none',
        mixBlendMode: (layer.blendMode === 'source-over' ? 'normal' : (layer.blendMode || 'normal')) as any,
        opacity: layer.opacity,
        transform: `translate(${layer.position.x / 2}px, ${layer.position.y / 2}px)`
      }}
    >
      <canvas
        ref={canvasRef}
        data-layer-id={layer.id}
        width={documentSize.w}
        height={documentSize.h}
        className="layer-canvas"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};
