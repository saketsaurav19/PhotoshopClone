import React from 'react';

export const stopOverlayEvent = (e: React.MouseEvent | React.TouchEvent | React.PointerEvent) => {
  e.preventDefault();
  e.stopPropagation();
  (e.nativeEvent as Event).stopImmediatePropagation?.();
};
