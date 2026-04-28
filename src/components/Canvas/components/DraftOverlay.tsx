import React from 'react';
import type { Point, Rect } from '../types';
import { useStore } from '../../../store/useStore';

interface DraftOverlayProps {
  draftShape: Rect | null;
  draftLasso: Point[] | null;
  gradientStart: Point | null;
  currentMousePos: Point | null;
  activeTool: string;
  brushColor: string;
  secondaryColor: string;
  strokeWidth: number;
  primaryOpacity: number;
}

export const DraftOverlay: React.FC<DraftOverlayProps> = ({
  draftShape,
  draftLasso,
  gradientStart,
  currentMousePos,
  activeTool,
  brushColor,
  secondaryColor,
  strokeWidth,
  primaryOpacity
}) => {
  if (!draftShape && !draftLasso && !gradientStart) return null;

  return (
    <div className="draft-overlay-container" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10000 }}>
      {draftShape && (
        <div
          style={{
            position: 'absolute',
            left: draftShape.w >= 0 ? draftShape.x / 2 : (draftShape.x + draftShape.w) / 2,
            top: draftShape.h >= 0 ? draftShape.y / 2 : (draftShape.y + draftShape.h) / 2,
            width: Math.abs(draftShape.w) / 2,
            height: Math.abs(draftShape.h) / 2,
            pointerEvents: 'none',
            zIndex: 10000,
            boxSizing: 'border-box',
            opacity: primaryOpacity,
          }}
        >
          {activeTool === 'shape' && (
            <div style={{
              width: '100%', height: '100%',
              backgroundColor: brushColor,
              border: `${strokeWidth / 2}px solid ${secondaryColor}`,
              borderRadius: `${useStore.getState().cornerRadius / 2}px`,
              boxSizing: 'border-box'
            }} />
          )}
          {activeTool === 'ellipse_shape' && (
            <div style={{
              width: '100%', height: '100%',
              backgroundColor: brushColor,
              border: `${strokeWidth / 2}px solid ${secondaryColor}`,
              borderRadius: '50%',
              boxSizing: 'border-box'
            }} />
          )}
          {['line_shape', 'triangle_shape', 'polygon_shape', 'custom_shape'].includes(activeTool as string) && (
            <svg style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              {activeTool === 'line_shape' && (() => {
                const x1 = draftShape.w >= 0 ? 0 : Math.abs(draftShape.w) / 2;
                const y1 = draftShape.h >= 0 ? 0 : Math.abs(draftShape.h) / 2;
                const x2 = draftShape.w >= 0 ? Math.abs(draftShape.w) / 2 : 0;
                const y2 = draftShape.h >= 0 ? Math.abs(draftShape.h) / 2 : 0;
                return (
                  <>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={brushColor} strokeWidth={strokeWidth / 2} />
                    <circle cx={x1} cy={y1} r={3} fill="#fff" stroke="#00aaff" strokeWidth={1} />
                    <circle cx={x2} cy={y2} r={3} fill="#fff" stroke="#00aaff" strokeWidth={1} />
                  </>
                );
              })()}
              {activeTool === 'triangle_shape' && (() => {
                const w = Math.abs(draftShape.w) / 2;
                const h = Math.abs(draftShape.h) / 2;
                const points = [{ x: w / 2, y: 0 }, { x: 0, y: h }, { x: w, y: h }];
                return (
                  <>
                    <polygon points={points.map(p => `${p.x},${p.y}`).join(' ')} fill={brushColor} stroke={secondaryColor} strokeWidth={strokeWidth / 2} opacity={primaryOpacity} />
                    {points.map((p, i) => (<circle key={i} cx={p.x} cy={p.y} r={3} fill="#fff" stroke="#00aaff" strokeWidth={1} />))}
                  </>
                );
              })()}
              {activeTool === 'polygon_shape' && (() => {
                const sides = useStore.getState().polygonSides;
                const w = Math.abs(draftShape.w) / 2;
                const h = Math.abs(draftShape.h) / 2;
                const cx = w / 2, cy = h / 2, rx = w / 2, ry = h / 2;
                const points = [];
                for (let i = 0; i < sides; i++) {
                  const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
                  points.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
                }
                return (
                  <>
                    <polygon points={points.map(p => `${p.x},${p.y}`).join(' ')} fill={brushColor} stroke={secondaryColor} strokeWidth={strokeWidth / 2} />
                    {points.map((p, i) => (<circle key={i} cx={p.x} cy={p.y} r={3} fill="#fff" stroke="#00aaff" strokeWidth={1} />))}
                  </>
                );
              })()}
            </svg>
          )}
        </div>
      )}

      {/* SVG-based Drafts */}
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        {draftLasso && draftLasso.length > 0 && currentMousePos && (
          <g>
            <path
              d={`M ${draftLasso[0].x / 2},${draftLasso[0].y / 2} ${draftLasso.slice(1).map(p => `L ${p.x / 2},${p.y / 2}`).join(' ')} L ${currentMousePos.x / 2},${currentMousePos.y / 2} Z`}
              fill="rgba(0, 120, 215, 0.1)" stroke="#fff" strokeWidth="1.5"
            />
            <path
              d={`M ${draftLasso[0].x / 2},${draftLasso[0].y / 2} ${draftLasso.slice(1).map(p => `L ${p.x / 2},${p.y / 2}`).join(' ')} L ${currentMousePos.x / 2},${currentMousePos.y / 2} Z`}
              fill="none" stroke="#000" strokeWidth="1.5" strokeDasharray="4 4"
            />
          </g>
        )}
        {gradientStart && currentMousePos && (
          <g>
            <line x1={gradientStart.x / 2} y1={gradientStart.y / 2} x2={currentMousePos.x / 2} y2={currentMousePos.y / 2} stroke="#fff" strokeWidth="1.5" />
            <line x1={gradientStart.x / 2} y1={gradientStart.y / 2} x2={currentMousePos.x / 2} y2={currentMousePos.y / 2} stroke="#000" strokeWidth="1.5" strokeDasharray="4 4" />
            <circle cx={gradientStart.x / 2} cy={gradientStart.y / 2} r="4" fill="#fff" stroke="#000" />
            <circle cx={currentMousePos.x / 2} cy={currentMousePos.y / 2} r="4" fill="#fff" stroke="#000" />
          </g>
        )}
      </svg>
    </div>
  );
};
