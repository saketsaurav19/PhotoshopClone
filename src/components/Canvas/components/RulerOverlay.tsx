import React from 'react';
import type { Point } from '../types';

interface RulerOverlayProps {
  rulerData: { start: Point, end: Point } | null;
  slices: any[];
  colorSamplers: any[];
}

export const RulerOverlay: React.FC<RulerOverlayProps> = ({
  rulerData,
  slices,
  colorSamplers
}) => {
  return (
    <>
      {/* Slices Overlay */}
      {slices && slices.length > 0 && (
        <div className="slices-overlay" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1500 }}>
          {slices.map((slice, i) => {
            const isSelected = (window as any)._sliceLastClickedIdx === i;
            return (
              <div
                key={slice.id}
                className="slice-rect"
                style={{
                  position: 'absolute',
                  left: slice.rect.x / 2,
                  top: slice.rect.y / 2,
                  width: slice.rect.w / 2,
                  height: slice.rect.h / 2,
                  border: isSelected ? '2px solid #0055ff' : '1px solid #00aaff',
                  backgroundColor: isSelected ? 'rgba(0, 85, 255, 0.25)' : 'rgba(0, 170, 255, 0.1)'
                }}
              >
                <span style={{
                  position: 'absolute',
                  top: 0, left: 0,
                  background: isSelected ? '#0055ff' : '#00aaff',
                  color: 'white',
                  fontSize: '8px',
                  padding: '1px 3px',
                  lineHeight: '1',
                  pointerEvents: 'none'
                }}>
                  {slice.id}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Color Samplers */}
      {colorSamplers && colorSamplers.length > 0 && (
        <div className="samplers-overlay" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1600 }}>
          {colorSamplers.map((s) => (
            <div
              key={s.id}
              style={{
                position: 'absolute',
                left: s.x / 2,
                top: s.y / 2,
                width: '1px', height: '1px',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <div style={{ position: 'absolute', width: '12px', height: '12px', border: '1px solid white', borderRadius: '50%', boxShadow: '0 0 0 1px black' }} />
              <div style={{ position: 'absolute', width: '8px', height: '1px', background: 'white', transform: 'rotate(0deg)' }} />
              <div style={{ position: 'absolute', width: '1px', height: '8px', background: 'white' }} />
              <span style={{ position: 'absolute', left: '8px', top: '8px', background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: '10px', padding: '1px 3px', borderRadius: '2px' }}>
                {s.id}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Ruler Data */}
      {rulerData && (
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1700 }} onPointerDown={(e) => e.stopPropagation()}>
          <line
            x1={rulerData.start.x / 2} y1={rulerData.start.y / 2}
            x2={rulerData.end.x / 2} y2={rulerData.end.y / 2}
            stroke="white" strokeWidth="1" strokeDasharray="4 2"
          />
          <circle cx={rulerData.start.x / 2} cy={rulerData.start.y / 2} r="3" fill="white" stroke="black" />
          <circle cx={rulerData.end.x / 2} cy={rulerData.end.y / 2} r="3" fill="white" stroke="black" />
        </svg>
      )}
    </>
  );
};
