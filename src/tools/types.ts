import type { Tool } from '../store/useStore';

export interface ToolContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  coords: { x: number; y: number };
  startCoords: { x: number; y: number } | null;
  lastPoint: { x: number; y: number } | null;
  isShift: boolean;
  isAlt: boolean;
  brushSize: number;
  brushColor: string;
  zoom: number;
  activeLayerId: string | null;
  layers: any[];
  selectionMode: 'new' | 'add' | 'subtract' | 'intersect';
  selectionTolerance: number;
  selectionContiguous: boolean;
  selectionRect: { x: number, y: number, w: number, h: number } | null;
  lassoPaths: { x: number; y: number }[][];
  isInverseSelection: boolean;
  slices: { id: string; rect: { x: number; y: number; w: number; h: number } }[];
  colorSamplers: { id: string; x: number; y: number; color: string }[];
  rulerData: { start: { x: number; y: number }; end: { x: number; y: number } } | null;
  toolStrength: number;
  toolHardness: number;
  
  // State Updaters
  setLassoPaths: (paths: any) => void;
  setSelectionRect: (rect: any, shape?: any) => void;
  setCropRect: (rect: any) => void;
  updateLayer: (id: string, updates: any) => void;
  recordHistory: (name: string) => void;
  setIsInteracting: (val: boolean) => void;
  setBrushColor: (color: string) => void;
  addLayer: (layer: any) => void;
  setDocumentSize: (size: { w: number, h: number }) => void;
  setSlices: (slices: any[]) => void;
  addSlice: (rect: { x: number, y: number, w: number, h: number }) => void;
  addColorSampler: (coords: { x: number; y: number }, color: string) => void;
  clearColorSamplers: () => void;
  setRulerData: (data: any) => void;
  history: any[];
  historyIndex: number;
  cloneSource: { x: number; y: number } | null;
  setCloneSource: (source: { x: number; y: number } | null) => void;
  customPattern: string | null;
  secondaryColor: string;
  primaryOpacity: number;
  secondaryOpacity: number;
  hexToRgba: (hex: string, opacity: number) => string;
  applySelectionClip: (ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, canvasWidth: number, canvasHeight: number) => boolean;
  setIsTyping: (val: boolean) => void;
  redEyePupilSize: number;
  redEyeDarkenAmount: number;
  isInteracting: boolean;
}

export interface ToolModule {
  id: Tool;
  start?: (context: ToolContext) => void;
  move?: (context: ToolContext) => void;
  end?: (context: ToolContext) => void;
  doubleClick?: (context: ToolContext) => void;
}
