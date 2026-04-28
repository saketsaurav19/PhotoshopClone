import type { Point } from '../types';

export const getSvgPathData = (points: Point[], closed: boolean, smooth: boolean = false): string => {
  if (points.length < 2) return '';
  if (!smooth) {
    return `M ${points[0].x / 2} ${points[0].y / 2} ` + points.slice(1).map(p => `L ${p.x / 2} ${p.y / 2}`).join(' ') + (closed ? ' Z' : '');
  }

  let d = `M ${points[0].x / 2} ${points[0].y / 2}`;
  if (points.length === 2) {
    return d + ` L ${points[1].x / 2} ${points[1].y / 2}` + (closed ? ' Z' : '');
  }

  for (let i = 0; i < (closed ? points.length : points.length - 1); i++) {
    const p0 = points[(i - 1 + points.length) % points.length];
    const p1 = points[i % points.length];
    const p2 = points[(i + 1) % points.length];
    const p3 = points[(i + 2) % points.length];

    const cp1x = p1.x / 2 + (p2.x / 2 - p0.x / 2) / 6;
    const cp1y = p1.y / 2 + (p2.y / 2 - p0.y / 2) / 6;
    const cp2x = p2.x / 2 - (p3.x / 2 - p1.x / 2) / 6;
    const cp2y = p2.y / 2 - (p3.y / 2 - p1.y / 2) / 6;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x / 2} ${p2.y / 2}`;
  }

  if (closed) d += ' Z';
  return d;
};
