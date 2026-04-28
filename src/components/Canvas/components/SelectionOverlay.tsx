import React from 'react';
import type { Point, Rect } from '../types';

interface SelectionOverlayProps {
  selectionRect: Rect | null;
  lassoPaths: Point[][];
  isInverseSelection: boolean;
  documentSize: { w: number, h: number };
  activeLayerPosition: { x: number, y: number };
  getSelectionPathData: () => string;
}

export const SelectionOverlay: React.FC<SelectionOverlayProps> = ({
  selectionRect,
  lassoPaths,
  isInverseSelection,
  documentSize,
  activeLayerPosition,
  getSelectionPathData
}) => {
  if (!selectionRect && lassoPaths.length === 0) return null;

  return (
    <svg
      className="lasso-svg"
      style={{
        position: 'absolute',
        top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        zIndex: 1000,
        transform: `translate(${-activeLayerPosition.x / 2}px, ${-activeLayerPosition.y / 2}px)`
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
        <path
          d={getSelectionPathData()}
          fill="none"
          stroke="#fff"
          strokeWidth="1"
          strokeLinejoin="round"
        />
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
    </svg>
  );
};
