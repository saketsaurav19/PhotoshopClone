import React from 'react';
import type { Point } from '../types';
import { stopOverlayEvent } from '../utils/eventUtils';

interface PerspectiveCropOverlayProps {
  lassoPaths: Point[][];
  getCoordinates: (x: number, y: number) => Point | null;
  setIsInteracting: (val: boolean) => void;
  lastPointRef: React.MutableRefObject<Point | null>;
  handleDoubleClick: () => void;
  setLassoPaths: (paths: Point[][]) => void;
}

export const PerspectiveCropOverlay: React.FC<PerspectiveCropOverlayProps> = ({
  lassoPaths,
  getCoordinates,
  setIsInteracting,
  lastPointRef,
  handleDoubleClick,
  setLassoPaths
}) => {
  if (lassoPaths.length === 0 || lassoPaths[0].length !== 4) return null;

  const p = lassoPaths[0];

  const handleMouseDown = (e: React.MouseEvent) => {
    stopOverlayEvent(e);
    const c = getCoordinates(e.clientX, e.clientY);
    if (!c) return;
    (window as any)._pcDragIdx = 8;
    (window as any)._pcStartPoint = { ...c };
    (window as any)._pcOrigPoints = p.map(point => ({ ...point }));
    setIsInteracting(true);
    lastPointRef.current = c;
  };

  return (
    <>
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10000 }}>
        <path
          d={`M ${p[0].x / 2},${p[0].y / 2} L ${p[1].x / 2},${p[1].y / 2} L ${p[2].x / 2},${p[2].y / 2} L ${p[3].x / 2},${p[3].y / 2} Z`}
          fill="rgba(0, 170, 255, 0.1)"
          style={{ pointerEvents: 'auto', cursor: 'move' }}
          onMouseDown={handleMouseDown}
        />
        {/* Corner Handles */}
        {p.map((point, i) => (
          <rect key={i} x={point.x / 2 - 4} y={point.y / 2 - 4} width={8} height={8} fill="#fff" stroke="#00aaff" strokeWidth={1} style={{ cursor: i % 2 === 0 ? 'nwse-resize' : 'nesw-resize', pointerEvents: 'auto' }} />
        ))}
      </svg>

      <div
        className="perspective-actions-bar"
        style={{
          position: 'absolute',
          left: Math.min(...p.map(point => point.x)) / 2,
          top: Math.max(...p.map(point => point.y)) / 2 + 15,
          zIndex: 20000,
          display: 'flex', gap: '10px', background: '#222', padding: '8px', borderRadius: '6px', border: '1px solid #444'
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button onClick={handleDoubleClick} style={{ background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', padding: '8px' }}>✓</button>
        <button onClick={() => { delete (window as any)._pcPoints; setLassoPaths([]); setIsInteracting(false); }} style={{ background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', padding: '8px' }}>✕</button>
      </div>
    </>
  );
};
