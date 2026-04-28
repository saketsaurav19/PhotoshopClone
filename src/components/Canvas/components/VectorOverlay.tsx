import React from 'react';
import type { Point } from '../types';

interface VectorOverlayProps {
  vectorPaths: any[];
  activePathIndex: number | null;
  activeTool: string;
  currentMousePos: Point | null;
  zoom: number;
  getSvgPathData: (points: Point[], closed: boolean, smooth?: boolean) => string;
  selectedPoint: { pathIdx: number, pointIdx: number } | null;
}

export const VectorOverlay: React.FC<VectorOverlayProps> = ({
  vectorPaths,
  activePathIndex,
  activeTool,
  currentMousePos,
  zoom,
  getSvgPathData,
  selectedPoint
}) => {
  if (vectorPaths.length === 0 && !(activeTool === 'pen' && activePathIndex !== null)) return null;

  return (
    <svg className="vector-paths-svg" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1100 }}>
      {vectorPaths.map((path, idx) => (
        <path
          key={idx}
          d={getSvgPathData(path.points, path.closed, path.smooth)}
          fill="none"
          stroke={activePathIndex === idx ? "#00aaff" : "#fff"}
          strokeWidth="2"
          strokeDasharray="4 4"
        />
      ))}
      
      {/* Rubber Band Preview */}
      {['pen', 'curvature_pen', 'free_pen'].includes(activeTool) && activePathIndex !== null && vectorPaths[activePathIndex] && !vectorPaths[activePathIndex].closed && currentMousePos && (
        <>
          <path
            d={getSvgPathData([...vectorPaths[activePathIndex].points, currentMousePos], false, activeTool === 'curvature_pen' || vectorPaths[activePathIndex].smooth)}
            stroke="#00aaff"
            strokeWidth="1.5"
            strokeDasharray="4 2"
            fill="none"
            style={{ opacity: 0.8 }}
          />
          <circle
            cx={currentMousePos.x / 2}
            cy={currentMousePos.y / 2}
            r="4"
            fill="#00aaff"
            opacity="0.3"
          />
          <circle
            cx={currentMousePos.x / 2}
            cy={currentMousePos.y / 2}
            r="2"
            fill="#fff"
            stroke="#00aaff"
            strokeWidth="1"
          />
        </>
      )}

      {/* Hover Preview for start of new path */}
      {activeTool === 'pen' && activePathIndex === null && currentMousePos && (
        <circle
          cx={currentMousePos.x / 2}
          cy={currentMousePos.y / 2}
          r="4"
          fill="none"
          stroke="#00aaff"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
      )}

      {/* Close Path Square Indicator */}
      {['pen', 'curvature_pen'].includes(activeTool) && activePathIndex !== null && vectorPaths[activePathIndex] && !vectorPaths[activePathIndex].closed && currentMousePos && (
        (() => {
          const firstPoint = vectorPaths[activePathIndex].points[0];
          const isNearStart = Math.hypot(currentMousePos.x - firstPoint.x, currentMousePos.y - firstPoint.y) < 10 / (zoom || 1);
          if (isNearStart) {
            return (
              <rect
                x={firstPoint.x / 2 - 4}
                y={firstPoint.y / 2 - 4}
                width="8"
                height="8"
                fill="none"
                stroke="#00aaff"
                strokeWidth="2"
              />
            );
          }
          return null;
        })()
      )}

      {/* Render Anchor Points for all paths when in vector tools */}
      {['pen', 'curvature_pen', 'free_pen', 'add_anchor', 'delete_anchor', 'convert_point', 'path_select', 'direct_select'].includes(activeTool) && vectorPaths.map((path, pIdx) => (
        <g key={`path-points-${pIdx}`}>
          {path.points.map((p: Point, ptIdx: number) => {
            const isSelected = activePathIndex === pIdx && selectedPoint?.pointIdx === ptIdx;
            const dist = currentMousePos ? Math.hypot(p.x - currentMousePos.x, p.y - currentMousePos.y) : Infinity;
            const isHovered = dist < 12 / (zoom || 1);
            const radius = isSelected ? 5 : (isHovered ? 6 : 3);
            return (
              <circle
                key={`${pIdx}-${ptIdx}`}
                cx={p.x / 2}
                cy={p.y / 2}
                r={radius}
                fill={isSelected ? "#00aaff" : "#fff"}
                stroke="#00aaff"
                strokeWidth="1"
                style={{ pointerEvents: 'auto', cursor: 'pointer' }}
              />
            );
          })}
        </g>
      ))}
    </svg>
  );
};
