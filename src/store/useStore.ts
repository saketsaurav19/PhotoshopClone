import { create } from 'zustand';
import { nanoid } from 'nanoid';

export const hexToRgba = (hex: string, opacity: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export type Tool = 'select' | 'move' | 'brush' | 'eraser' | 'text' | 'shape' | 'marquee' | 'lasso' | 'quick_select' | 'crop' | 'eyedropper' | 'healing' | 'clone' | 'gradient' | 'blur' | 'dodge' | 'pen' | 'path_select' | 'hand' | 'zoom_tool';

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  dataUrl?: string; // For image layers
  type: 'image' | 'paint' | 'text' | 'shape';
  position: { x: number; y: number };
  blendMode: GlobalCompositeOperation;
  textContent?: string;
  fontSize?: number;
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;
  shapeData?: { 
    type: 'rect' | 'path';
    w?: number; h?: number; 
    points?: { x: number; y: number }[];
    fill: string; stroke: string; strokeWidth: number 
  };
  thumbnail?: string;
}

interface HistoryEntry {
  name: string;
  state: {
    layers: Layer[];
    activeLayerId: string | null;
    lassoPaths: { x: number; y: number }[][];
    selectionRect: { x: number; y: number; w: number; h: number } | null;
    documentSize: { w: number; h: number };
  };
}

interface EditorState {
  activeTool: Tool;
  zoom: number;
  layers: Layer[];
  activeLayerId: string | null;
  brushSize: number;
  strokeWidth: number;
  brushColor: string;
  secondaryColor: string;
  primaryOpacity: number;
  secondaryOpacity: number;
  canvasOffset: { x: number; y: number };
  lassoPaths: { x: number; y: number }[][] ;
  selectionRect: { x: number; y: number; w: number; h: number } | null;
  cropRect: { x: number; y: number; w: number; h: number } | null;
  documentSize: { w: number; h: number };
  history: HistoryEntry[];
  historyIndex: number;
  
  vectorPaths: { points: { x: number; y: number }[]; closed: boolean }[];
  activePathIndex: number | null;
  penMode: 'path' | 'shape';
  
  // Actions
  setActiveTool: (tool: Tool) => void;
  setZoom: (zoom: number) => void;
  setCanvasOffset: (offset: { x: number; y: number }) => void;
  setLassoPaths: (paths: { x: number; y: number }[][] | ((prev: { x: number; y: number }[][]) => { x: number; y: number }[][])) => void;
  setVectorPaths: (paths: { points: { x: number; y: number }[]; closed: boolean }[] | ((prev: { points: { x: number; y: number }[]; closed: boolean }[]) => { points: { x: number; y: number }[]; closed: boolean }[])) => void;
  setActivePathIndex: (index: number | null) => void;
  setPenMode: (mode: 'path' | 'shape') => void;
  setSelectionRect: (rect: { x: number; y: number; w: number; h: number } | null | ((prev: { x: number; y: number; w: number; h: number } | null) => { x: number; y: number; w: number; h: number } | null)) => void;
  setCropRect: (rect: { x: number; y: number; w: number; h: number } | null | ((prev: { x: number; y: number; w: number; h: number } | null) => { x: number; y: number; w: number; h: number } | null)) => void;
  inverseSelection: () => void;
  addLayer: (layer: Partial<Layer>) => void;
  removeLayer: (id: string) => void;
  setActiveLayer: (id: string) => void;
  toggleLayerVisibility: (id: string) => void;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  duplicateLayer: (id: string) => void;
  setBrushSize: (size: number) => void;
  setStrokeWidth: (width: number) => void;
  setBrushColor: (color: string) => void;
  setSecondaryColor: (color: string) => void;
  setPrimaryOpacity: (opacity: number) => void;
  setSecondaryOpacity: (opacity: number) => void;
  setLayers: (layers: Layer[]) => void;
  setDocumentSize: (size: { w: number; h: number }) => void;
  undo: () => void;
  redo: () => void;
  moveLayer: (id: string, direction: 'up' | 'down') => void;
  reorderLayers: (startIndex: number, endIndex: number) => void;
  recordHistory: (actionName: string) => void;
}

// Initial state for the layers - now empty by default
const initialLayers: Layer[] = [];

export const useStore = create<EditorState>((set) => ({
  activeTool: 'select',
  zoom: 1,
  layers: initialLayers,
  activeLayerId: null,
  brushSize: 40,
  strokeWidth: 2,
  brushColor: '#000000',
  secondaryColor: '#555555',
  primaryOpacity: 1,
  secondaryOpacity: 1,
  canvasOffset: { x: 0, y: 0 },
  lassoPaths: [],
  selectionRect: null,
  cropRect: null,
  vectorPaths: [],
  activePathIndex: null,
  penMode: 'path',
  
  // Initialize history with the starting state
  documentSize: { w: 2000, h: 1400 },
  history: [
    {
      name: 'Initial State',
      state: {
        layers: initialLayers,
        activeLayerId: null,
        lassoPaths: [],
        selectionRect: null,
        documentSize: { w: 2000, h: 1400 },
      },
    },
  ],
  historyIndex: 0,

  setActiveTool: (tool) => set({ activeTool: tool }),
  setZoom: (zoom) => set({ zoom }),
  setCanvasOffset: (offset) => set({ canvasOffset: offset }),
  setLassoPaths: (updater) => set((state) => ({ 
    lassoPaths: typeof updater === 'function' ? updater(state.lassoPaths) : updater 
  })),
  setVectorPaths: (updater) => set((state) => ({ 
    vectorPaths: typeof updater === 'function' ? updater(state.vectorPaths) : updater 
  })),
  setActivePathIndex: (index) => set({ activePathIndex: index }),
  setPenMode: (mode) => set({ penMode: mode }),
  setSelectionRect: (updater) => set((state) => ({ 
    selectionRect: typeof updater === 'function' ? updater(state.selectionRect) : updater 
  })),
  setCropRect: (updater) => set((state) => ({ 
    cropRect: typeof updater === 'function' ? updater(state.cropRect) : updater 
  })),
  inverseSelection: () => set((state) => {
    const { w, h } = state.documentSize;
    
    // Boundary is either the active layer's area or the full document
    // For now, since all layers are documentSize internally, we use that,
    // but we could shift it by layer.position if we wanted.
    // The user said "on selected active canvas", so we use the document boundary
    // but ensure it's applied correctly.
    
    let currentPaths = [...state.lassoPaths];
    if (state.selectionRect) {
      const { x, y, w: rw, h: rh } = state.selectionRect;
      currentPaths.push([
        { x, y }, { x: x + rw, y }, { x: x + rw, y: y + rh }, { x, y: y + rh }
      ]);
    }
    const boundaryPath = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
    const hasBoundary = currentPaths.some(p => p.length === 4 && p[0].x === 0 && p[0].y === 0 && p[1].x === w);
    if (hasBoundary) {
      return { 
        lassoPaths: currentPaths.filter(p => !(p.length === 4 && p[0].x === 0 && p[0].y === 0 && p[1].x === w)), 
        selectionRect: null 
      };
    } else {
      return { lassoPaths: [boundaryPath, ...currentPaths], selectionRect: null };
    }
  }),
  addLayer: (layer) => set((state) => {
    const newLayer: Layer = {
      id: nanoid(),
      name: `Layer ${state.layers.length + 1}`,
      visible: true,
      locked: false,
      opacity: 1,
      type: 'paint',
      position: { x: 0, y: 0 },
      blendMode: 'source-over',
      ...layer,
    };
    return {
      layers: [newLayer, ...state.layers],
      activeLayerId: newLayer.id,
    };
  }),
  updateLayer: (id, updates) => set((state) => ({
    layers: state.layers.map((l) => (l.id === id ? { ...l, ...updates } : l)),
  })),
  setLayers: (layers) => set({ layers }),
  setDocumentSize: (documentSize) => set({ documentSize }),
  duplicateLayer: (id) => set((state) => {
    const layerToDup = state.layers.find(l => l.id === id);
    if (!layerToDup) return state;
    const newLayer = {
      ...layerToDup,
      id: nanoid(),
      name: `${layerToDup.name} Copy`,
      position: { x: layerToDup.position.x + 20, y: layerToDup.position.y + 20 }
    };
    return {
      layers: [newLayer, ...state.layers],
      activeLayerId: newLayer.id,
    };
  }),
  removeLayer: (id) => set((state) => ({
    layers: state.layers.filter((l) => l.id !== id),
  })),
  setActiveLayer: (id) => set({ activeLayerId: id }),
  toggleLayerVisibility: (id) => set((state) => ({
    layers: state.layers.map((l) => 
      l.id === id ? { ...l, visible: !l.visible } : l
    ),
  })),
  setBrushSize: (size) => set({ brushSize: size }),
  setStrokeWidth: (width) => set({ strokeWidth: width }),
  setBrushColor: (color: string) => set({ brushColor: color }),
  setSecondaryColor: (color: string) => set({ secondaryColor: color }),
  setPrimaryOpacity: (opacity) => set({ primaryOpacity: opacity }),
  setSecondaryOpacity: (opacity) => set({ secondaryOpacity: opacity }),
  
  undo: () => set((state) => {
    if (state.historyIndex <= 0) return state;
    const prevIndex = state.historyIndex - 1;
    return {
      ...state.history[prevIndex].state,
      historyIndex: prevIndex,
    };
  }),
  
  redo: () => set((state) => {
    if (state.historyIndex >= state.history.length - 1) return state;
    const nextIndex = state.historyIndex + 1;
    return {
      ...state.history[nextIndex].state,
      historyIndex: nextIndex,
    };
  }),

  moveLayer: (id, direction) => set((state) => {
    const index = state.layers.findIndex(l => l.id === id);
    if (index === -1) return state;
    const newLayers = [...state.layers];
    if (direction === 'up' && index > 0) {
      [newLayers[index], newLayers[index - 1]] = [newLayers[index - 1], newLayers[index]];
    } else if (direction === 'down' && index < newLayers.length - 1) {
      [newLayers[index], newLayers[index + 1]] = [newLayers[index + 1], newLayers[index]];
    }
    return { layers: newLayers };
  }),
  reorderLayers: (startIndex, endIndex) => set((state) => {
    const newLayers = [...state.layers];
    const [removed] = newLayers.splice(startIndex, 1);
    newLayers.splice(endIndex, 0, removed);
    return { layers: newLayers };
  }),
  
  recordHistory: (name) => set((state) => {
    const newEntry = {
      name,
      state: {
        layers: JSON.parse(JSON.stringify(state.layers)),
        activeLayerId: state.activeLayerId,
        lassoPaths: JSON.parse(JSON.stringify(state.lassoPaths)),
        selectionRect: state.selectionRect ? { ...state.selectionRect } : null,
        documentSize: { ...state.documentSize },
      },
    };
    // Cut off any future history if we were in the middle of undo/redo
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    return {
      history: [...newHistory, newEntry],
      historyIndex: newHistory.length,
    };
  }),
}));
