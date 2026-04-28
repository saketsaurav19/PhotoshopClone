import type { Layer } from '../../store/useStore';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CanvasRefs {
  current: { [key: string]: HTMLCanvasElement | null };
}

export interface CanvasContext {
  canvas: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
  coords: Point;
  startCoords: Point | null;
  lastPoint: Point | null;
  isShift: boolean;
  isAlt: boolean;
  isCtrl: boolean;
  activeTool: string;
  brushSize: number;
  brushColor: string;
  zoom: number;
  toolStrength: number;
  toolHardness: number;
  strokeWidth: number;
  activeLayerId: string | null;
  layers: Layer[];
  selectionMode: any;
  selectionTolerance: number;
  selectionContiguous: boolean;
  selectionRect: Rect | null;
  lassoPaths: Point[][];
  vectorPaths: any[];
  activePathIndex: number | null;
  cropRect: Rect | null;
  isInverseSelection: boolean;
  setLassoPaths: (paths: Point[][]) => void;
  setSelectionRect: (rect: any, shape?: any) => void;
  setCropRect: (rect: Rect | null) => void;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  recordHistory: (label: string) => void;
  setIsInteracting: (val: boolean) => void;
  setBrushColor: (color: string) => void;
  addLayer: (layer: any) => void;
  setDocumentSize: (size: { w: number, h: number }) => void;
  canvasOffset: Point;
  slices: any[];
  setSlices: (slices: any[]) => void;
  addSlice: (rect: Rect) => void;
  colorSamplers: any[];
  addColorSampler: (coords: Point, color: string) => void;
  clearColorSamplers: () => void;
  rulerData: any;
  setRulerData: (data: any) => void;
  history: any[];
  historyIndex: number;
  cloneSource: Point | null;
  setCloneSource: (point: Point | null) => void;
  customPattern: string | null;
  secondaryColor: string;
  primaryOpacity: number;
  secondaryOpacity: number;
  hexToRgba: (hex: string, alpha: number) => string;
  applySelectionClip: (ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, width: number, height: number) => boolean;
  setIsTyping: (val: boolean) => void;
  redEyePupilSize: number;
  redEyeDarkenAmount: number;
  isInteracting: boolean;
}
