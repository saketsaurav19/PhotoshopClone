import React from 'react';
import type { Point, Rect } from '../types';
import { stopOverlayEvent } from '../utils/eventUtils';

interface CropOverlayProps {
  cropRect: Rect | null;
  getCoordinates: (clientX: number, clientY: number) => Point | null;
  lastPointRef: React.MutableRefObject<Point | null>;
  setActiveCropHandle: (handle: string | null) => void;
  setIsInteracting: (val: boolean) => void;
  applyCrop: () => void;
  setCropRect: (rect: Rect | null) => void;
}

export const CropOverlay: React.FC<CropOverlayProps> = ({
  cropRect,
  getCoordinates,
  lastPointRef,
  setActiveCropHandle,
  setIsInteracting,
  applyCrop,
  setCropRect
}) => {
  if (!cropRect) return null;

  const handleMouseDown = (handle: string) => (e: React.MouseEvent) => {
    stopOverlayEvent(e);
    const c = getCoordinates(e.clientX, e.clientY);
    if (c) lastPointRef.current = c;
    setActiveCropHandle(handle);
    setIsInteracting(true);
  };

  const handleTouchStart = (handle: string) => (e: React.TouchEvent) => {
    stopOverlayEvent(e);
    const c = getCoordinates(e.touches[0].clientX, e.touches[0].clientY);
    if (c) lastPointRef.current = c;
    setActiveCropHandle(handle);
    setIsInteracting(true);
  };

  return (
    <div
      className="crop-marquee"
      onMouseDown={handleMouseDown('move')}
      onTouchStart={handleTouchStart('move')}
      onPointerDown={stopOverlayEvent}
      style={{
        left: cropRect.w >= 0 ? cropRect.x / 2 : (cropRect.x + cropRect.w) / 2,
        top: cropRect.h >= 0 ? cropRect.y / 2 : (cropRect.y + cropRect.h) / 2,
        width: Math.abs(cropRect.w) / 2,
        height: Math.abs(cropRect.h) / 2,
        position: 'absolute',
        border: '2px solid #fff',
        outline: '2000px solid rgba(0,0,0,0.5)',
        zIndex: 10000,
        cursor: 'move'
      }}
    >
      {['tl', 'tr', 'bl', 'br', 'tm', 'bm', 'lm', 'rm'].map(handle => (
        <div
          key={handle}
          className={`crop-handle ${handle}`}
          onMouseDown={handleMouseDown(handle)}
          onTouchStart={handleTouchStart(handle)}
          onPointerDown={stopOverlayEvent}
        />
      ))}

      <div className="crop-actions-bar bottom" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
        <button
          className="crop-action-btn confirm"
          onClick={(e) => { e.stopPropagation(); applyCrop(); }}
          title="Apply Crop"
        >
          ✓
        </button>
        <button
          className="crop-action-btn cancel"
          onClick={(e) => { e.stopPropagation(); setCropRect(null); }}
          title="Cancel Crop"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
